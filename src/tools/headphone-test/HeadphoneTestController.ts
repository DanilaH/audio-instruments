import {
  AudioOutputEngine,
  type OscillatorPlayback,
  type PhaseBufferPlayback,
  type StereoChannelMode,
} from "../../browser/audio-output/AudioOutputEngine";
import {
  CHANNEL_TEST_DURATION_SECONDS,
  CHANNEL_TEST_FREQUENCY_HZ,
  createBassSweepDefinition,
} from "../../browser/audio-output/referenceSignals";
import { AudioSession } from "../../browser/audio-session/AudioSession";
import { NoiseEngine } from "../../browser/noise/NoiseEngine";
import {
  clamp,
  getEffectiveMaxFrequency,
  type SweepDefinition,
} from "../../utils/audio";

const HEADPHONE_SWEEP_MIN_HZ = 20;
const HEADPHONE_SWEEP_NOMINAL_MAX_HZ = 20_000;
const HEADPHONE_SWEEP_DURATION_SECONDS = 15;
const HEADPHONE_BASS_LOW_HZ = 20;
const HEADPHONE_BASS_HIGH_HZ = 120;
const GENERAL_LEVEL_MIN_DB = -60;
const GENERAL_LEVEL_MAX_DB = -12;
const GENERAL_LEVEL_DEFAULT_DB = -24;
const MILLISECONDS_PER_SECOND = 1_000;

