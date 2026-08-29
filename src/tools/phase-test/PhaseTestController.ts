import {
  AudioOutputEngine,
  type PhaseBufferPlayback,
} from "../../browser/audio-output/AudioOutputEngine";
import { AudioSession } from "../../browser/audio-session/AudioSession";
import { NoiseEngine } from "../../browser/noise/NoiseEngine";

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Phase Test is missing required element: ${selector}`);
  return element;
}

export class PhaseTestController {
  readonly #root: HTMLElement;
  readonly #session = new AudioSession();
  readonly #listeners = new AbortController();
  readonly #inPhaseButton: HTMLButtonElement;
  readonly #invertedButton: HTMLButtonElement;
  readonly #toggleButton: HTMLButtonElement;
  readonly #stopButton: HTMLButtonElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #modeLabel: HTMLElement;
  readonly #errorMessage: HTMLElement;

  #engine: AudioOutputEngine | null = null;
  #noiseEngine: NoiseEngine | null = null;
  #phaseBuffer: AudioBuffer | null = null;
  #playback: PhaseBufferPlayback | null = null;
  #inverted = false;
  #starting = false;
  #disposed = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#inPhaseButton = requireElement(root, "[data-phase-in-phase]");
    this.#invertedButton = requireElement(root, "[data-phase-inverted]");
    this.#toggleButton = requireElement(root, "[data-phase-toggle]");
    this.#stopButton = requireElement(root, "[data-phase-stop]");
    this.#status = requireElement(root, "#phase-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#modeLabel = requireElement(root, "[data-phase-mode-label]");
    this.#errorMessage = requireElement(root, "[data-phase-error]");

    this.#bindEvents();
    this.#resetIdleUi();
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.abort();
    this.#runToken += 1;
    this.#playback = null;
    this.#phaseBuffer = null;
    this.#noiseEngine = null;
    this.#engine = null;
    await this.#session.dispose();
  }

  #bindEvents(): void {
    const signal = this.#listeners.signal;
    this.#inPhaseButton.addEventListener("click", () => void this.#selectMode(false), {
      signal,
    });
    this.#invertedButton.addEventListener("click", () => void this.#selectMode(true), {
      signal,
    });
    this.#toggleButton.addEventListener(
      "click",
      () => {
        if (this.#playback && !this.#starting) this.#applyMode(!this.#inverted);
      },
      { signal },
    );
    this.#stopButton.addEventListener("click", () => this.#stopCurrent(), { signal });
  }

  async #getAudio(): Promise<{
    context: AudioContext;
    engine: AudioOutputEngine;
    buffer: AudioBuffer;
  }> {
    const context = await this.#session.getContext();
    if (this.#disposed) throw new Error("Phase Test was disposed before audio could start");

    if (!this.#engine) {
      this.#engine = new AudioOutputEngine(context, { levelProfile: "general" });
      this.#session.register(this.#engine);
    }
    if (!this.#noiseEngine) this.#noiseEngine = new NoiseEngine(context);
    if (!this.#phaseBuffer) this.#phaseBuffer = this.#noiseEngine.createPhaseTestPinkBuffer();

    return { context, engine: this.#engine, buffer: this.#phaseBuffer };
  }

  async #selectMode(inverted: boolean): Promise<void> {
    if (this.#disposed || this.#starting) return;
    if (this.#playback) {
      this.#applyMode(inverted);
      return;
    }

    const token = this.#beginStart();
    try {
      const { context, engine, buffer } = await this.#getAudio();
      if (!this.#isCurrentRun(token)) return;
      this.#playback = engine.startPhaseBuffer(buffer, inverted, context.currentTime);
      this.#starting = false;
      this.#setControlsActive(true);
      this.#applyMode(inverted);
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  #applyMode(inverted: boolean): void {
    if (!this.#playback) return;
    this.#playback.setInverted(inverted);
    this.#inverted = inverted;
    this.#root.dataset.phaseMode = inverted ? "inverted" : "in-phase";
    this.#modeLabel.textContent = inverted ? "Inverted right" : "In phase";
    this.#setStatus("playing", inverted ? "Playing inverted" : "Playing in phase");
    this.#inPhaseButton.setAttribute("aria-pressed", String(!inverted));
    this.#invertedButton.setAttribute("aria-pressed", String(inverted));
  }

  #beginStart(): number {
    this.#runToken += 1;
    this.#starting = true;
    this.#hideError();
    this.#setControlsActive(true);
    this.#setStatus("ready", "Starting correlated pink noise…");
    return this.#runToken;
  }

  #handleStartError(error: unknown, token: number): void {
    if (!this.#isCurrentRun(token)) return;
    console.error("Phase Test playback failed", error);
    try {
      this.#engine?.stop();
    } catch (stopError) {
      console.error("Phase Test cleanup after start failure failed", stopError);
    }
    this.#starting = false;
    this.#playback = null;
    this.#setControlsActive(false);
    this.#setVisualIdle();
    this.#setStatus("error", "Audio unavailable");
    this.#showError(
      "Phase playback could not start. Check that your browser allows Web Audio and that an output device is available, then try again.",
    );
  }

  #stopCurrent(): void {
    if (!this.#starting && !this.#playback) return;
    this.#runToken += 1;
    this.#starting = false;
    this.#playback?.stop();
    this.#playback = null;
    this.#setControlsActive(false);
    this.#setVisualIdle();
    this.#setStatus("idle", "Stopped");
  }

  #setControlsActive(active: boolean): void {
    this.#inPhaseButton.disabled = this.#starting;
    this.#invertedButton.disabled = this.#starting;
    this.#toggleButton.disabled = !active || this.#starting;
    this.#stopButton.disabled = !active;
  }

  #setVisualIdle(): void {
    this.#root.dataset.phaseMode = "idle";
    this.#modeLabel.textContent = "None";
    this.#inPhaseButton.setAttribute("aria-pressed", "false");
    this.#invertedButton.setAttribute("aria-pressed", "false");
  }

  #setStatus(state: string, label: string): void {
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
  }

  #resetIdleUi(): void {
    this.#setControlsActive(false);
    this.#setVisualIdle();
    this.#setStatus("idle", "Ready");
    this.#hideError();
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
