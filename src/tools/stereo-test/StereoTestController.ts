import {
  AudioOutputEngine,
  type OscillatorPlayback,
  type PannedOscillatorPlayback,
  type StereoChannelMode,
} from "../../browser/audio-output/AudioOutputEngine";
import {
  CHANNEL_TEST_DURATION_SECONDS,
  CHANNEL_TEST_FREQUENCY_HZ,
} from "../../browser/audio-output/referenceSignals";
import { AudioSession } from "../../browser/audio-session/AudioSession";

const PAN_SWEEP_SECONDS = 4;
const PAN_RETURN_MS = 240;

type StereoAction =
  "left" | "center" | "right" | "left-to-right" | "right-to-left";
type StereoPlayback = OscillatorPlayback | PannedOscillatorPlayback;

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element)
    throw new Error(`Stereo Test is missing required element: ${selector}`);
  return element;
}

function actionLabel(action: StereoAction): string {
  switch (action) {
    case "left":
      return "Left";
    case "center":
      return "Center";
    case "right":
      return "Right";
    case "left-to-right":
      return "L → R";
    case "right-to-left":
      return "R → L";
  }
}

function channelModeFor(
  action: "left" | "center" | "right",
): StereoChannelMode {
  if (action === "center") return "both";
  return action;
}

export class StereoTestController {
  readonly #root: HTMLElement;
  readonly #session = new AudioSession();
  readonly #listeners = new AbortController();
  readonly #actionButtons: readonly HTMLButtonElement[];
  readonly #stopButton: HTMLButtonElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #positionLabel: HTMLElement;
  readonly #errorMessage: HTMLElement;