type HeadphoneMode = StereoChannelMode | "phase" | "sweep" | "bass";
type HeadphoneVisualState =
  "idle" | StereoChannelMode | "phase-in" | "phase-inverted" | "sweep" | "bass";

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Headphone Test is missing required element: ${selector}`);
  }
  return element;
}

function parseMode(value: string | undefined): HeadphoneMode | null {
  switch (value) {
    case "left":
    case "right":
    case "both":
    case "phase":
    case "sweep":
    case "bass":
      return value;
    default:
      return null;
  }
}

function isChannelMode(mode: HeadphoneMode): mode is StereoChannelMode {
  return mode === "left" || mode === "right" || mode === "both";
}

function modeLabel(mode: HeadphoneMode): string {
  switch (mode) {
    case "left":
      return "Left ear";
    case "right":
      return "Right ear";
    case "both":
      return "Both ears";
    case "phase":
      return "Phase";
    case "sweep":
      return "Frequency sweep";
    case "bass":
      return "Bass / rattle";
  }
}

export class HeadphoneTestController {
  readonly #root: HTMLElement;
  readonly #session = new AudioSession();
  readonly #listeners = new AbortController();
  readonly #modeButtons: readonly HTMLButtonElement[];
  readonly #panels: readonly HTMLElement[];
  readonly #phaseInButton: HTMLButtonElement;
  readonly #phaseInvertedButton: HTMLButtonElement;
  readonly #phaseToggleButton: HTMLButtonElement;
  readonly #sweepButton: HTMLButtonElement;
  readonly #bassButton: HTMLButtonElement;
  readonly #stopButton: HTMLButtonElement;
  readonly #levelInput: HTMLInputElement;
  readonly #sweepLowInput: HTMLInputElement;
  readonly #sweepHighInput: HTMLInputElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #visualLabel: HTMLElement;
  readonly #capabilityNotice: HTMLElement;
  readonly #capabilityMessage: HTMLElement;
  readonly #errorMessage: HTMLElement;

  #engine: AudioOutputEngine | null = null;
  #noiseEngine: NoiseEngine | null = null;
  #phaseBuffer: AudioBuffer | null = null;
  #phasePlayback: PhaseBufferPlayback | null = null;
  #oscillatorPlayback: OscillatorPlayback | null = null;
  #finishTimer: number | null = null;
  #mode: HeadphoneMode = "left";
  #phaseInverted = false;
  #levelDb = GENERAL_LEVEL_DEFAULT_DB;
  #effectiveMaxHz = HEADPHONE_SWEEP_NOMINAL_MAX_HZ;
  #starting = false;
  #disposed = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#modeButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-headphone-mode]"),
    ];
    this.#panels = [
      ...root.querySelectorAll<HTMLElement>("[data-headphone-panel]"),
    ];
    if (this.#modeButtons.length !== 6 || this.#panels.length !== 3) {
      throw new Error(
        "Headphone Test requires six modes and three advanced panels",
      );
    }

    this.#phaseInButton = requireElement(root, "[data-headphone-phase-in]");
    this.#phaseInvertedButton = requireElement(
      root,
      "[data-headphone-phase-inverted]",
    );
    this.#phaseToggleButton = requireElement(
      root,
      "[data-headphone-phase-toggle]",
    );
    this.#sweepButton = requireElement(root, "[data-headphone-sweep]");
    this.#bassButton = requireElement(root, "[data-headphone-bass]");
    this.#stopButton = requireElement(root, "[data-headphone-stop]");
    this.#levelInput = requireElement(root, "#headphone-level");
    this.#sweepLowInput = requireElement(root, "#headphone-sweep-low");
    this.#sweepHighInput = requireElement(root, "#headphone-sweep-high");
    this.#status = requireElement(root, "#headphone-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#visualLabel = requireElement(root, "[data-headphone-visual-label]");
    this.#capabilityNotice = requireElement(root, "#headphone-frequency-cap");
    this.#capabilityMessage = requireElement(
      this.#capabilityNotice,
      "[data-capability-message]",
    );
    this.#errorMessage = requireElement(root, "[data-headphone-error]");

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
    this.#renderMode();
  }

  get isActive(): boolean {
    return (
      this.#starting ||
      this.#phasePlayback !== null ||
      this.#oscillatorPlayback !== null
    );
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.abort();
    this.#runToken += 1;
    this.#clearFinishTimer();
    this.#phasePlayback = null;
    this.#oscillatorPlayback = null;
    this.#phaseBuffer = null;
    this.#noiseEngine = null;
    this.#engine = null;
    await this.#session.dispose();
  }

  #bindEvents(): void {
    const signal = this.#listeners.signal;
    for (const button of this.#modeButtons) {
      button.addEventListener(
        "click",
        () => {
          const mode = parseMode(button.dataset.headphoneMode);
          if (mode) void this.#selectMode(mode);
        },
        { signal },
      );
    }

    this.#phaseInButton.addEventListener(
      "click",
      () => void this.#runPhase(false),
      { signal },
    );
    this.#phaseInvertedButton.addEventListener(
      "click",
      () => void this.#runPhase(true),
      { signal },
    );
    this.#phaseToggleButton.addEventListener(
      "click",
      () => {
        if (this.#phasePlayback && !this.#starting) {
          this.#applyPhaseMode(!this.#phaseInverted);
        }
      },
      { signal },
    );
    this.#sweepButton.addEventListener("click", () => void this.#runSweep(), {
      signal,
    });
    this.#bassButton.addEventListener("click", () => void this.#runBass(), {
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

  async #selectMode(mode: HeadphoneMode): Promise<void> {
    if (this.#disposed || this.#starting) return;
    if (this.isActive) {
      if (mode === this.#mode) return;
      this.#stopCurrent("Ready");
    }

    this.#mode = mode;
    this.#hideError();
    this.#resetPhaseSelection();
    this.#renderMode();
    this.#setVisual("idle", modeLabel(mode));
    this.#setStatus("idle", "Ready");

    if (isChannelMode(mode)) await this.#runChannel(mode);
  }

  #renderMode(): void {
    for (const button of this.#modeButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.headphoneMode === this.#mode),
      );
    }
    for (const panel of this.#panels) {
      panel.hidden = panel.dataset.headphonePanel !== this.#mode;
    }
    this.#root.dataset.headphoneMode = this.#mode;
  }

  async #getAudio(): Promise<{
    context: AudioContext;
    engine: AudioOutputEngine;
  }> {
    const context = await this.#session.getContext();
    if (this.#disposed) {
      throw new Error("Headphone Test was disposed before audio could start");
    }

    if (!this.#engine) {
      this.#engine = new AudioOutputEngine(context, {
        levelProfile: "general",
      });
      this.#engine.setLevelDb(this.#levelDb);
      this.#session.register(this.#engine);
    }
    this.#applyRuntimeFrequencyCap(context.sampleRate);
    return { context, engine: this.#engine };
  }

  #getPhaseBuffer(context: AudioContext): AudioBuffer {
    if (!this.#noiseEngine) this.#noiseEngine = new NoiseEngine(context);
    if (!this.#phaseBuffer) {
      this.#phaseBuffer = this.#noiseEngine.createPhaseTestPinkBuffer();
    }
    return this.#phaseBuffer;
  }

  async #runChannel(mode: StereoChannelMode): Promise<void> {
    if (this.#disposed || this.#starting || this.isActive) return;
    const token = this.#beginStart(`Starting ${modeLabel(mode)} check…`);
    try {
      const { engine } = await this.#getAudio();
      if (!this.#isCurrentRun(token)) return;

      this.#oscillatorPlayback = engine.startOscillator({
        frequencyHz: CHANNEL_TEST_FREQUENCY_HZ,
        waveform: "sine",
        channelMode: mode,
        durationSeconds: CHANNEL_TEST_DURATION_SECONDS,
      });
      this.#starting = false;
      this.#setControlsActive(true);
      this.#setVisual(mode, modeLabel(mode));
      this.#setStatus("playing", `Playing ${modeLabel(mode)}`);
      this.#scheduleFinish(
        CHANNEL_TEST_DURATION_SECONDS * MILLISECONDS_PER_SECOND,
        token,
      );
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  async #runPhase(inverted: boolean): Promise<void> {
    if (this.#mode !== "phase" || this.#disposed || this.#starting) return;
    if (this.#phasePlayback) {
      this.#applyPhaseMode(inverted);
      return;
    }
    if (this.#oscillatorPlayback) return;

    const token = this.#beginStart("Starting correlated pink noise…");
    try {
      const { context, engine } = await this.#getAudio();
      if (!this.#isCurrentRun(token)) return;

      const startTime = context.currentTime;
      this.#phasePlayback = engine.startPhaseBuffer(
        this.#getPhaseBuffer(context),
        inverted,
        startTime,
      );
      this.#starting = false;
      this.#setControlsActive(true);
      this.#applyPhaseMode(inverted);
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  #applyPhaseMode(inverted: boolean): void {
    if (!this.#phasePlayback) return;
    this.#phasePlayback.setInverted(inverted);
    this.#phaseInverted = inverted;
    this.#phaseInButton.setAttribute("aria-pressed", String(!inverted));
    this.#phaseInvertedButton.setAttribute("aria-pressed", String(inverted));
    this.#setVisual(
      inverted ? "phase-inverted" : "phase-in",
      inverted ? "Inverted right" : "In phase",
    );
    this.#setStatus(
      "playing",
      inverted ? "Playing inverted" : "Playing in phase",
    );
  }

  async #runSweep(): Promise<void> {
    if (this.#mode !== "sweep" || this.#disposed || this.isActive) return;
    const token = this.#beginStart("Starting headphone sweep…");
    try {
      const { context, engine } = await this.#getAudio();
      if (!this.#isCurrentRun(token)) return;

      const definition = this.#readSweepDefinition();
      if (!definition) {
        this.#starting = false;
        this.#setControlsActive(false);
        this.#setStatus("error", "Check sweep range");
        this.#showError(
          `Use frequencies from ${HEADPHONE_SWEEP_MIN_HZ} Hz to ${this.#effectiveMaxHz} Hz, with low less than or equal to high.`,
        );
        return;
      }

      const startTime = context.currentTime;
      const playback = engine.startOscillator({
        frequencyHz: definition.lowHz,
        waveform: "sine",
        channelMode: "both",
        startTime,
        durationSeconds: definition.durationSeconds,
      });
      playback.scheduleSweep(definition, startTime);
      this.#oscillatorPlayback = playback;
      this.#starting = false;
      this.#setControlsActive(true);
      this.#setVisual("sweep", `${definition.lowHz} → ${definition.highHz} Hz`);
      this.#setStatus("playing", "Headphone sweep running");
      this.#scheduleFinish(
        definition.durationSeconds * MILLISECONDS_PER_SECOND,
        token,
      );
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  async #runBass(): Promise<void> {
    if (this.#mode !== "bass" || this.#disposed || this.isActive) return;
    const token = this.#beginStart("Starting bass / rattle sweep…");
    try {
      const { context, engine } = await this.#getAudio();
      if (!this.#isCurrentRun(token)) return;

      const highHz = Math.min(HEADPHONE_BASS_HIGH_HZ, this.#effectiveMaxHz);
      if (highHz < HEADPHONE_BASS_LOW_HZ) {
        throw new RangeError(
          `This browser cannot generate the Headphone bass range from ${HEADPHONE_BASS_LOW_HZ} Hz.`,
        );
      }

      const definition = createBassSweepDefinition(
        HEADPHONE_BASS_LOW_HZ,
        highHz,
      );
      const startTime = context.currentTime;
      const playback = engine.startOscillator({
        frequencyHz: definition.lowHz,
        waveform: "sine",
        channelMode: "both",
        startTime,
        durationSeconds: definition.durationSeconds,
      });
      playback.scheduleSweep(definition, startTime);
      this.#oscillatorPlayback = playback;
      this.#starting = false;
      this.#setControlsActive(true);
      this.#setVisual("bass", `20 → ${highHz} Hz`);
      this.#setStatus("playing", "Bass / rattle sweep running");
      this.#scheduleFinish(
        definition.durationSeconds * MILLISECONDS_PER_SECOND,
        token,
      );
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  #readSweepDefinition(): SweepDefinition | null {
    const lowHz = Number(this.#sweepLowInput.value);
    const highHz = Number(this.#sweepHighInput.value);
    if (
      !Number.isFinite(lowHz) ||
      !Number.isFinite(highHz) ||
      lowHz < HEADPHONE_SWEEP_MIN_HZ ||
      highHz > this.#effectiveMaxHz ||
      lowHz > highHz
    ) {
      return null;
    }

    return {
      lowHz,
      highHz,
      durationSeconds: HEADPHONE_SWEEP_DURATION_SECONDS,
      direction: "ascending",
      scale: "logarithmic",
    };
  }

  #applyRuntimeFrequencyCap(sampleRate: number): void {
    const effectiveMaxHz = getEffectiveMaxFrequency(
      sampleRate,
      HEADPHONE_SWEEP_NOMINAL_MAX_HZ,
    );
    if (effectiveMaxHz === this.#effectiveMaxHz) return;

    this.#effectiveMaxHz = effectiveMaxHz;
    this.#sweepLowInput.max = String(effectiveMaxHz);
    this.#sweepHighInput.max = String(effectiveMaxHz);
    if (Number(this.#sweepHighInput.value) > effectiveMaxHz) {
      this.#sweepHighInput.value = String(effectiveMaxHz);
    }
    if (Number(this.#sweepLowInput.value) > effectiveMaxHz) {
      this.#sweepLowInput.value = String(effectiveMaxHz);
    }

    if (effectiveMaxHz < HEADPHONE_SWEEP_NOMINAL_MAX_HZ) {
      this.#capabilityMessage.textContent = `This browser's audio sample rate limits generated Headphone frequencies to ${effectiveMaxHz} Hz.`;
      this.#capabilityNotice.hidden = false;
      this.#capabilityNotice.setAttribute("role", "status");
    }
  }

  #beginStart(label: string): number {
    this.#runToken += 1;
    this.#starting = true;
    this.#hideError();
    this.#setControlsActive(true);
    this.#setStatus("ready", label);
    return this.#runToken;
  }

  #handleStartError(error: unknown, token: number): void {
    if (!this.#isCurrentRun(token)) return;
    console.error("Headphone Test playback failed", error);
    try {
      this.#engine?.stop();
    } catch (stopError) {
      console.error(
        "Headphone Test cleanup after start failure failed",
        stopError,
      );
    }
    this.#starting = false;
    this.#oscillatorPlayback = null;
    this.#phasePlayback = null;
    this.#clearFinishTimer();
    this.#resetPhaseSelection();
    this.#setControlsActive(false);
    this.#setVisual("idle", modeLabel(this.#mode));
    this.#setStatus("error", "Audio unavailable");
    this.#showError(
      "Headphone playback could not start. Check that your browser allows Web Audio and that an output device is available, then try again.",
    );
  }

  #stopCurrent(statusLabel: string): void {
    if (!this.isActive) return;
    this.#runToken += 1;
    this.#starting = false;
    this.#clearFinishTimer();
    this.#oscillatorPlayback?.stop();
    this.#oscillatorPlayback = null;
    this.#phasePlayback?.stop();
    this.#phasePlayback = null;
    this.#resetPhaseSelection();
    this.#setControlsActive(false);
    this.#setVisual("idle", modeLabel(this.#mode));
    this.#setStatus("idle", statusLabel);
  }

  #finishRun(): void {
    this.#finishTimer = null;
    this.#starting = false;
    this.#oscillatorPlayback = null;
    this.#setControlsActive(false);
    this.#setVisual("idle", modeLabel(this.#mode));
    this.#setStatus("idle", "Ready for another check");
  }

  #setControlsActive(active: boolean): void {
    for (const button of this.#modeButtons) button.disabled = this.#starting;
    this.#sweepButton.disabled = active || this.#starting;
    this.#bassButton.disabled = active || this.#starting;
    this.#sweepLowInput.disabled = active || this.#starting;
    this.#sweepHighInput.disabled = active || this.#starting;
    this.#levelInput.disabled = false;

    const phaseRunning = this.#mode === "phase" && this.#phasePlayback !== null;
    this.#phaseInButton.disabled = this.#starting;
    this.#phaseInvertedButton.disabled = this.#starting;
    this.#phaseToggleButton.disabled = !phaseRunning || this.#starting;
    this.#stopButton.disabled = !active;
  }

  #resetPhaseSelection(): void {
    this.#phaseInverted = false;
    this.#phaseInButton.setAttribute("aria-pressed", "false");
    this.#phaseInvertedButton.setAttribute("aria-pressed", "false");
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

  #setVisual(state: HeadphoneVisualState, label: string): void {
    this.#root.dataset.headphoneVisual = state;
    this.#visualLabel.textContent = label;
  }

  #setStatus(state: string, label: string): void {
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
  }

  #isCurrentRun(token: number): boolean {
    return !this.#disposed && token === this.#runToken;
  }

  #resetIdleUi(): void {
    this.#effectiveMaxHz = HEADPHONE_SWEEP_NOMINAL_MAX_HZ;
    this.#sweepLowInput.min = String(HEADPHONE_SWEEP_MIN_HZ);
    this.#sweepLowInput.max = String(HEADPHONE_SWEEP_NOMINAL_MAX_HZ);
    this.#sweepHighInput.min = String(HEADPHONE_SWEEP_MIN_HZ);
    this.#sweepHighInput.max = String(HEADPHONE_SWEEP_NOMINAL_MAX_HZ);
    this.#sweepLowInput.value = String(HEADPHONE_SWEEP_MIN_HZ);
    this.#sweepHighInput.value = String(HEADPHONE_SWEEP_NOMINAL_MAX_HZ);
    this.#capabilityMessage.textContent = "";
    this.#capabilityNotice.hidden = true;
    this.#capabilityNotice.removeAttribute("role");
    this.#resetPhaseSelection();
    this.#setControlsActive(false);
    this.#setVisual("idle", modeLabel(this.#mode));
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
