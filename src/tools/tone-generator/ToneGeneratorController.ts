import {
  AudioOutputEngine,
  type OscillatorPlayback,
  type StereoChannelMode,
} from "../../browser/audio-output/AudioOutputEngine";
import { AudioSession } from "../../browser/audio-session/AudioSession";
import { frequencyToSliderPosition } from "../../components/controls/controlMath";
import { getEffectiveMaxFrequency } from "../../utils/audio";
import {
  ToneWaveformRenderer,
  type ToneWaveform,
} from "./ToneWaveformRenderer";

const TONE_MIN_HZ = 20;
const TONE_NOMINAL_MAX_HZ = 20_000;
const TONE_DEFAULT_HZ = 440;
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
  readonly #frequencyReadout: HTMLElement;
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
    this.#frequencyReadout = requireElement(root, "[data-tone-frequency-readout]");
    this.#presetButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-tone-preset]"),
    ];
    const canvas = requireElement<HTMLCanvasElement>(root, "[data-tone-waveform]");
    this.#visual = new ToneWaveformRenderer(canvas);

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

  #bindEvents(): void {
    const signal = this.#listeners.signal;

    this.#frequencyNumber.addEventListener(
      "input",
      () => {
        const frequencyHz = Number(this.#frequencyNumber.value);
        if (Number.isFinite(frequencyHz)) this.#setFrequency(frequencyHz);
      },
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
          this.#waveform = radio.value as ToneWaveform;
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
          this.#channelMode = radio.value as StereoChannelMode;
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
        this.#engine = new AudioOutputEngine(context, { levelProfile: "general" });
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
    const frequencyHz = Math.round(
      Math.min(this.#effectiveMaxHz, Math.max(TONE_MIN_HZ, requestedHz)),
    );
    this.#frequencyHz = frequencyHz;
    this.#frequencyNumber.value = String(frequencyHz);
    this.#frequencySlider.value = String(
      frequencyToSliderPosition(
        frequencyHz,
        TONE_MIN_HZ,
        this.#effectiveMaxHz,
      ),
    );
    this.#frequencyReadout.textContent = `${frequencyHz.toLocaleString()} Hz`;
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
      button.disabled = Number.isFinite(presetHz) && presetHz > this.#effectiveMaxHz;
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
