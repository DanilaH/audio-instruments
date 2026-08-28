import {
  AudioOutputEngine,
  type OscillatorPlayback,
  type StereoChannelMode,
} from "../../browser/audio-output/AudioOutputEngine";
import { AudioSession } from "../../browser/audio-session/AudioSession";

const BURST_FREQUENCY_HZ = 500;
const BURST_DURATION_SECONDS = 0.7;
const SEQUENCE_GAP_SECONDS = 0.3;
const SEQUENCE_STEP_SECONDS = BURST_DURATION_SECONDS + SEQUENCE_GAP_SECONDS;
const SEQUENCE_TOTAL_SECONDS = BURST_DURATION_SECONDS + SEQUENCE_STEP_SECONDS * 2;

type ActiveChannel = StereoChannelMode | "none";

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Sound Test is missing required element: ${selector}`);
  }
  return element;
}

function parseChannelMode(value: string | undefined): StereoChannelMode | null {
  switch (value) {
    case "left":
    case "both":
    case "right":
      return value;
    default:
      return null;
  }
}

function channelLabel(mode: StereoChannelMode): string {
  switch (mode) {
    case "left":
      return "Left";
    case "both":
      return "Both";
    case "right":
      return "Right";
  }
}

export class SoundTestController {
  readonly #root: HTMLElement;
  readonly #session = new AudioSession();
  readonly #listeners = new AbortController();
  readonly #channelButtons: readonly HTMLButtonElement[];
  readonly #sequenceButton: HTMLButtonElement;
  readonly #stopButton: HTMLButtonElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #activeChannelLabel: HTMLElement;
  readonly #errorMessage: HTMLElement;
  readonly #timers = new Set<number>();

  #engine: AudioOutputEngine | null = null;
  #playbacks: OscillatorPlayback[] = [];
  #disposed = false;
  #starting = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#channelButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-sound-channel]"),
    ];
    if (this.#channelButtons.length !== 3) {
      throw new Error("Sound Test requires Left, Both and Right controls");
    }
    this.#sequenceButton = requireElement(root, "[data-sound-sequence]");
    this.#stopButton = requireElement(root, "[data-sound-stop]");
    this.#status = requireElement(root, "#sound-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#activeChannelLabel = requireElement(root, "[data-active-channel-label]");
    this.#errorMessage = requireElement(root, "[data-sound-error]");

    this.#bindEvents();
    this.#resetIdleUi();
  }

  get isActive(): boolean {
    return this.#playbacks.length > 0 || this.#starting;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.abort();
    this.#clearTimers();
    this.#runToken += 1;
    this.#playbacks = [];
    this.#engine = null;
    await this.#session.dispose();
  }

  #bindEvents(): void {
    const signal = this.#listeners.signal;

    for (const button of this.#channelButtons) {
      button.addEventListener(
        "click",
        () => {
          const mode = parseChannelMode(button.dataset.soundChannel);
          if (mode) void this.#runSingle(mode);
        },
        { signal },
      );
    }

    this.#sequenceButton.addEventListener(
      "click",
      () => void this.#runSequence(),
      { signal },
    );

    this.#stopButton.addEventListener("click", () => this.#stopCurrent(), {
      signal,
    });
  }

  async #getEngine(): Promise<{
    context: AudioContext;
    engine: AudioOutputEngine;
  }> {
    const context = await this.#session.getContext();
    if (this.#disposed) {
      throw new Error("Sound Test was disposed before audio could start");
    }

    if (!this.#engine) {
      this.#engine = new AudioOutputEngine(context, { levelProfile: "general" });
      this.#session.register(this.#engine);
    }

    return { context, engine: this.#engine };
  }

  async #runSingle(mode: StereoChannelMode): Promise<void> {
    if (this.#disposed || this.isActive) return;

    const token = this.#beginStart();
    this.#setStatus("ready", "Starting audio…");

    try {
      const { engine } = await this.#getEngine();
      if (!this.#isCurrentRun(token)) return;

      this.#playbacks = [
        engine.startOscillator({
          frequencyHz: BURST_FREQUENCY_HZ,
          waveform: "sine",
          channelMode: mode,
          durationSeconds: BURST_DURATION_SECONDS,
        }),
      ];
      this.#starting = false;
      this.#setControlsActive(true);
      this.#setActiveChannel(mode);
      this.#setStatus("playing", `Playing ${channelLabel(mode)}`);
      this.#schedule(
        BURST_DURATION_SECONDS * 1_000,
        token,
        () => this.#finishRun(),
      );
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  async #runSequence(): Promise<void> {
    if (this.#disposed || this.isActive) return;

    const token = this.#beginStart();
    this.#setStatus("ready", "Starting sequence…");

    try {
      const { context, engine } = await this.#getEngine();
      if (!this.#isCurrentRun(token)) return;

      const startTime = context.currentTime;
      const sequence: readonly StereoChannelMode[] = ["left", "both", "right"];
      this.#playbacks = sequence.map((mode, index) =>
        engine.startOscillator({
          frequencyHz: BURST_FREQUENCY_HZ,
          waveform: "sine",
          channelMode: mode,
          startTime: startTime + index * SEQUENCE_STEP_SECONDS,
          durationSeconds: BURST_DURATION_SECONDS,
        }),
      );

      this.#starting = false;
      this.#setControlsActive(true);
      this.#setStatus("playing", "Sequence running");
      this.#setActiveChannel("left");

      this.#schedule(700, token, () => this.#setSequenceGap());
      this.#schedule(1_000, token, () => this.#setSequenceChannel("both"));
      this.#schedule(1_700, token, () => this.#setSequenceGap());
      this.#schedule(2_000, token, () => this.#setSequenceChannel("right"));
      this.#schedule(
        SEQUENCE_TOTAL_SECONDS * 1_000,
        token,
        () => this.#finishRun(),
      );
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  #beginStart(): number {
    this.#runToken += 1;
    this.#starting = true;
    this.#hideError();
    this.#setControlsActive(true);
    return this.#runToken;
  }

  #handleStartError(error: unknown, token: number): void {
    if (!this.#isCurrentRun(token)) return;
    console.error("Sound Test playback failed", error);
    this.#engine?.stop();
    this.#starting = false;
    this.#playbacks = [];
    this.#clearTimers();
    this.#setControlsActive(false);
    this.#setActiveChannel("none");
    this.#setStatus("error", "Audio unavailable");
    this.#showError(
      "Audio playback could not start. Check that your browser allows Web Audio and that an output device is available, then try again.",
    );
  }

  #stopCurrent(): void {
    if (!this.isActive) return;

    this.#runToken += 1;
    this.#starting = false;
    this.#clearTimers();
    for (const playback of this.#playbacks) playback.stop();
    this.#playbacks = [];
    this.#setControlsActive(false);
    this.#setActiveChannel("none");
    this.#setStatus("idle", "Stopped");
  }

  #finishRun(): void {
    this.#clearTimers();
    this.#starting = false;
    this.#playbacks = [];
    this.#setControlsActive(false);
    this.#setActiveChannel("none");
    this.#setStatus("idle", "Ready for another check");
  }

  #setSequenceGap(): void {
    this.#setActiveChannel("none");
    this.#setStatus("playing", "Sequence running · gap");
  }

  #setSequenceChannel(mode: StereoChannelMode): void {
    this.#setActiveChannel(mode);
    this.#setStatus("playing", `Sequence · ${channelLabel(mode)}`);
  }

  #schedule(delayMs: number, token: number, action: () => void): void {
    const timer = window.setTimeout(() => {
      this.#timers.delete(timer);
      if (this.#isCurrentRun(token)) action();
    }, delayMs);
    this.#timers.add(timer);
  }

  #clearTimers(): void {
    for (const timer of this.#timers) window.clearTimeout(timer);
    this.#timers.clear();
  }

  #isCurrentRun(token: number): boolean {
    return !this.#disposed && token === this.#runToken;
  }

  #setControlsActive(active: boolean): void {
    for (const button of this.#channelButtons) button.disabled = active;
    this.#sequenceButton.disabled = active;
    this.#stopButton.disabled = !active;
  }

  #setActiveChannel(channel: ActiveChannel): void {
    this.#root.dataset.activeChannel = channel;
    this.#activeChannelLabel.textContent =
      channel === "none" ? "None" : channelLabel(channel);
  }

  #setStatus(state: string, label: string): void {
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
  }

  #resetIdleUi(): void {
    this.#setControlsActive(false);
    this.#setActiveChannel("none");
    this.#setStatus("idle", "Ready");
    this.#hideError();
  }

  #showError(message: string): void {
    this.#errorMessage.textContent = message;
    this.#errorMessage.hidden = false;
  }

  #hideError(): void {
    this.#errorMessage.hidden = true;
    this.#errorMessage.textContent = "";
  }
}
