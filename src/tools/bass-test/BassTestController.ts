import {
  AudioOutputEngine,
  type OscillatorPlayback,
} from "../../browser/audio-output/AudioOutputEngine";
import {
  BASS_PRESET_FREQUENCIES_HZ,
  BASS_PRESET_SEQUENCE_MAX_HZ,
  BASS_PRESET_SEQUENCE_STEP_SECONDS,
  BASS_PRESET_SEQUENCE_TOTAL_SECONDS,
  BASS_PRESET_TONE_DURATION_SECONDS,
  BASS_SWEEP_DEFAULT_HIGH_HZ,
  BASS_SWEEP_DEFAULT_LOW_HZ,
  BASS_SWEEP_MAX_HZ,
  BASS_SWEEP_MIN_HZ,
  createBassSweepDefinition,
} from "../../browser/audio-output/referenceSignals";
import { AudioSession } from "../../browser/audio-session/AudioSession";
import { clamp, getEffectiveMaxFrequency } from "../../utils/audio";

const GENERAL_LEVEL_MIN_DB = -60;
const GENERAL_LEVEL_MAX_DB = -12;
const GENERAL_LEVEL_DEFAULT_DB = -24;
const DEFAULT_TONE_FREQUENCY_HZ = BASS_PRESET_FREQUENCIES_HZ[4];
const MILLISECONDS_PER_SECOND = 1_000;

