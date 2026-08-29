import {
  AudioOutputEngine,
  type OscillatorPlayback,
} from "../../browser/audio-output/AudioOutputEngine";
import {
  FREQUENCY_SWEEP_DEFAULT_DIRECTION,
  FREQUENCY_SWEEP_DEFAULT_DURATION_SECONDS,
  FREQUENCY_SWEEP_DEFAULT_HIGH_HZ,
  FREQUENCY_SWEEP_DEFAULT_LOW_HZ,
  FREQUENCY_SWEEP_DEFAULT_SCALE,
  FREQUENCY_SWEEP_MAX_DURATION_SECONDS,
  FREQUENCY_SWEEP_MAX_HZ,
  FREQUENCY_SWEEP_MIN_DURATION_SECONDS,
  FREQUENCY_SWEEP_MIN_HZ,
  createFrequencySweepDefinition,
} from "../../browser/audio-output/referenceSignals";
import { AudioSession } from "../../browser/audio-session/AudioSession";
import {
  clamp,
  getEffectiveMaxFrequency,
  getSweepEndpoints,
  type SweepDirection,
  type SweepScale,
} from "../../utils/audio";

const GENERAL_LEVEL_MIN_DB = -60;
const GENERAL_LEVEL_MAX_DB = -12;
const GENERAL_LEVEL_DEFAULT_DB = -24;
const MILLISECONDS_PER_SECOND = 1_000;

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Frequency Sweep is missing required element: ${selector}`);
  }
  return element;
}

function parseScale(value: string | undefined): SweepScale | null {
  return value === "linear" || value === "logarithmic" ? value : null;
}

function parseDirection(value: string | undefined): SweepDirection | null {
  return value === "ascending" || value === "descending" ? value : null;
}

function formatFrequency(frequencyHz: number): string {
  return frequencyHz >= 1_000
    ? `${Number((frequencyHz / 1_000).toFixed(1))} kHz`
    : `${Math.round(frequencyHz)} Hz`;
}

export class FrequencySweepController {
  readonly #root: HTMLElement;
  readonly #session = new AudioSession();
  readonly #listeners = new AbortController();
  readonly #lowRoot: HTMLElement;
  readonly #highRoot: HTMLElement;
  readonly #lowInput: HTMLInputElement;
  readonly #highInput: HTMLInputElement;
  readonly #lowSlider: HTMLInputElement;
  readonly #highSlider: HTMLInputElement;
  readonly #durationInput: HTMLInputElement;
  readonly #durationOutput: HTMLOutputElement;
  readonly #scaleButtons: readonly HTMLButtonElement[];
  readonly #directionButtons: readonly HTMLButtonElement[];
  readonly #playButton: HTMLButtonElement;
  readonly #stopButton: HTMLButtonElement;
  readonly #levelInput: HTMLInputElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #fromReadout: HTMLElement;
  readonly #toReadout: HTMLElement;
  readonly #durationReadout: HTMLElement;
  readonly #scaleReadout: HTMLElement;
  readonly #capabilityNotice: HTMLElement;
  readonly #capabilityMessage: HTMLElement;
  readonly #errorMessage: HTMLElement;

  #engine: AudioOutputEngine | null = null;
  #playback: OscillatorPlayback | null = null;
  #scale: SweepScale = FREQUENCY_SWEEP_DEFAULT_SCALE;
  #direction: SweepDirection = FREQUENCY_SWEEP_DEFAULT_DIRECTION;
  #levelDb = GENERAL_LEVEL_DEFAULT_DB;
  #effectiveMaxHz = FREQUENCY_SWEEP_MAX_HZ;
  #finishTimer: number | null = null;
  #starting = false;
  #disposed = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#lowRoot = requireElement(root, "[data-sweep-low-control]");
    this.#highRoot = requireElement(root, "[data-sweep-high-control]");
    this.#lowInput = requireElement(root, "#frequency-sweep-low-number");
    this.#highInput = requireElement(root, "#frequency-sweep-high-number");
    this.#lowSlider = requireElement(root, "#frequency-sweep-low-slider");
    this.#highSlider = requireElement(root, "#frequency-sweep-high-slider");
    this.#durationInput = requireElement(root, "#frequency-sweep-duration");
    this.#durationOutput = requireElement(root, "#frequency-sweep-duration-output");
    this.#scaleButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-sweep-scale]"),
    ];
    this.#directionButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-sweep-direction]"),
    ];
    this.#playButton = requireElement(root, "[data-sweep-play]");
    this.#stopButton = requireElement(root, "[data-sweep-stop]");
    this.#levelInput = requireElement(root, "#frequency-sweep-level");
    this.#status = requireElement(root, "#frequency-sweep-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#fromReadout = requireElement(root, "[data-sweep-from]");
    this.#toReadout = requireElement(root, "[data-sweep-to]");
    this.#durationReadout = requireElement(root, "[data-sweep-duration-readout]");
    this.#scaleReadout = requireElement(root, "[data-sweep-scale-readout]");
    this.#capabilityNotice = requireElement(root, "#frequency-sweep-cap");
    this.#capabilityMessage = requireElement(
      this.#capabilityNotice,
      "[data-capability-message]",
    );
    this.#errorMessage = requireElement(root, "[data-sweep-error]");

    if (this.#scaleButtons.length !== 2 || this.#directionButtons.length !== 2) {
      throw new Error("Frequency Sweep selector topology is incomplete");
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
    this.#clearFinishTimer();
    this.#playback = null;
    this.#engine = null;
    await this.#session.dispose();
  }

  #bindEvents(): void {
    const signal = this.#listeners.signal;

    for (const input of [this.#lowInput, this.#highInput]) {
      input.addEventListener("input", () => this.#configurationChanged(), {
        signal,
      });
    }

    this.#durationInput.addEventListener(
      "input",
      () => this.#configurationChanged(),
      { signal },
    );

    for (const button of this.#scaleButtons) {
      button.addEventListener(
        "click",
        () => {
          if (this.isActive) return;
          const scale = parseScale(button.dataset.sweepScale);
          if (!scale) return;
          this.#scale = scale;
          this.#configurationChanged();
        },
        { signal },
      );
    }

    for (const button of this.#directionButtons) {
      button.addEventListener(
        "click",
        () => {
          if (this.isActive) return;
          const direction = parseDirection(button.dataset.sweepDirection);
          if (!direction) return;
          this.#direction = direction;
          this.#configurationChanged();
        },
        { signal },
      );
    }

    this.#playButton.addEventListener("click", () => void this.#runSweep(), {
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
    context: AudioContext;
    engine: AudioOutputEngine;
  }> {
    const context = await this.#session.getContext();
    if (this.#disposed) {
      throw new Error("Frequency Sweep was disposed before audio could start");
    }

    if (!this.#engine) {
      this.#engine = new AudioOutputEngine(context, { levelProfile: "general" });
      this.#engine.setLevelDb(this.#levelDb);
      this.#session.register(this.#engine);
    }

    this.#applyRuntimeFrequencyCap(context.sampleRate);
    return { context, engine: this.#engine };
  }

  async #runSweep(): Promise<void> {
    if (this.isActive || this.#disposed) return;
    const token = this.#beginStart();

    try {
      const { context, engine } = await this.#getAudio();
      if (!this.#isCurrentRun(token)) return;
      if (!this.#hasUsableFrequencyRange()) {
        this.#showRangeUnavailable(token);
        return;
      }

      const definition = this.#readDefinition();
      if (!definition) {
        this.#starting = false;
        this.#setControlsActive(false);
        this.#setStatus("error", "Check sweep settings");
        this.#showError(this.#getConfigurationError());
        return;
      }

      const [startHz, endHz] = getSweepEndpoints(definition);
      const startTime = context.currentTime;
      const playback = engine.startOscillator({
        frequencyHz: startHz,
        waveform: "sine",
        channelMode: "both",
        startTime,
        durationSeconds: definition.durationSeconds,
      });
      playback.scheduleSweep(definition, startTime);
      this.#playback = playback;
      this.#starting = false;
      this.#root.dataset.sweepVisual = "playing";
      this.#root.dataset.sweepScale = definition.scale;
      this.#root.dataset.sweepDirection = definition.direction;
      this.#root.style.setProperty(
        "--sweep-duration",
        `${definition.durationSeconds}s`,
      );
      this.#renderReadouts(definition);
      this.#setControlsActive(true);
      this.#setStatus("playing", "Frequency sweep running");
      this.#finishTimer = window.setTimeout(() => {
        if (this.#isCurrentRun(token)) this.#finishRun();
      }, definition.durationSeconds * MILLISECONDS_PER_SECOND);
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  #readDefinition() {
    if (this.#getConfigurationError() !== "") return null;

    return createFrequencySweepDefinition(
      Number(this.#lowInput.value),
      Number(this.#highInput.value),
      Number(this.#durationInput.value),
      this.#scale,
      this.#direction,
    );
  }

  #getConfigurationError(): string {
    const lowHz = Number(this.#lowInput.value);
    const highHz = Number(this.#highInput.value);
    const durationSeconds = Number(this.#durationInput.value);

    if (
      !Number.isFinite(lowHz) ||
      !Number.isFinite(highHz) ||
      lowHz < FREQUENCY_SWEEP_MIN_HZ ||
      highHz > this.#effectiveMaxHz
    ) {
      return `Use frequencies from ${FREQUENCY_SWEEP_MIN_HZ} Hz to ${this.#effectiveMaxHz} Hz.`;
    }
    if (lowHz > highHz) {
      return "Low frequency must be less than or equal to high frequency.";
    }
    if (
      !Number.isFinite(durationSeconds) ||
      durationSeconds < FREQUENCY_SWEEP_MIN_DURATION_SECONDS ||
      durationSeconds > FREQUENCY_SWEEP_MAX_DURATION_SECONDS
    ) {
      return `Use a duration from ${FREQUENCY_SWEEP_MIN_DURATION_SECONDS} to ${FREQUENCY_SWEEP_MAX_DURATION_SECONDS} seconds.`;
    }
    return "";
  }

  #configurationChanged(): void {
    if (this.#disposed || this.isActive) return;
    const error = this.#getConfigurationError();
    if (error) this.#showError(error);
    else this.#hideError();
    this.#renderReadouts();
    this.#setControlsActive(false);
    this.#setStatus(error ? "error" : "idle", error ? "Check settings" : "Ready");
  }

  #renderReadouts(definition = this.#readDefinition()): void {
    if (!definition) {
      this.#durationOutput.value = `${this.#durationInput.value} s`;
      return;
    }

    const [startHz, endHz] = getSweepEndpoints(definition);
    this.#fromReadout.textContent = formatFrequency(startHz);
    this.#toReadout.textContent = formatFrequency(endHz);
    this.#durationReadout.textContent = `${definition.durationSeconds} s`;
    this.#durationOutput.value = `${definition.durationSeconds} s`;
    this.#scaleReadout.textContent =
      definition.scale === "logarithmic" ? "Logarithmic" : "Linear";

    this.#root.dataset.sweepScale = definition.scale;
    this.#root.dataset.sweepDirection = definition.direction;

    for (const button of this.#scaleButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.sweepScale === definition.scale),
      );
    }
    for (const button of this.#directionButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.sweepDirection === definition.direction),
      );
    }
  }

  #applyRuntimeFrequencyCap(sampleRate: number): void {
    const effectiveMaxHz = getEffectiveMaxFrequency(
      sampleRate,
      FREQUENCY_SWEEP_MAX_HZ,
    );
    if (effectiveMaxHz === this.#effectiveMaxHz) return;

    this.#effectiveMaxHz = effectiveMaxHz;

    if (effectiveMaxHz >= FREQUENCY_SWEEP_MIN_HZ) {
      for (const [controlRoot, input] of [
        [this.#lowRoot, this.#lowInput],
        [this.#highRoot, this.#highInput],
      ] as const) {
        controlRoot.dataset.maxHz = String(effectiveMaxHz);
        input.max = String(effectiveMaxHz);
      }

      const currentLowHz = Number(this.#lowInput.value);
      const currentHighHz = Number(this.#highInput.value);
      const lowHz = Number.isFinite(currentLowHz)
        ? Math.min(currentLowHz, effectiveMaxHz)
        : FREQUENCY_SWEEP_DEFAULT_LOW_HZ;
      const highHz = Number.isFinite(currentHighHz)
        ? Math.min(currentHighHz, effectiveMaxHz)
        : effectiveMaxHz;

      this.#setFrequencyInput(this.#lowInput, lowHz);
      this.#setFrequencyInput(this.#highInput, highHz);
    }

    if (effectiveMaxHz < FREQUENCY_SWEEP_MAX_HZ) {
      this.#capabilityMessage.textContent =
        effectiveMaxHz >= FREQUENCY_SWEEP_MIN_HZ
          ? `This browser's audio sample rate limits generated Frequency Sweep output to ${effectiveMaxHz} Hz in this session. The high-frequency control has been clamped to that limit.`
          : `This browser's audio sample rate cannot generate the nominal Frequency Sweep range starting at ${FREQUENCY_SWEEP_MIN_HZ} Hz in this session.`;
      this.#capabilityNotice.hidden = false;
      this.#capabilityNotice.setAttribute("role", "status");
    }

    this.#renderReadouts();
    this.#setControlsActive(false);
  }

  #setFrequencyInput(input: HTMLInputElement, frequencyHz: number): void {
    input.value = String(frequencyHz);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  #hasUsableFrequencyRange(): boolean {
    return this.#effectiveMaxHz >= FREQUENCY_SWEEP_MIN_HZ;
  }

  #showRangeUnavailable(token: number): void {
    if (!this.#isCurrentRun(token)) return;
    this.#starting = false;
    this.#setControlsActive(false);
    this.#root.dataset.sweepVisual = "idle";
    this.#setStatus("limited_capability", "Sweep range unavailable");
    this.#showError(
      `This AudioContext cannot generate the Frequency Sweep range starting at ${FREQUENCY_SWEEP_MIN_HZ} Hz.`,
    );
  }

  #beginStart(): number {
    this.#runToken += 1;
    this.#starting = true;
    this.#hideError();
    this.#setControlsActive(false);
    this.#setStatus("ready", "Starting frequency sweep…");
    return this.#runToken;
  }

  #handleStartError(error: unknown, token: number): void {
    if (!this.#isCurrentRun(token)) return;
    console.error("Frequency Sweep playback failed", error);
    try {
      this.#engine?.stop();
    } catch (stopError) {
      console.error("Frequency Sweep cleanup after start failure failed", stopError);
    }

    this.#starting = false;
    this.#playback = null;
    this.#clearFinishTimer();
    this.#root.dataset.sweepVisual = "idle";
    this.#setControlsActive(false);
    this.#setStatus("error", "Audio unavailable");
    this.#showError(
      "The frequency sweep could not start. Check that your browser allows Web Audio and that an output device is available, then try again.",
    );
  }

  #stopCurrent(statusLabel: string): void {
    if (!this.isActive) return;
    this.#runToken += 1;
    this.#starting = false;
    this.#clearFinishTimer();
    this.#playback?.stop();
    this.#playback = null;
    this.#root.dataset.sweepVisual = "idle";
    this.#setControlsActive(false);
    this.#setStatus("idle", statusLabel);
  }

  #finishRun(): void {
    this.#clearFinishTimer();
    this.#starting = false;
    this.#playback = null;
    this.#root.dataset.sweepVisual = "idle";
    this.#setControlsActive(false);
    this.#setStatus("idle", "Ready for another sweep");
  }

  #setControlsActive(active: boolean): void {
    const configLocked = active || this.#starting;
    const configValid = this.#getConfigurationError() === "";
    const usableRange = this.#hasUsableFrequencyRange();

    this.#lowInput.disabled = configLocked || !usableRange;
    this.#highInput.disabled = configLocked || !usableRange;
    this.#lowSlider.disabled = configLocked || !usableRange;
    this.#highSlider.disabled = configLocked || !usableRange;
    this.#durationInput.disabled = configLocked;

    for (const button of [...this.#scaleButtons, ...this.#directionButtons]) {
      button.disabled = configLocked;
    }

    this.#playButton.disabled =
      configLocked || !usableRange || !configValid || this.#disposed;
    this.#stopButton.disabled = !active;
    this.#levelInput.disabled = false;
  }

  #setStatus(state: string, label: string): void {
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
  }

  #clearFinishTimer(): void {
    if (this.#finishTimer !== null) {
      window.clearTimeout(this.#finishTimer);
      this.#finishTimer = null;
    }
  }

  #isCurrentRun(token: number): boolean {
    return !this.#disposed && token === this.#runToken;
  }

  #resetIdleUi(): void {
    this.#effectiveMaxHz = FREQUENCY_SWEEP_MAX_HZ;
    this.#scale = FREQUENCY_SWEEP_DEFAULT_SCALE;
    this.#direction = FREQUENCY_SWEEP_DEFAULT_DIRECTION;
    this.#lowRoot.dataset.maxHz = String(FREQUENCY_SWEEP_MAX_HZ);
    this.#highRoot.dataset.maxHz = String(FREQUENCY_SWEEP_MAX_HZ);
    this.#lowInput.min = String(FREQUENCY_SWEEP_MIN_HZ);
    this.#lowInput.max = String(FREQUENCY_SWEEP_MAX_HZ);
    this.#highInput.min = String(FREQUENCY_SWEEP_MIN_HZ);
    this.#highInput.max = String(FREQUENCY_SWEEP_MAX_HZ);
    this.#setFrequencyInput(this.#lowInput, FREQUENCY_SWEEP_DEFAULT_LOW_HZ);
    this.#setFrequencyInput(this.#highInput, FREQUENCY_SWEEP_DEFAULT_HIGH_HZ);
    this.#durationInput.value = String(FREQUENCY_SWEEP_DEFAULT_DURATION_SECONDS);
    this.#capabilityMessage.textContent = "";
    this.#capabilityNotice.hidden = true;
    this.#capabilityNotice.removeAttribute("role");
    this.#root.dataset.sweepVisual = "idle";
    this.#root.style.setProperty(
      "--sweep-duration",
      `${FREQUENCY_SWEEP_DEFAULT_DURATION_SECONDS}s`,
    );
    this.#hideError();
    this.#renderReadouts();
    this.#setControlsActive(false);
    this.#setStatus("idle", "Ready");
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
