import {
  AudioOutputEngine,
  type BufferPlayback,
} from "../../browser/audio-output/AudioOutputEngine";
import { AudioSession } from "../../browser/audio-session/AudioSession";
import { NoiseEngine, type NoiseKind } from "../../browser/noise/NoiseEngine";
import { clamp } from "../../utils/audio";
import {
  NOISE_GENERATOR_INITIAL_KIND,
  NOISE_GENERATOR_INITIAL_TIMER_MINUTES,
  getNoiseTimerDurationMs,
  isNoiseTimerMinutes,
  type NoiseTimerMinutes,
} from "./config";

const GENERAL_LEVEL_MIN_DB = -60;
const GENERAL_LEVEL_MAX_DB = -12;
const GENERAL_LEVEL_DEFAULT_DB = -24;

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Noise Generator is missing required element: ${selector}`);
  }
  return element;
}

function parseNoiseKind(value: string | undefined): NoiseKind | null {
  return value === "white" || value === "pink" || value === "brown"
    ? value
    : null;
}

function formatNoiseKind(kind: NoiseKind): string {
  return `${kind[0]?.toUpperCase() ?? ""}${kind.slice(1)} noise`;
}

function formatTimer(minutes: NoiseTimerMinutes): string {
  return minutes === 0 ? "Timer off" : `${minutes} min timer`;
}

export class NoiseGeneratorController {
  readonly #root: HTMLElement;
  readonly #session = new AudioSession();
  readonly #listeners = new AbortController();
  readonly #kindButtons: readonly HTMLButtonElement[];
  readonly #timerButtons: readonly HTMLButtonElement[];
  readonly #playButton: HTMLButtonElement;
  readonly #stopButton: HTMLButtonElement;
  readonly #levelInput: HTMLInputElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #kindReadout: HTMLElement;
  readonly #timerReadout: HTMLElement;
  readonly #longPlaybackReminder: HTMLElement;
  readonly #errorMessage: HTMLElement;
  readonly #buffers = new Map<NoiseKind, AudioBuffer>();

  #engine: AudioOutputEngine | null = null;
  #noiseEngine: NoiseEngine | null = null;
  #playback: BufferPlayback | null = null;
  #kind: NoiseKind = NOISE_GENERATOR_INITIAL_KIND;
  #timerMinutes: NoiseTimerMinutes = NOISE_GENERATOR_INITIAL_TIMER_MINUTES;
  #levelDb = GENERAL_LEVEL_DEFAULT_DB;
  #timerId: number | null = null;
  #starting = false;
  #disposed = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#kindButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-noise-kind]"),
    ];
    this.#timerButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-noise-timer]"),
    ];
    this.#playButton = requireElement(root, "[data-noise-play]");
    this.#stopButton = requireElement(root, "[data-noise-stop]");
    this.#levelInput = requireElement(root, "#noise-generator-level");
    this.#status = requireElement(root, "#noise-generator-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#kindReadout = requireElement(root, "[data-noise-kind-readout]");
    this.#timerReadout = requireElement(root, "[data-noise-timer-readout]");
    this.#longPlaybackReminder = requireElement(
      root,
      "[data-noise-long-reminder]",
    );
    this.#errorMessage = requireElement(root, "[data-noise-error]");

    if (this.#kindButtons.length !== 3 || this.#timerButtons.length !== 4) {
      throw new Error("Noise Generator control topology is incomplete");
    }

    const restoredLevel = Number(this.#levelInput.value);
    if (Number.isFinite(restoredLevel)) {
      this.#levelDb = clamp(
        restoredLevel,
        GENERAL_LEVEL_MIN_DB,
        GENERAL_LEVEL_MAX_DB,
      );
    }

    this.#bindEvents();
    this.#resetIdleUi();
  }

  get isActive(): boolean {
    return this.#starting || this.#playback !== null;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.abort();
    this.#runToken += 1;
    this.#clearTimer();
    this.#playback = null;
    this.#buffers.clear();
    this.#noiseEngine = null;
    this.#engine = null;
    await this.#session.dispose();
  }

  #bindEvents(): void {
    const signal = this.#listeners.signal;

    for (const button of this.#kindButtons) {
      button.addEventListener(
        "click",
        () => {
          if (this.isActive || this.#disposed) return;
          const kind = parseNoiseKind(button.dataset.noiseKind);
          if (!kind) return;
          this.#kind = kind;
          this.#hideError();
          this.#renderSelection();
          this.#setStatus("idle", "Ready");
        },
        { signal },
      );
    }

    for (const button of this.#timerButtons) {
      button.addEventListener(
        "click",
        () => {
          if (this.isActive || this.#disposed) return;
          const timerMinutes = Number(button.dataset.noiseTimer);
          if (!isNoiseTimerMinutes(timerMinutes)) return;
          this.#timerMinutes = timerMinutes;
          this.#hideError();
          this.#renderSelection();
          this.#setStatus("idle", "Ready");
        },
        { signal },
      );
    }

    this.#playButton.addEventListener("click", () => void this.#start(), {
      signal,
    });
    this.#stopButton.addEventListener(
      "click",
      () => this.#stopCurrent("Stopped"),
      { signal },
    );

    this.#levelInput.addEventListener(
      "input",
      () => {
        const value = Number(this.#levelInput.value);
        if (!Number.isFinite(value)) return;
        this.#levelDb = clamp(
          value,
          GENERAL_LEVEL_MIN_DB,
          GENERAL_LEVEL_MAX_DB,
        );
        this.#engine?.setLevelDb(this.#levelDb);
      },
      { signal },
    );
  }

  async #getAudio(): Promise<{
    engine: AudioOutputEngine;
    noiseEngine: NoiseEngine;
  }> {
    const context = await this.#session.getContext();
    if (this.#disposed) {
      throw new Error("Noise Generator was disposed before audio could start");
    }

    if (!this.#engine) {
      this.#engine = new AudioOutputEngine(context, {
        levelProfile: "general",
      });
      this.#engine.setLevelDb(this.#levelDb);
      this.#session.register(this.#engine);
    }
    if (!this.#noiseEngine) this.#noiseEngine = new NoiseEngine(context);

    return { engine: this.#engine, noiseEngine: this.#noiseEngine };
  }

  #getBuffer(kind: NoiseKind, noiseEngine: NoiseEngine): AudioBuffer {
    const cached = this.#buffers.get(kind);
    if (cached) return cached;

    const buffer = noiseEngine.createNoiseBuffer(kind);
    this.#buffers.set(kind, buffer);
    return buffer;
  }

  async #start(): Promise<void> {
    if (this.isActive || this.#disposed) return;
    const token = this.#beginStart();

    try {
      const { engine, noiseEngine } = await this.#getAudio();
      if (!this.#isCurrentRun(token)) return;

      const buffer = this.#getBuffer(this.#kind, noiseEngine);
      const playback = engine.startBuffer(buffer, {
        loop: true,
        channelMode: "both",
      });
      if (!this.#isCurrentRun(token)) {
        playback.stop();
        return;
      }

      this.#playback = playback;
      this.#starting = false;
      this.#root.dataset.noiseVisual = "playing";
      this.#setControlsActive(true);
      this.#setStatus(
        "playing",
        `${formatNoiseKind(this.#kind)} · ${formatTimer(this.#timerMinutes)}`,
      );

      const timerDurationMs = getNoiseTimerDurationMs(this.#timerMinutes);
      if (timerDurationMs !== null) {
        this.#timerId = window.setTimeout(() => {
          if (!this.#isCurrentRun(token)) return;
          this.#timerId = null;
          this.#playback?.stop();
          this.#playback = null;
          this.#root.dataset.noiseVisual = "idle";
          this.#setControlsActive(false);
          this.#setStatus("idle", "Timer complete");
        }, timerDurationMs);
      }
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  #beginStart(): number {
    this.#runToken += 1;
    this.#starting = true;
    this.#hideError();
    this.#setControlsActive(false);
    this.#setStatus("ready", "Starting reference noise…");
    return this.#runToken;
  }

  #handleStartError(error: unknown, token: number): void {
    if (!this.#isCurrentRun(token)) return;
    console.error("Noise Generator playback failed", error);
    try {
      this.#engine?.stop();
    } catch (stopError) {
      console.error(
        "Noise Generator cleanup after start failure failed",
        stopError,
      );
    }

    this.#starting = false;
    this.#playback = null;
    this.#clearTimer();
    this.#root.dataset.noiseVisual = "idle";
    this.#setControlsActive(false);
    this.#setStatus("error", "Audio unavailable");
    this.#showError(
      "Reference noise could not start. Check that your browser allows Web Audio and that an output device is available, then try again.",
    );
  }

  #stopCurrent(statusLabel: string): void {
    if (!this.isActive) return;
    this.#runToken += 1;
    this.#starting = false;
    this.#clearTimer();
    this.#playback?.stop();
    this.#playback = null;
    this.#root.dataset.noiseVisual = "idle";
    this.#setControlsActive(false);
    this.#setStatus("idle", statusLabel);
  }

  #clearTimer(): void {
    if (this.#timerId !== null) {
      window.clearTimeout(this.#timerId);
      this.#timerId = null;
    }
  }

  #renderSelection(): void {
    this.#root.dataset.noiseKind = this.#kind;
    this.#kindReadout.textContent = formatNoiseKind(this.#kind);
    this.#timerReadout.textContent = formatTimer(this.#timerMinutes);

    for (const button of this.#kindButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.noiseKind === this.#kind),
      );
    }
    for (const button of this.#timerButtons) {
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.noiseTimer) === this.#timerMinutes),
      );
    }

    this.#longPlaybackReminder.hidden = this.#timerMinutes === 0;
  }

  #setControlsActive(active: boolean): void {
    const configLocked = active || this.#starting;
    for (const button of [...this.#kindButtons, ...this.#timerButtons]) {
      button.disabled = configLocked;
    }
    this.#playButton.disabled = configLocked || this.#disposed;
    this.#stopButton.disabled = !active;
    this.#levelInput.disabled = false;
  }

  #resetIdleUi(): void {
    this.#kind = NOISE_GENERATOR_INITIAL_KIND;
    this.#timerMinutes = NOISE_GENERATOR_INITIAL_TIMER_MINUTES;
    this.#clearTimer();
    this.#root.dataset.noiseVisual = "idle";
    this.#hideError();
    this.#renderSelection();
    this.#setControlsActive(false);
    this.#setStatus("idle", "Ready");
  }

  #setStatus(state: string, label: string): void {
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
  }

  #isCurrentRun(token: number): boolean {
    return !this.#disposed && token === this.#runToken;
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