  #engine: AudioOutputEngine | null = null;
  #playback: StereoPlayback | null = null;
  #finishTimer: number | null = null;
  #returnTimer: number | null = null;
  #activeAction: StereoAction | null = null;
  #starting = false;
  #disposed = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#actionButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-stereo-action]"),
    ];
    if (this.#actionButtons.length !== 5) {
      throw new Error("Stereo Test requires five playback actions");
    }
    this.#stopButton = requireElement(root, "[data-stereo-stop]");
    this.#status = requireElement(root, "#stereo-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#positionLabel = requireElement(root, "[data-stereo-position-label]");
    this.#errorMessage = requireElement(root, "[data-stereo-error]");

    this.#bindEvents();
    this.#resetIdleUi();
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.abort();
    this.#clearFinishTimer();
    this.#clearReturnTimer();
    this.#runToken += 1;
    this.#activeAction = null;
    this.#playback = null;
    this.#engine = null;
    await this.#session.dispose();
  }

  #bindEvents(): void {
    const signal = this.#listeners.signal;
    for (const button of this.#actionButtons) {
      button.addEventListener(
        "click",
        () => {
          const action = button.dataset.stereoAction as
            StereoAction | undefined;
          if (!action) return;
          if (action === "left-to-right" || action === "right-to-left") {
            void this.#runPan(action);
          } else {
            void this.#runStatic(action);
          }
        },
        { signal },
      );
    }
    this.#stopButton.addEventListener("click", () => this.#stopCurrent(), {
      signal,
    });
  }

  async #getEngine(): Promise<{
    context: AudioContext;
    engine: AudioOutputEngine;
  }> {
    const context = await this.#session.getContext();
    if (this.#disposed)
      throw new Error("Stereo Test was disposed before audio could start");
    if (!this.#engine) {
      this.#engine = new AudioOutputEngine(context, {
        levelProfile: "general",
      });
      this.#session.register(this.#engine);
    }
    return { context, engine: this.#engine };
  }

  async #runStatic(action: "left" | "center" | "right"): Promise<void> {
    if (this.#disposed || this.#starting || this.#playback) return;
    const token = this.#beginStart();
    try {
      const { engine } = await this.#getEngine();
      if (!this.#isCurrentRun(token)) return;
      this.#playback = engine.startOscillator({
        frequencyHz: CHANNEL_TEST_FREQUENCY_HZ,
        waveform: "sine",
        channelMode: channelModeFor(action),
        durationSeconds: CHANNEL_TEST_DURATION_SECONDS,
      });
      this.#starting = false;
      this.#activeAction = action;
      this.#setControlsActive(true);
      this.#setVisual(action, actionLabel(action));
      this.#setStatus("playing", `Playing ${actionLabel(action)}`);
      this.#scheduleFinish(CHANNEL_TEST_DURATION_SECONDS * 1_000, token);
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  async #runPan(action: "left-to-right" | "right-to-left"): Promise<void> {
    if (this.#disposed || this.#starting || this.#playback) return;
    const token = this.#beginStart();
    try {
      const { context, engine } = await this.#getEngine();
      if (!this.#isCurrentRun(token)) return;
      const fromPan = action === "left-to-right" ? -1 : 1;
      const toPan = -fromPan;
      const startTime = context.currentTime;
      const playback = engine.startPannedOscillator(
        CHANNEL_TEST_FREQUENCY_HZ,
        fromPan,
        startTime,
        PAN_SWEEP_SECONDS,
      );
      playback.schedulePanSweep(fromPan, toPan, PAN_SWEEP_SECONDS, startTime);
      this.#playback = playback;
      this.#starting = false;
      this.#activeAction = action;
      this.#setControlsActive(true);
      this.#setVisual(action, actionLabel(action));
      this.#setStatus("playing", `Panning ${actionLabel(action)}`);
      this.#scheduleFinish(PAN_SWEEP_SECONDS * 1_000, token);
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  #beginStart(): number {
    this.#clearReturnTimer();
    this.#runToken += 1;
    this.#starting = true;
    this.#hideError();
    this.#setControlsActive(true);
    this.#setStatus("ready", "Starting audio…");
    return this.#runToken;
  }

  #handleStartError(error: unknown, token: number): void {
    if (!this.#isCurrentRun(token)) return;
    console.error("Stereo Test playback failed", error);
    try {
      this.#engine?.stop();
    } catch (stopError) {
      console.error(
        "Stereo Test cleanup after start failure failed",
        stopError,
      );
    }
    this.#starting = false;
    this.#activeAction = null;
    this.#playback = null;
    this.#clearFinishTimer();
    this.#clearReturnTimer();
    this.#setControlsActive(false);
    this.#setVisual(null, "None");
    this.#setStatus("error", "Audio unavailable");
    this.#showError(
      "Stereo playback could not start. Check that your browser allows Web Audio and that an output device is available, then try again.",
    );
  }

  #stopCurrent(): void {
    if (!this.#starting && !this.#playback) return;
    this.#runToken += 1;
    this.#starting = false;
    this.#clearFinishTimer();
    this.#clearReturnTimer();
    this.#activeAction = null;
    this.#playback?.stop();
    this.#playback = null;
    this.#setControlsActive(false);
    this.#setVisual(null, "None");
    this.#setStatus("idle", "Stopped");
  }

  #finishRun(): void {
    const finishedAction = this.#activeAction;
    this.#finishTimer = null;
    this.#starting = false;
    this.#activeAction = null;
    this.#playback = null;
    this.#setControlsActive(false);
    if (
      finishedAction === "left-to-right" ||
      finishedAction === "right-to-left"
    ) {
      this.#returnPanVisual(finishedAction);
    } else {
      this.#setVisual(null, "None");
    }
    this.#setStatus("idle", "Ready for another check");
  }

  #returnPanVisual(action: "left-to-right" | "right-to-left"): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.#setVisual(null, "None");
      return;
    }
    for (const button of this.#actionButtons) {
      button.setAttribute("aria-pressed", "false");
    }
    this.#root.dataset.stereoVisual =
      action === "left-to-right" ? "return-from-right" : "return-from-left";
    this.#positionLabel.textContent = "Returning to center";
    this.#returnTimer = window.setTimeout(() => {
      this.#returnTimer = null;
      if (!this.#disposed) this.#setVisual(null, "None");
    }, PAN_RETURN_MS);
  }

  #scheduleFinish(delayMs: number, token: number): void {
    this.#clearFinishTimer();
    this.#finishTimer = window.setTimeout(() => {
      if (this.#isCurrentRun(token)) this.#finishRun();
    }, delayMs);
  }

  #clearFinishTimer(): void {
    if (this.#finishTimer === null) return;
    window.clearTimeout(this.#finishTimer);
    this.#finishTimer = null;
  }

  #clearReturnTimer(): void {
    if (this.#returnTimer === null) return;
    window.clearTimeout(this.#returnTimer);
    this.#returnTimer = null;
  }

  #isCurrentRun(token: number): boolean {
    return !this.#disposed && token === this.#runToken;
  }

  #setControlsActive(active: boolean): void {
    for (const button of this.#actionButtons) button.disabled = active;
    this.#stopButton.disabled = !active;
  }

  #setVisual(action: StereoAction | null, label: string): void {
    this.#root.dataset.stereoVisual = action ?? "center";
    this.#positionLabel.textContent = label;
    for (const button of this.#actionButtons) {
      button.setAttribute(
        "aria-pressed",
        String(action !== null && button.dataset.stereoAction === action),
      );
    }
  }

  #setStatus(state: string, label: string): void {
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
  }

  #resetIdleUi(): void {
    this.#setControlsActive(false);
    this.#setVisual(null, "None");
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
