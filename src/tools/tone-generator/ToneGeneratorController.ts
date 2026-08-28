import {
  AudioOutputEngine,
  type OscillatorPlayback,
  type StereoChannelMode,
} from "../../browser/audio-output/AudioOutputEngine";
import { AudioSession } from "../../browser/audio-session/AudioSession";
import { frequencyToSliderPosition } from "../../components/controls/controlMath";
import { clamp, getEffectiveMaxFrequency } from "../../utils/audio";
import {
  ToneWaveformRenderer,
  type ToneWaveform,
} from "./ToneWaveformRenderer";

const TONE_MIN_HZ = 20;
const TONE_NOMINAL_MAX_HZ = 20_000;
const TONE_DEFAULT_HZ = 440;
const TONE_MIN_LEVEL_DB = -60;
const TONE_MAX_LEVEL_DB = -12;
const TONE_DEFAULT_LEVEL_DB = -24;

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Tone Generator is missing required element: ${selector}`);
  }
  return element;
}

function parseWaveform(value: string | undefined): ToneWaveform | null {
  switch (value) {
    case "sine":
    case "square":
    case "triangle":
    case "sawtooth":
      return value;
    default:
      return null;
  }
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

export class ToneGeneratorController {
  readonly #root: HTMLElement;
  readonly #session = new AudioSession();
  readonly #listeners = new AbortController();
  readonly #visual: ToneWaveformRenderer;
  readonly #frequencyRoot: HTMLElement;
  readonly #frequencyNumber: HTMLInputElement;
  readonly #frequencySlider: HTMLInputElement;
  readonly #levelInput: HTMLInputElement;
  readonly #playButton: HTMLButtonElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #capabilityNotice: HTMLElement;
  readonly #capabilityMessage: HTMLElement;
  readonly #errorMessage: HTMLElement;
  readonly #frequencyReadoutValue: HTMLElement;
  readonly #presetButtons: readonly HTMLButtonElement[];

  #engine: AudioOutputEngine | null = null;
  #playback: OscillatorPlayback | null = null;
  #frequencyHz = TONE_DEFAULT_HZ;
  #effectiveMaxHz = TONE_NOMINAL_MAX_HZ;
  #waveform: ToneWaveform = "sine";
  #channelMode: StereoChannelMode = "both";
  #levelDb = TONE_DEFAULT_LEVEL_DB;
  #disposed = false;
  #starting = false;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#frequencyRoot = requireElement(root, "[data-frequency-control]");
    this.#frequencyNumber = requireElement(root, "#tone-frequency-number");
    this.#frequencySlider = requireElement(root, "#tone-frequency-slider");
    this.#levelInput = requireElement(root, "#tone-level");
    this.#playButton = requireElement(root, "#tone-play-stop");
    this.#status = requireElement(root, "#tone-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#capabilityNotice = requireElement(root, "#tone-frequency-cap");
    this.#capabilityMessage = requireElement(
      this.#capabilityNotice,
      "[data-capability-message]",
    );
    this.#errorMessage = requireElement(root, "[data-tone-error]");
    this.#frequencyReadoutValue = requireElement(
      root,
      "#tone-frequency-readout [data-metric-value]",
    );
    this.#presetButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-tone-preset]"),
    ];
    const canvas = requireElement<HTMLCanvasElement>(
      root,
      "[data-tone-waveform]",
    );
    this.#visual = new ToneWaveformRenderer(canvas);

    this.#hydrateRestoredControls();
    this.#resetIdleUi();
    this.#bindEvents();
    this.#renderState();
  }

  get isPlaying(): boolean {
    return this.#playback !== null;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.abort();
    this.#visual.dispose();
    this.#playback = null;
    this.#engine = null;
    await this.#session.dispose();
  }

  #hydrateRestoredControls(): void {
    this.#effectiveMaxHz = TONE_NOMINAL_MAX_HZ;
    this.#frequencyRoot.dataset.maxHz = String(TONE_NOMINAL_MAX_HZ);
    this.#frequencyNumber.max = String(TONE_NOMINAL_MAX_HZ);

    const restoredFrequencyRaw = this.#frequencyNumber.value.trim();
    if (restoredFrequencyRaw !== "") {
      const restoredFrequency = Number(restoredFrequencyRaw);
      if (Number.isFinite(restoredFrequency)) {
        this.#frequencyHz = Math.round(
          clamp(restoredFrequency, TONE_MIN_HZ, TONE_NOMINAL_MAX_HZ),
        );
      }
    }

    const restoredLevel = Number(this.#levelInput.value);
    if (Number.isFinite(restoredLevel)) {
      this.#levelDb = clamp(
        restoredLevel,
        TONE_MIN_LEVEL_DB,
        TONE_MAX_LEVEL_DB,
      );
    }

    const restoredWaveform = parseWaveform(
      this.#root.querySelector<HTMLInputElement>(
        'input[name="tone-waveform"]:checked',
      )?.value,
    );
    if (restoredWaveform) this.#waveform = restoredWaveform;

    const restoredChannel = parseChannelMode(
      this.#root.querySelector<HTMLInputElement>(
        'input[name="tone-channel"]:checked',
      )?.value,
    );
    if (restoredChannel) this.#channelMode = restoredChannel;

    for (const button of this.#presetButtons) button.disabled = false;
    this.#capabilityNotice.hidden = true;
    this.#capabilityNotice.removeAttribute("role");
    this.#setFrequency(this.#frequencyHz);
  }

  #resetIdleUi(): void {
    this.#playButton.disabled = false;
    this.#setStatus("idle", "Idle");
    this.#hideError();
  }

  #bindEvents(): void {
    const signal = this.#listeners.signal;

    this.#frequencyNumber.addEventListener(
      "input",
      () => this.#applyEditableFrequency(),
      { signal },
    );

    this.#frequencyNumber.addEventListener(
      "change",
      () => this.#commitEditableFrequency(),
      { signal },
    );

    this.#levelInput.addEventListener(
      "input",
      () => {
        const levelDb = Number(this.#levelInput.value);
        if (!Number.isFinite(levelDb)) return;
        this.#levelDb = levelDb;
        this.#engine?.setLevelDb(levelDb);
      },
      { signal },
    );

    for (const radio of this.#root.querySelectorAll<HTMLInputElement>(
      'input[name="tone-waveform"]',
    )) {
      radio.addEventListener(
        "change",
        () => {
          if (!radio.checked) return;
          const waveform = parseWaveform(radio.value);
          if (!waveform) return;
          this.#waveform = waveform;
          this.#playback?.setWaveform(this.#waveform);
          this.#renderVisual();
        },
        { signal },
      );
    }

    for (const radio of this.#root.querySelectorAll<HTMLInputElement>(
      'input[name="tone-channel"]',
    )) {
      radio.addEventListener(
        "change",
        () => {
          if (!radio.checked) return;
          const channelMode = parseChannelMode(radio.value);
          if (!channelMode) return;
          this.#channelMode = channelMode;
          this.#playback?.setChannelMode(this.#channelMode);
        },
        { signal },
      );
    }

    for (const button of this.#presetButtons) {
      button.addEventListener(
        "click",
        () => {
          const frequencyHz = Number(button.dataset.tonePreset);
          if (Number.isFinite(frequencyHz)) this.#setFrequency(frequencyHz);
        },
        { signal },
      );
    }

    this.#playButton.addEventListener(
      "click",
      () => {
        if (this.#playback) this.#stopPlayback();
        else void this.#startPlayback();
      },
      { signal },
    );
  }

  #applyEditableFrequency(): void {
    const rawValue = this.#frequencyNumber.value.trim();
    if (rawValue === "") return;

    const frequencyHz = Number(rawValue);
    if (
      !Number.isFinite(frequencyHz) ||
      frequencyHz < TONE_MIN_HZ ||
      frequencyHz > this.#effectiveMaxHz
    ) {
      return;
    }

    this.#applyFrequency(frequencyHz, false);
  }

  #commitEditableFrequency(): void {
    const rawValue = this.#frequencyNumber.value.trim();
    if (rawValue === "") {
      this.#setFrequency(this.#frequencyHz);
      return;
    }

    const frequencyHz = Number(rawValue);
    if (!Number.isFinite(frequencyHz)) {
      this.#setFrequency(this.#frequencyHz);
      return;
    }

    this.#setFrequency(frequencyHz);
  }

  async #startPlayback(): Promise<void> {
    if (this.#disposed || this.#starting || this.#playback) return;
    this.#starting = true;
    this.#playButton.disabled = true;
    this.#hideError();
    this.#setStatus("ready", "Starting audio…");

    try {
      const context = await this.#session.getContext();
      if (this.#disposed) return;

      this.#applyFrequencyCapability(context.sampleRate);

      if (!this.#engine) {
        this.#engine = new AudioOutputEngine(context, {
          levelProfile: "general",
        });
        this.#session.register(this.#engine);
      }

      this.#engine.setLevelDb(this.#levelDb);
      this.#playback = this.#engine.startOscillator({
        frequencyHz: this.#frequencyHz,
        waveform: this.#waveform,
        channelMode: this.#channelMode,
      });
      this.#setStatus("playing", "Playing");
      this.#renderState();
    } catch (error) {
      console.error("Tone Generator playback failed", error);
      this.#setStatus("error", "Audio unavailable");
      this.#showError(
        "Audio playback could not start. Check that your browser allows Web Audio and that an output device is available, then try again.",
      );
    } finally {
      this.#starting = false;
      if (!this.#disposed) this.#playButton.disabled = false;
    }
  }

  #stopPlayback(): void {
    if (!this.#playback) return;
    this.#playback.stop();
    this.#playback = null;
    this.#setStatus("idle", "Idle");
    this.#renderState();
  }

  #setFrequency(requestedHz: number): void {
    this.#applyFrequency(requestedHz, true);
  }

  #applyFrequency(requestedHz: number, writeInput: boolean): void {
    const frequencyHz = Math.round(
      clamp(requestedHz, TONE_MIN_HZ, this.#effectiveMaxHz),
    );
    this.#frequencyHz = frequencyHz;
    if (writeInput) this.#frequencyNumber.value = String(frequencyHz);
    this.#frequencySlider.value = String(
      frequencyToSliderPosition(frequencyHz, TONE_MIN_HZ, this.#effectiveMaxHz),
    );
    this.#frequencyReadoutValue.textContent = frequencyHz.toLocaleString();
    this.#playback?.setFrequency(frequencyHz);
    this.#renderVisual();
  }

  #applyFrequencyCapability(sampleRate: number): void {
    this.#effectiveMaxHz = getEffectiveMaxFrequency(
      sampleRate,
      TONE_NOMINAL_MAX_HZ,
    );
    this.#frequencyRoot.dataset.maxHz = String(this.#effectiveMaxHz);
    this.#frequencyNumber.max = String(this.#effectiveMaxHz);

    for (const button of this.#presetButtons) {
      const presetHz = Number(button.dataset.tonePreset);
      button.disabled =
        Number.isFinite(presetHz) && presetHz > this.#effectiveMaxHz;
    }

    if (this.#effectiveMaxHz < TONE_NOMINAL_MAX_HZ) {
      this.#capabilityMessage.textContent = `This audio context supports generated tones up to ${this.#effectiveMaxHz.toLocaleString()} Hz. The frequency control has been capped below Nyquist.`;
      this.#capabilityNotice.hidden = false;
      this.#capabilityNotice.setAttribute("role", "status");
    } else {
      this.#capabilityNotice.hidden = true;
      this.#capabilityNotice.removeAttribute("role");
    }

    this.#setFrequency(this.#frequencyHz);
  }

  #setStatus(state: string, label: string): void {
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
  }

  #renderState(): void {
    const playing = this.#playback !== null;
    this.#playButton.dataset.action = playing ? "stop" : "play";
    const label = requireElement<HTMLElement>(this.#playButton, "span");
    const icon = requireElement<HTMLElement>(this.#playButton, "i");
    label.textContent = playing ? "Stop" : "Play";
    icon.className = playing ? "ph ph-stop" : "ph ph-play";
    this.#renderVisual();
  }

  #renderVisual(): void {
    this.#visual.setState({
      waveform: this.#waveform,
      frequencyHz: this.#frequencyHz,
      active: this.#playback !== null,
    });
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