type BassMode = "tone" | "sweep" | "sequence";
type BassVisualState = "idle" | "tone" | "sweep" | "sequence" | "gap";

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Bass Test is missing required element: ${selector}`);
  }
  return element;
}

function parseMode(value: string | undefined): BassMode | null {
  switch (value) {
    case "tone":
    case "sweep":
    case "sequence":
      return value;
    default:
      return null;
  }
}

function modeLabel(mode: BassMode): string {
  switch (mode) {
    case "tone":
      return "Single tone";
    case "sweep":
      return "Slow sweep";
    case "sequence":
      return "Preset sequence";
  }
}

export class BassTestController {
  readonly #root: HTMLElement;
  readonly #session = new AudioSession();
  readonly #listeners = new AbortController();
  readonly #modeButtons: readonly HTMLButtonElement[];
  readonly #panels: readonly HTMLElement[];
  readonly #presetButtons: readonly HTMLButtonElement[];
  readonly #toneButton: HTMLButtonElement;
  readonly #sweepButton: HTMLButtonElement;
  readonly #sequenceButton: HTMLButtonElement;
  readonly #stopButton: HTMLButtonElement;
  readonly #levelInput: HTMLInputElement;
  readonly #frequencyRoot: HTMLElement;
  readonly #frequencyInput: HTMLInputElement;
  readonly #frequencySlider: HTMLInputElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #frequencyReadout: HTMLElement;
  readonly #visualLabel: HTMLElement;
  readonly #sweepRangeLabel: HTMLElement;
  readonly #capabilityNotice: HTMLElement;
  readonly #capabilityMessage: HTMLElement;
  readonly #errorMessage: HTMLElement;
  readonly #timers = new Set<number>();

  #engine: AudioOutputEngine | null = null;
  #playbacks: OscillatorPlayback[] = [];
  #mode: BassMode = "tone";
  #toneFrequencyHz = DEFAULT_TONE_FREQUENCY_HZ;
  #levelDb = GENERAL_LEVEL_DEFAULT_DB;
  #effectiveMaxHz = BASS_SWEEP_MAX_HZ;
  #starting = false;
  #disposed = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#modeButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-bass-mode]"),
    ];
    this.#panels = [
      ...root.querySelectorAll<HTMLElement>("[data-bass-panel]"),
    ];
    this.#presetButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-bass-preset]"),
    ];

    if (
      this.#modeButtons.length !== 3 ||
      this.#panels.length !== 3 ||
      this.#presetButtons.length !== BASS_PRESET_FREQUENCIES_HZ.length
    ) {
      throw new Error("Bass Test control topology is incomplete");
    }

    this.#toneButton = requireElement(root, "[data-bass-tone-play]");
    this.#sweepButton = requireElement(root, "[data-bass-sweep-play]");
    this.#sequenceButton = requireElement(root, "[data-bass-sequence-play]");
    this.#stopButton = requireElement(root, "[data-bass-stop]");
    this.#levelInput = requireElement(root, "#bass-level");
    this.#frequencyRoot = requireElement(root, "[data-frequency-control]");
    this.#frequencyInput = requireElement(root, "#bass-frequency-number");
    this.#frequencySlider = requireElement(root, "#bass-frequency-slider");
    this.#status = requireElement(root, "#bass-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#frequencyReadout = requireElement(root, "[data-bass-frequency-readout]");
    this.#visualLabel = requireElement(root, "[data-bass-visual-label]");
    this.#sweepRangeLabel = requireElement(root, "[data-bass-sweep-range]");
    this.#capabilityNotice = requireElement(root, "#bass-frequency-cap");
    this.#capabilityMessage = requireElement(
      this.#capabilityNotice,
      "[data-capability-message]",
    );
    this.#errorMessage = requireElement(root, "[data-bass-error]");

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
    return this.#starting || this.#playbacks.length > 0;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.abort();
    this.#runToken += 1;
    this.#clearTimers();
    this.#playbacks = [];
    this.#engine = null;
    await this.#session.dispose();
  }

  #bindEvents(): void {
    const signal = this.#listeners.signal;

    for (const button of this.#modeButtons) {
      button.addEventListener(
        "click",
        () => {
          const mode = parseMode(button.dataset.bassMode);
          if (mode) this.#switchMode(mode);
        },
        { signal },
      );
    }

    this.#toneButton.addEventListener("click", () => void this.#runSingleTone(), {
      signal,
    });
    this.#sweepButton.addEventListener("click", () => void this.#runSweep(), {
      signal,
    });
    this.#sequenceButton.addEventListener(
      "click",
      () => void this.#runPresetSequence(),
      { signal },
    );
    this.#stopButton.addEventListener(
      "click",
      () => this.#stopCurrent("Stopped"),
      { signal },
    );

    this.#frequencyInput.addEventListener(
      "input",
      () => {
        const value = Number(this.#frequencyInput.value);
        if (
          !Number.isFinite(value) ||
          value < BASS_SWEEP_MIN_HZ ||
          value > this.#effectiveMaxHz
        ) {
          return;
        }

        this.#toneFrequencyHz = value;
        this.#frequencyReadout.textContent = String(Math.round(value));
        if (this.#mode === "tone" && this.#playbacks[0] && !this.#starting) {
          this.#playbacks[0].setFrequency(value);
          this.#setVisual("tone", `${Math.round(value)} Hz`);
          this.#setStatus("playing", `Playing ${Math.round(value)} Hz`);
        }
      },
      { signal },
    );

    for (const button of this.#presetButtons) {
      button.addEventListener(
        "click",
        () => {
          const frequencyHz = Number(button.dataset.bassPreset);
          if (
            !Number.isFinite(frequencyHz) ||
            frequencyHz < BASS_SWEEP_MIN_HZ ||
            frequencyHz > this.#effectiveMaxHz
          ) {
            return;
          }
          this.#setToneFrequency(frequencyHz);
        },
        { signal },
      );
    }

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
      throw new Error("Bass Test was disposed before audio could start");
    }

    if (!this.#engine) {
      this.#engine = new AudioOutputEngine(context, { levelProfile: "general" });
      this.#engine.setLevelDb(this.#levelDb);
      this.#session.register(this.#engine);
    }

    this.#applyRuntimeFrequencyCap(context.sampleRate);
    return { context, engine: this.#engine };
  }

  #switchMode(mode: BassMode): void {
    if (this.#disposed || mode === this.#mode) return;
    if (this.isActive) this.#stopCurrent("Ready");
    this.#mode = mode;
    this.#hideError();
    this.#renderMode();
    this.#setControlsActive(false);
    this.#restoreIdleReadout();
    this.#setVisual("idle", modeLabel(mode));
    this.#setStatus("idle", "Ready");
  }

  #renderMode(): void {
    for (const button of this.#modeButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.bassMode === this.#mode),
      );
    }
    for (const panel of this.#panels) {
      panel.hidden = panel.dataset.bassPanel !== this.#mode;
    }
    this.#root.dataset.bassMode = this.#mode;
  }

  async #runSingleTone(): Promise<void> {
    if (this.#mode !== "tone" || this.isActive || this.#disposed) return;
    const token = this.#beginStart("Starting low-frequency tone…");

    try {
      const { engine } = await this.#getAudio();
      if (!this.#isCurrentRun(token)) return;
      if (!this.#hasUsableFrequencyRange()) {
        this.#showRangeUnavailable(token);
        return;
      }

      const frequencyHz = this.#readToneFrequency();
      if (frequencyHz === null) {
        this.#starting = false;
        this.#setControlsActive(false);
        this.#setStatus("error", "Check frequency");
        this.#showError(
          `Use a frequency from ${BASS_SWEEP_MIN_HZ} Hz to ${this.#effectiveMaxHz} Hz.`,
        );
        return;
      }

      this.#playbacks = [
        engine.startOscillator({
          frequencyHz,
          waveform: "sine",
          channelMode: "both",
        }),
      ];
      this.#starting = false;
      this.#setControlsActive(true);
      this.#frequencyReadout.textContent = String(Math.round(frequencyHz));
      this.#setVisual("tone", `${Math.round(frequencyHz)} Hz`);
      this.#setStatus("playing", `Playing ${Math.round(frequencyHz)} Hz`);
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  async #runSweep(): Promise<void> {
    if (this.#mode !== "sweep" || this.isActive || this.#disposed) return;
    const token = this.#beginStart("Starting slow bass sweep…");

    try {
      const { context, engine } = await this.#getAudio();
      if (!this.#isCurrentRun(token)) return;
      if (!this.#hasUsableFrequencyRange()) {
        this.#showRangeUnavailable(token);
        return;
      }

      const highHz = Math.min(BASS_SWEEP_DEFAULT_HIGH_HZ, this.#effectiveMaxHz);
      const definition = createBassSweepDefinition(
        BASS_SWEEP_DEFAULT_LOW_HZ,
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
      this.#playbacks = [playback];
      this.#starting = false;
      this.#setControlsActive(true);
      this.#frequencyReadout.textContent = `${definition.lowHz}–${definition.highHz}`;
      this.#setVisual("sweep", `${definition.lowHz} → ${definition.highHz} Hz`);
      this.#setStatus("playing", "Slow bass sweep running");
      this.#schedule(
        definition.durationSeconds * MILLISECONDS_PER_SECOND,
        token,
        () => this.#finishRun(),
      );
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  async #runPresetSequence(): Promise<void> {
    if (this.#mode !== "sequence" || this.isActive || this.#disposed) return;
    const token = this.#beginStart("Starting bass preset sequence…");

    try {
      const { context, engine } = await this.#getAudio();
      if (!this.#isCurrentRun(token)) return;
      if (!this.#hasUsableFrequencyRange()) {
        this.#showRangeUnavailable(token);
        return;
      }
      if (this.#effectiveMaxHz < BASS_PRESET_SEQUENCE_MAX_HZ) {
        this.#starting = false;
        this.#setControlsActive(false);
        this.#setVisual("idle", "Preset sequence unavailable");
        this.#setStatus("limited_capability", "Preset sequence unavailable");
        this.#showError(
          `The exact preset sequence requires generated output through ${BASS_PRESET_SEQUENCE_MAX_HZ} Hz.`,
        );
        return;
      }

      const startTime = context.currentTime;
      this.#playbacks = BASS_PRESET_FREQUENCIES_HZ.map(
        (frequencyHz, index) =>
          engine.startOscillator({
            frequencyHz,
            waveform: "sine",
            channelMode: "both",
            startTime: startTime + index * BASS_PRESET_SEQUENCE_STEP_SECONDS,
            durationSeconds: BASS_PRESET_TONE_DURATION_SECONDS,
          }),
      );
      this.#starting = false;
      this.#setControlsActive(true);
      this.#setStatus("playing", "Bass preset sequence running");

      BASS_PRESET_FREQUENCIES_HZ.forEach((frequencyHz, index) => {
        const startMs =
          index * BASS_PRESET_SEQUENCE_STEP_SECONDS * MILLISECONDS_PER_SECOND;
        const gapMs =
          startMs + BASS_PRESET_TONE_DURATION_SECONDS * MILLISECONDS_PER_SECOND;
        this.#schedule(startMs, token, () => {
          this.#frequencyReadout.textContent = String(frequencyHz);
          this.#setVisual("sequence", `${frequencyHz} Hz`);
        });
        if (index < BASS_PRESET_FREQUENCIES_HZ.length - 1) {
          this.#schedule(gapMs, token, () =>
            this.#setVisual("gap", "300 ms gap"),
          );
        }
      });

      this.#schedule(
        BASS_PRESET_SEQUENCE_TOTAL_SECONDS * MILLISECONDS_PER_SECOND,
        token,
        () => this.#finishRun(),
      );
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  #readToneFrequency(): number | null {
    const frequencyHz = Number(this.#frequencyInput.value);
    if (
      !Number.isFinite(frequencyHz) ||
      frequencyHz < BASS_SWEEP_MIN_HZ ||
      frequencyHz > this.#effectiveMaxHz
    ) {
      return null;
    }
    return frequencyHz;
  }

  #setToneFrequency(frequencyHz: number): void {
    this.#toneFrequencyHz = frequencyHz;
    this.#frequencyInput.value = String(frequencyHz);
    this.#frequencyInput.dispatchEvent(new Event("input", { bubbles: true }));
    this.#frequencyReadout.textContent = String(frequencyHz);
  }

  #applyRuntimeFrequencyCap(sampleRate: number): void {
    const effectiveMaxHz = getEffectiveMaxFrequency(sampleRate, BASS_SWEEP_MAX_HZ);
    if (effectiveMaxHz === this.#effectiveMaxHz) return;

    this.#effectiveMaxHz = effectiveMaxHz;

    if (effectiveMaxHz >= BASS_SWEEP_MIN_HZ) {
      this.#frequencyRoot.dataset.maxHz = String(effectiveMaxHz);
      this.#frequencyInput.max = String(effectiveMaxHz);
      if (this.#toneFrequencyHz > effectiveMaxHz) {
        this.#setToneFrequency(effectiveMaxHz);
      }
    }

    for (const button of this.#presetButtons) {
      const frequencyHz = Number(button.dataset.bassPreset);
      button.disabled =
        effectiveMaxHz < BASS_SWEEP_MIN_HZ || frequencyHz > effectiveMaxHz;
    }

    const sweepHighHz = Math.min(BASS_SWEEP_DEFAULT_HIGH_HZ, effectiveMaxHz);
    this.#sweepRangeLabel.textContent =
      effectiveMaxHz >= BASS_SWEEP_MIN_HZ
        ? `${BASS_SWEEP_DEFAULT_LOW_HZ} → ${sweepHighHz} Hz`
        : "20 → 120 Hz";

    if (effectiveMaxHz < BASS_SWEEP_MAX_HZ) {
      let limitation = "";
      if (effectiveMaxHz < BASS_SWEEP_MIN_HZ) {
        limitation = " The nominal 20–200 Hz Bass Test range is unavailable in this AudioContext.";
      } else if (effectiveMaxHz < BASS_PRESET_SEQUENCE_MAX_HZ) {
        limitation = ` The exact preset sequence is unavailable because it requires output through ${BASS_PRESET_SEQUENCE_MAX_HZ} Hz.`;
      } else if (effectiveMaxHz < BASS_SWEEP_DEFAULT_HIGH_HZ) {
        limitation = ` The slow sweep ends at ${effectiveMaxHz} Hz instead of the nominal ${BASS_SWEEP_DEFAULT_HIGH_HZ} Hz endpoint.`;
      }

      this.#capabilityMessage.textContent =
        `This browser's audio sample rate limits generated Bass Test frequencies to ${effectiveMaxHz} Hz.` +
        limitation;
      this.#capabilityNotice.hidden = false;
      this.#capabilityNotice.setAttribute("role", "status");
    }
  }

  #hasUsableFrequencyRange(): boolean {
    return this.#effectiveMaxHz >= BASS_SWEEP_MIN_HZ;
  }

  #showRangeUnavailable(token: number): void {
    if (!this.#isCurrentRun(token)) return;
    this.#starting = false;
    this.#setControlsActive(false);
    this.#setVisual("idle", "Range unavailable");
    this.#setStatus("limited_capability", "Bass range unavailable");
    this.#showError(
      `This AudioContext cannot generate the Bass Test range starting at ${BASS_SWEEP_MIN_HZ} Hz.`,
    );
  }

  #beginStart(label: string): number {
    this.#runToken += 1;
    this.#starting = true;
    this.#hideError();
    this.#setControlsActive(false);
    this.#setStatus("ready", label);
    return this.#runToken;
  }

  #handleStartError(error: unknown, token: number): void {
    if (!this.#isCurrentRun(token)) return;
    console.error("Bass Test playback failed", error);
    try {
      this.#engine?.stop();
    } catch (stopError) {
      console.error("Bass Test cleanup after start failure failed", stopError);
    }

    this.#starting = false;
    this.#playbacks = [];
    this.#clearTimers();
    this.#setControlsActive(false);
    this.#restoreIdleReadout();
    this.#setVisual("idle", modeLabel(this.#mode));
    this.#setStatus("error", "Audio unavailable");
    this.#showError(
      "Bass playback could not start. Check that your browser allows Web Audio and that an output device is available, then try again.",
    );
  }

  #stopCurrent(statusLabel: string): void {
    if (!this.isActive) return;
    this.#runToken += 1;
    this.#starting = false;
    this.#clearTimers();
    for (const playback of this.#playbacks) playback.stop();
    this.#playbacks = [];
    this.#setControlsActive(false);
    this.#restoreIdleReadout();
    this.#setVisual("idle", modeLabel(this.#mode));
    this.#setStatus("idle", statusLabel);
  }

  #finishRun(): void {
    this.#clearTimers();
    this.#starting = false;
    this.#playbacks = [];
    this.#setControlsActive(false);
    this.#restoreIdleReadout();
    this.#setVisual("idle", modeLabel(this.#mode));
    this.#setStatus("idle", "Ready for another check");
  }

  #setControlsActive(active: boolean): void {
    const startDisabled =
      active || this.#starting || !this.#hasUsableFrequencyRange();
    this.#toneButton.disabled = startDisabled;
    this.#sweepButton.disabled = startDisabled;
    this.#sequenceButton.disabled =
      startDisabled || this.#effectiveMaxHz < BASS_PRESET_SEQUENCE_MAX_HZ;

    for (const button of this.#modeButtons) {
      button.disabled = this.#starting;
    }

    const toneEditable = this.#mode === "tone" && !this.#starting;
    this.#frequencyInput.disabled =
      !toneEditable || !this.#hasUsableFrequencyRange();
    this.#frequencySlider.disabled =
      !toneEditable || !this.#hasUsableFrequencyRange();

    for (const button of this.#presetButtons) {
      const frequencyHz = Number(button.dataset.bassPreset);
      button.disabled =
        !toneEditable ||
        !this.#hasUsableFrequencyRange() ||
        frequencyHz > this.#effectiveMaxHz;
    }

    this.#levelInput.disabled = false;
    this.#stopButton.disabled = !active;
  }

  #restoreIdleReadout(): void {
    this.#frequencyReadout.textContent = String(Math.round(this.#toneFrequencyHz));
  }

  #setVisual(state: BassVisualState, label: string): void {
    this.#root.dataset.bassVisual = state;
    this.#visualLabel.textContent = label;
  }

  #setStatus(state: string, label: string): void {
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
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

  #resetIdleUi(): void {
    this.#effectiveMaxHz = BASS_SWEEP_MAX_HZ;
    this.#toneFrequencyHz = DEFAULT_TONE_FREQUENCY_HZ;
    this.#frequencyRoot.dataset.maxHz = String(BASS_SWEEP_MAX_HZ);
    this.#frequencyInput.min = String(BASS_SWEEP_MIN_HZ);
    this.#frequencyInput.max = String(BASS_SWEEP_MAX_HZ);
    this.#frequencyInput.value = String(DEFAULT_TONE_FREQUENCY_HZ);
    this.#frequencyInput.dispatchEvent(new Event("input", { bubbles: true }));
    this.#sweepRangeLabel.textContent = `${BASS_SWEEP_DEFAULT_LOW_HZ} → ${BASS_SWEEP_DEFAULT_HIGH_HZ} Hz`;
    this.#capabilityMessage.textContent = "";
    this.#capabilityNotice.hidden = true;
    this.#capabilityNotice.removeAttribute("role");
    this.#mode = "tone";
    this.#renderMode();
    this.#setControlsActive(false);
    this.#restoreIdleReadout();
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
