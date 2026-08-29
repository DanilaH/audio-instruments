import {
  AudioOutputEngine,
  type OscillatorPlayback,
  type PhaseBufferPlayback,
  type StereoChannelMode,
} from "../../browser/audio-output/AudioOutputEngine";
import {
  CHANNEL_SEQUENCE_STEP_SECONDS,
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

const SPEAKER_SWEEP_MIN_HZ = 20;
const SPEAKER_SWEEP_NOMINAL_MAX_HZ = 20_000;
const SPEAKER_SWEEP_DEFAULT_LOW_HZ = 100;
const SPEAKER_SWEEP_DEFAULT_HIGH_HZ = 10_000;
const SPEAKER_SWEEP_DURATION_SECONDS = 10;
const SPEAKER_BASS_LOW_HZ = 40;
const SPEAKER_BASS_HIGH_HZ = 120;
const GENERAL_LEVEL_MIN_DB = -60;
const GENERAL_LEVEL_MAX_DB = -12;
const GENERAL_LEVEL_DEFAULT_DB = -24;
const MILLISECONDS_PER_SECOND = 1_000;
const CHANNEL_BURST_MS = CHANNEL_TEST_DURATION_SECONDS * MILLISECONDS_PER_SECOND;
const CHANNEL_STEP_MS = CHANNEL_SEQUENCE_STEP_SECONDS * MILLISECONDS_PER_SECOND;
const CHANNEL_SEQUENCE_TOTAL_MS = CHANNEL_STEP_MS * 2 + CHANNEL_BURST_MS;

type SpeakerMode = "channel" | "phase" | "sweep" | "bass";
type SpeakerVisualState =
  | "idle"
  | "left"
  | "both"
  | "right"
  | "phase-in"
  | "phase-inverted"
  | "sweep"
  | "bass";

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Speaker Test is missing required element: ${selector}`);
  }
  return element;
}

function parseMode(value: string | undefined): SpeakerMode | null {
  switch (value) {
    case "channel":
    case "phase":
    case "sweep":
    case "bass":
      return value;
    default:
      return null;
  }
}

function parseChannel(value: string | undefined): StereoChannelMode | null {
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

export class SpeakerTestController {
  readonly #root: HTMLElement;
  readonly #session = new AudioSession();
  readonly #listeners = new AbortController();
  readonly #modeButtons: readonly HTMLButtonElement[];
  readonly #panels: readonly HTMLElement[];
  readonly #channelButtons: readonly HTMLButtonElement[];
  readonly #sequenceButton: HTMLButtonElement;
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
  readonly #timers = new Set<number>();

  #engine: AudioOutputEngine | null = null;
  #noiseEngine: NoiseEngine | null = null;
  #phaseBuffer: AudioBuffer | null = null;
  #phasePlayback: PhaseBufferPlayback | null = null;
  #oscillatorPlaybacks: OscillatorPlayback[] = [];
  #mode: SpeakerMode = "channel";
  #phaseInverted = false;
  #levelDb = GENERAL_LEVEL_DEFAULT_DB;
  #effectiveMaxHz = SPEAKER_SWEEP_NOMINAL_MAX_HZ;
  #starting = false;
  #disposed = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#modeButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-speaker-mode]"),
    ];
    this.#panels = [
      ...root.querySelectorAll<HTMLElement>("[data-speaker-panel]"),
    ];
    this.#channelButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-speaker-channel]"),
    ];

    if (this.#modeButtons.length !== 4 || this.#panels.length !== 4) {
      throw new Error("Speaker Test requires four modes and four mode panels");
    }
    if (this.#channelButtons.length !== 3) {
      throw new Error("Speaker Test requires Left, Both and Right channel controls");
    }

    this.#sequenceButton = requireElement(root, "[data-speaker-sequence]");
    this.#phaseInButton = requireElement(root, "[data-speaker-phase-in]");
    this.#phaseInvertedButton = requireElement(
      root,
      "[data-speaker-phase-inverted]",
    );
    this.#phaseToggleButton = requireElement(root, "[data-speaker-phase-toggle]");
    this.#sweepButton = requireElement(root, "[data-speaker-sweep]");
    this.#bassButton = requireElement(root, "[data-speaker-bass]");
    this.#stopButton = requireElement(root, "[data-speaker-stop]");
    this.#levelInput = requireElement(root, "#speaker-level");
    this.#sweepLowInput = requireElement(root, "#speaker-sweep-low");
    this.#sweepHighInput = requireElement(root, "#speaker-sweep-high");
    this.#status = requireElement(root, "#speaker-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#visualLabel = requireElement(root, "[data-speaker-visual-label]");
    this.#capabilityNotice = requireElement(root, "#speaker-frequency-cap");
    this.#capabilityMessage = requireElement(
      this.#capabilityNotice,
      "[data-capability-message]",
    );
    this.#errorMessage = requireElement(root, "[data-speaker-error]");

    const restoredLevel = Number(this.#levelInput.value);
    if (Number.isFinite(restoredLevel)) {
      this.#levelDb = clamp(
        restoredLevel,
        GENERAL_LEVEL_MIN_DB,
        GENERAL_LEVEL_MAX_DB,
      );
    }

    this.#bindEvents();
    this.#switchMode("channel", false);
    this.#resetIdleUi();
  }

  get isActive(): boolean {
    return (
      this.#starting ||
      this.#phasePlayback !== null ||
      this.#oscillatorPlaybacks.length > 0
    );
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.abort();
    this.#runToken += 1;
    this.#clearTimers();
    this.#phasePlayback = null;
    this.#oscillatorPlaybacks = [];
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
          const mode = parseMode(button.dataset.speakerMode);
          if (mode) this.#switchMode(mode);
        },
        { signal },
      );
    }

    for (const button of this.#channelButtons) {
      button.addEventListener(
        "click",
        () => {
          const mode = parseChannel(button.dataset.speakerChannel);
          if (mode) void this.#runChannel(mode);
        },
        { signal },
      );
    }

    this.#sequenceButton.addEventListener(
      "click",
      () => void this.#runSequence(),
      { signal },
    );
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
    this.#sweepButton.addEventListener(
      "click",
      () => void this.#runSweep(),
      { signal },
    );
    this.#bassButton.addEventListener(
      "click",
      () => void this.#runBass(),
      { signal },
    );
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
      throw new Error("Speaker Test was disposed before audio could start");
    }

    if (!this.#engine) {
      this.#engine = new AudioOutputEngine(context, { levelProfile: "general" });
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

  #switchMode(mode: SpeakerMode, stopActive = true): void {
    if (this.#disposed || mode === this.#mode) {
      if (!stopActive) this.#renderMode();
      return;
    }

    if (stopActive && this.isActive) this.#stopCurrent("Ready");
    this.#mode = mode;
    this.#hideError();
    this.#setVisual("idle", mode === "bass" ? "Bass / rattle" : "Ready");
    this.#renderMode();
    this.#setControlsActive(false);
    this.#setStatus("idle", "Ready");
  }

  #renderMode(): void {
    for (const button of this.#modeButtons) {
      const selected = button.dataset.speakerMode === this.#mode;
      button.setAttribute("aria-pressed", String(selected));
    }
    for (const panel of this.#panels) {
      panel.hidden = panel.dataset.speakerPanel !== this.#mode;
    }
    this.#root.dataset.speakerMode = this.#mode;
  }

  async #runChannel(mode: StereoChannelMode): Promise<void> {
    if (this.#mode !== "channel" || this.isActive || this.#disposed) return;
    const token = this.#beginStart("Starting channel burst…");

    try {
      const { engine } = await this.#getAudio();
      if (!this.#isCurrentRun(token)) return;

      this.#oscillatorPlaybacks = [
        engine.startOscillator({
          frequencyHz: CHANNEL_TEST_FREQUENCY_HZ,
          waveform: "sine",
          channelMode: mode,
          durationSeconds: CHANNEL_TEST_DURATION_SECONDS,
        }),
      ];
      this.#starting = false;
      this.#setControlsActive(true);
      this.#setVisual(mode, channelLabel(mode));
      this.#setStatus("playing", `Playing ${channelLabel(mode)}`);
      this.#schedule(CHANNEL_BURST_MS, token, () => this.#finishRun());
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  async #runSequence(): Promise<void> {
    if (this.#mode !== "channel" || this.isActive || this.#disposed) return;
    const token = this.#beginStart("Starting channel sequence…");

    try {
      const { context, engine } = await this.#getAudio();
      if (!this.#isCurrentRun(token)) return;

      const startTime = context.currentTime;
      const sequence: readonly StereoChannelMode[] = ["left", "both", "right"];
      this.#oscillatorPlaybacks = sequence.map((mode, index) =>
        engine.startOscillator({
          frequencyHz: CHANNEL_TEST_FREQUENCY_HZ,
          waveform: "sine",
          channelMode: mode,
          startTime: startTime + index * CHANNEL_SEQUENCE_STEP_SECONDS,
          durationSeconds: CHANNEL_TEST_DURATION_SECONDS,
        }),
      );

      this.#starting = false;
      this.#setControlsActive(true);
      this.#setVisual("left", "Left");
      this.#setStatus("playing", "Channel sequence running");
      this.#schedule(CHANNEL_BURST_MS, token, () =>
        this.#setVisual("idle", "Gap"),
      );
      this.#schedule(CHANNEL_STEP_MS, token, () =>
        this.#setVisual("both", "Both"),
      );
      this.#schedule(CHANNEL_STEP_MS + CHANNEL_BURST_MS, token, () =>
        this.#setVisual("idle", "Gap"),
      );
      this.#schedule(CHANNEL_STEP_MS * 2, token, () =>
        this.#setVisual("right", "Right"),
      );
      this.#schedule(CHANNEL_SEQUENCE_TOTAL_MS, token, () => this.#finishRun());
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
    if (this.#mode !== "sweep" || this.isActive || this.#disposed) return;
    const token = this.#beginStart("Starting speaker sweep…");

    try {
      const { context, engine } = await this.#getAudio();
      if (!this.#isCurrentRun(token)) return;

      const definition = this.#readSweepDefinition();
      if (!definition) {
        this.#starting = false;
        this.#setControlsActive(false);
        this.#setStatus("error", "Check sweep range");
        this.#showError(
          `Use frequencies from ${SPEAKER_SWEEP_MIN_HZ} Hz to ${this.#effectiveMaxHz} Hz, with low less than or equal to high.`,
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
      this.#oscillatorPlaybacks = [playback];
      this.#starting = false;
      this.#setControlsActive(true);
      this.#setVisual(
        "sweep",
        `${definition.lowHz} → ${definition.highHz} Hz`,
      );
      this.#setStatus("playing", "Speaker sweep running");
      this.#schedule(
        definition.durationSeconds * MILLISECONDS_PER_SECOND,
        token,
        () => this.#finishRun(),
      );
    } catch (error) {
      this.#handleStartError(error, token);
    }
  }

  async #runBass(): Promise<void> {
    if (this.#mode !== "bass" || this.isActive || this.#disposed) return;
    const token = this.#beginStart("Starting bass / rattle sweep…");

    try {
      const { context, engine } = await this.#getAudio();
      if (!this.#isCurrentRun(token)) return;

      const highHz = Math.min(SPEAKER_BASS_HIGH_HZ, this.#effectiveMaxHz);
      if (highHz < SPEAKER_BASS_LOW_HZ) {
        throw new RangeError(
          `This browser cannot generate the Speaker bass range from ${SPEAKER_BASS_LOW_HZ} Hz.`,
        );
      }

      const definition = createBassSweepDefinition(
        SPEAKER_BASS_LOW_HZ,
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
      this.#oscillatorPlaybacks = [playback];
      this.#starting = false;
      this.#setControlsActive(true);
      this.#setVisual("bass", `40 → ${highHz} Hz`);
      this.#setStatus("playing", "Bass / rattle sweep running");
      this.#schedule(
        definition.durationSeconds * MILLISECONDS_PER_SECOND,
        token,
        () => this.#finishRun(),
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
      lowHz < SPEAKER_SWEEP_MIN_HZ ||
      highHz > this.#effectiveMaxHz ||
      lowHz > highHz
    ) {
      return null;
    }

    return {
      lowHz,
      highHz,
      durationSeconds: SPEAKER_SWEEP_DURATION_SECONDS,
      direction: "ascending",
      scale: "logarithmic",
    };
  }

  #applyRuntimeFrequencyCap(sampleRate: number): void {
    const effectiveMaxHz = getEffectiveMaxFrequency(
      sampleRate,
      SPEAKER_SWEEP_NOMINAL_MAX_HZ,
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

    if (effectiveMaxHz < SPEAKER_SWEEP_NOMINAL_MAX_HZ) {
      this.#capabilityMessage.textContent = `This browser's audio sample rate limits generated Speaker frequencies to ${effectiveMaxHz} Hz.`;
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
    console.error("Speaker Test playback failed", error);
    try {
      this.#engine?.stop();
    } catch (stopError) {
      console.error("Speaker Test cleanup after start failure failed", stopError);
    }

    this.#starting = false;
    this.#oscillatorPlaybacks = [];
    this.#phasePlayback = null;
    this.#clearTimers();
    this.#resetPhaseSelection();
    this.#setControlsActive(false);
    this.#setVisual("idle", "Ready");
    this.#setStatus("error", "Audio unavailable");
    this.#showError(
      "Speaker playback could not start. Check that your browser allows Web Audio and that an output device is available, then try again.",
    );
  }

  #stopCurrent(statusLabel: string): void {
    if (!this.isActive) return;

    this.#runToken += 1;
    this.#starting = false;
    this.#clearTimers();
    for (const playback of this.#oscillatorPlaybacks) playback.stop();
    this.#oscillatorPlaybacks = [];
    this.#phasePlayback?.stop();
    this.#phasePlayback = null;
    this.#resetPhaseSelection();
    this.#setControlsActive(false);
    this.#setVisual("idle", "Ready");
    this.#setStatus("idle", statusLabel);
  }

  #finishRun(): void {
    this.#clearTimers();
    this.#starting = false;
    this.#oscillatorPlaybacks = [];
    this.#setControlsActive(false);
    this.#setVisual("idle", "Ready");
    this.#setStatus("idle", "Ready for another check");
  }

  #setControlsActive(active: boolean): void {
    const disableStarts = active || this.#starting;
    for (const button of this.#channelButtons) button.disabled = disableStarts;
    this.#sequenceButton.disabled = disableStarts;
    this.#sweepButton.disabled = disableStarts;
    this.#bassButton.disabled = disableStarts;
    this.#sweepLowInput.disabled = disableStarts;
    this.#sweepHighInput.disabled = disableStarts;
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

  #setVisual(state: SpeakerVisualState, label: string): void {
    this.#root.dataset.speakerVisual = state;
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
    this.#capabilityNotice.hidden = true;
    this.#capabilityNotice.removeAttribute("role");
    this.#sweepLowInput.value = String(SPEAKER_SWEEP_DEFAULT_LOW_HZ);
    this.#sweepHighInput.value = String(SPEAKER_SWEEP_DEFAULT_HIGH_HZ);
    this.#resetPhaseSelection();
    this.#setControlsActive(false);
    this.#setVisual("idle", "Ready");
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
