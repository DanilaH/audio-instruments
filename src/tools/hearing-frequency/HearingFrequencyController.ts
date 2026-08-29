import {
  AudioOutputEngine,
  type MonoOscillatorPlayback,
} from "../../browser/audio-output/AudioOutputEngine";
import { AudioSession } from "../../browser/audio-session/AudioSession";
import { DEFAULT_RAMP_SECONDS } from "../../utils/audio";
import {
  HEARING_GUIDED_LEVEL_DB,
  HEARING_MANUAL_LEVEL_MAX_DB,
  HEARING_MANUAL_LEVEL_MIN_DB,
  HEARING_REFERENCE_DURATION_SECONDS,
  HEARING_REFERENCE_FREQUENCY_HZ,
  HEARING_TONE_DURATION_SECONDS,
  formatHearingFrequency,
  getHearingCapability,
  nextGuidedFrequency,
  recordHeardFrequency,
  type HearingCapability,
} from "./hearingTestModel";

type HearingMode = "guided" | "manual";
type ToneKind = "reference" | "guided" | "manual";

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Hearing Frequency Test is missing required element: ${selector}`);
  }
  return element;
}

function requireElements<T extends Element>(
  root: ParentNode,
  selector: string,
): readonly T[] {
  const elements = [...root.querySelectorAll<T>(selector)];
  if (elements.length === 0) {
    throw new Error(
      `Hearing Frequency Test is missing required elements: ${selector}`,
    );
  }
  return elements;
}

export class HearingFrequencyController {
  readonly #root: HTMLElement;
  readonly #listeners = new AbortController();
  readonly #modeInputs: readonly HTMLInputElement[];
  readonly #guidedPanel: HTMLElement;
  readonly #manualPanel: HTMLElement;
  readonly #referenceButton: HTMLButtonElement;
  readonly #setupConfirm: HTMLInputElement;
  readonly #guidedStartButton: HTMLButtonElement;
  readonly #heardButton: HTMLButtonElement;
  readonly #notHeardButton: HTMLButtonElement;
  readonly #stopButton: HTMLButtonElement;
  readonly #manualFrequency: HTMLSelectElement;
  readonly #manualLevel: HTMLInputElement;
  readonly #manualPlayButton: HTMLButtonElement;
  readonly #setupStatus: HTMLElement;
  readonly #currentFrequency: HTMLElement;
  readonly #guidedProgress: HTMLElement;
  readonly #answerPanel: HTMLElement;
  readonly #resultValue: HTMLElement;
  readonly #manualStatus: HTMLElement;
  readonly #capabilityNotice: HTMLElement;
  readonly #capabilityMessage: HTMLElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #errorMessage: HTMLElement;

  #session: AudioSession | null = null;
  #output: AudioOutputEngine | null = null;
  #context: AudioContext | null = null;
  #capability: HearingCapability | null = null;
  #playback: MonoOscillatorPlayback | null = null;
  #playbackStartTime: number | null = null;
  #toneTimer: number | null = null;
  #mode: HearingMode = "guided";
  #toneKind: ToneKind | null = null;
  #referencePlayed = false;
  #guidedActive = false;
  #awaitingAnswer = false;
  #guidedIndex = 0;
  #highestHeardHz: number | null = null;
  #disposed = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#modeInputs = requireElements(root, 'input[name="hearing-mode"]');
    this.#guidedPanel = requireElement(root, "[data-hearing-guided-panel]");
    this.#manualPanel = requireElement(root, "[data-hearing-manual-panel]");
    this.#referenceButton = requireElement(root, "[data-hearing-reference]");
    this.#setupConfirm = requireElement(root, "[data-hearing-setup-confirm]");
    this.#guidedStartButton = requireElement(root, "[data-hearing-guided-start]");
    this.#heardButton = requireElement(root, "[data-hearing-heard]");
    this.#notHeardButton = requireElement(root, "[data-hearing-not-heard]");
    this.#stopButton = requireElement(root, "[data-hearing-stop]");
    this.#manualFrequency = requireElement(root, "[data-hearing-manual-frequency]");
    this.#manualLevel = requireElement(root, "#hearing-manual-level");
    this.#manualPlayButton = requireElement(root, "[data-hearing-manual-play]");
    this.#setupStatus = requireElement(root, "[data-hearing-setup-status]");
    this.#currentFrequency = requireElement(root, "[data-hearing-current-frequency]");
    this.#guidedProgress = requireElement(root, "[data-hearing-progress]");
    this.#answerPanel = requireElement(root, "[data-hearing-answer-panel]");
    this.#resultValue = requireElement(root, "[data-hearing-result]");
    this.#manualStatus = requireElement(root, "[data-hearing-manual-status]");
    this.#capabilityNotice = requireElement(root, "#hearing-frequency-cap");
    this.#capabilityMessage = requireElement(
      this.#capabilityNotice,
      "[data-capability-message]",
    );
    this.#status = requireElement(root, "#hearing-frequency-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#errorMessage = requireElement(root, "[data-hearing-error]");

    this.#bindEvents();
    this.#renderSessionResult();
    this.#renderControls();
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.abort();
    this.#runToken += 1;
    this.#cancelTone();
    this.#guidedActive = false;
    this.#awaitingAnswer = false;

    const session = this.#session;
    this.#session = null;
    this.#output = null;
    this.#context = null;
    if (session) await session.dispose();
  }

  #isToneBusy(): boolean {
    return this.#playback !== null || this.#toneKind !== null;
  }

  #bindEvents(): void {
    const signal = this.#listeners.signal;

    for (const input of this.#modeInputs) {
      input.addEventListener(
        "change",
        () => {
          if (!input.checked) return;
          this.#mode = input.value === "manual" ? "manual" : "guided";
          this.#hideError();
          this.#renderControls();
        },
        { signal },
      );
    }

    this.#referenceButton.addEventListener(
      "click",
      () => void this.#playReference(),
      { signal },
    );
    this.#setupConfirm.addEventListener("change", () => this.#renderControls(), {
      signal,
    });
    this.#guidedStartButton.addEventListener(
      "click",
      () => void this.#startGuided(),
      { signal },
    );
    this.#heardButton.addEventListener("click", () => this.#answerGuided(true), {
      signal,
    });
    this.#notHeardButton.addEventListener(
      "click",
      () => this.#answerGuided(false),
      { signal },
    );
    this.#stopButton.addEventListener(
      "click",
      () => this.#stopActive("Stopped"),
      { signal },
    );
    this.#manualPlayButton.addEventListener(
      "click",
      () => void this.#playManual(),
      { signal },
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden && (this.#isToneBusy() || this.#guidedActive)) {
          this.#stopActive("Stopped while tab was hidden");
        }
      },
      { signal },
    );
  }

  async #ensureAudio(token: number): Promise<{
    context: AudioContext;
    output: AudioOutputEngine;
  }> {
    if (this.#session && this.#context && this.#output) {
      const context = await this.#session.getContext();
      return { context, output: this.#output };
    }

    const session = new AudioSession();
    try {
      const context = await session.getContext();
      const output = new AudioOutputEngine(context, { levelProfile: "hearing" });
      session.register(output);

      if (!this.#isCurrent(token)) {
        await session.dispose();
        throw new DOMException(
          "Hearing Frequency Test Start was superseded",
          "AbortError",
        );
      }

      this.#session = session;
      this.#context = context;
      this.#output = output;
      this.#applyCapability(getHearingCapability(context.sampleRate));
      return { context, output };
    } catch (error) {
      await session.dispose().catch((disposeError) => {
        console.error("Hearing Frequency Test cleanup failed", disposeError);
      });
      throw error;
    }
  }

  async #playReference(): Promise<void> {
    if (this.#disposed || this.#isToneBusy() || this.#guidedActive) return;

    this.#referencePlayed = false;
    this.#setupConfirm.checked = false;
    this.#setupStatus.textContent =
      "While the 1-second reference is audible, set system/device volume to a low comfortable level. Replay the reference if you need another adjustment pass.";
    this.#renderControls();

    const played = await this.#playTone({
      frequencyHz: HEARING_REFERENCE_FREQUENCY_HZ,
      durationSeconds: HEARING_REFERENCE_DURATION_SECONDS,
      levelDb: HEARING_GUIDED_LEVEL_DB,
      kind: "reference",
      playingLabel: "Playing 1 kHz setup reference",
      onComplete: () => {
        this.#referencePlayed = true;
        this.#setupStatus.textContent =
          "Reference complete. If the volume was not low and comfortable while the tone was audible, replay it. Otherwise confirm that system/device volume will remain unchanged.";
        this.#setStatus("ready", "Setup reference complete");
      },
    });

    if (!played && this.#capability?.referenceAvailable === false) {
      this.#setupStatus.textContent =
        "The current audio context cannot safely generate the 1 kHz setup reference.";
    }
  }

  async #startGuided(): Promise<void> {
    const frequencies = this.#capability?.guidedFrequenciesHz ?? [];
    if (
      this.#disposed ||
      this.#isToneBusy() ||
      this.#guidedActive ||
      !this.#referencePlayed ||
      !this.#setupConfirm.checked ||
      frequencies.length === 0
    ) {
      return;
    }

    this.#guidedActive = true;
    this.#awaitingAnswer = false;
    this.#guidedIndex = 0;
    this.#hideError();
    this.#renderControls();
    await this.#playCurrentGuidedTone();
  }

  async #playCurrentGuidedTone(): Promise<void> {
    const frequencies = this.#capability?.guidedFrequenciesHz ?? [];
    const frequencyHz = nextGuidedFrequency(frequencies, this.#guidedIndex);
    if (frequencyHz === null) {
      this.#completeGuided();
      return;
    }

    this.#currentFrequency.textContent = formatHearingFrequency(frequencyHz);
    this.#guidedProgress.textContent = `${this.#guidedIndex + 1} / ${frequencies.length}`;
    this.#awaitingAnswer = false;
    this.#renderControls();

    const played = await this.#playTone({
      frequencyHz,
      durationSeconds: HEARING_TONE_DURATION_SECONDS,
      levelDb: HEARING_GUIDED_LEVEL_DB,
      kind: "guided",
      playingLabel: `Playing ${formatHearingFrequency(frequencyHz)} guided tone`,
      onComplete: () => {
        if (!this.#guidedActive) return;
        this.#awaitingAnswer = true;
        this.#setStatus(
          "ready",
          `Did you hear ${formatHearingFrequency(frequencyHz)}?`,
        );
      },
    });

    if (!played && this.#guidedActive) {
      this.#guidedActive = false;
      this.#awaitingAnswer = false;
    }
    this.#renderControls();
  }

  #answerGuided(heard: boolean): void {
    if (!this.#guidedActive || !this.#awaitingAnswer) return;

    const frequencies = this.#capability?.guidedFrequenciesHz ?? [];
    const frequencyHz = nextGuidedFrequency(frequencies, this.#guidedIndex);
    if (frequencyHz === null) {
      this.#completeGuided();
      return;
    }

    if (heard) {
      this.#highestHeardHz = recordHeardFrequency(
        this.#highestHeardHz,
        frequencyHz,
      );
      this.#renderSessionResult();
    }

    this.#awaitingAnswer = false;
    this.#guidedIndex += 1;
    this.#renderControls();
    void this.#playCurrentGuidedTone();
  }

  #completeGuided(): void {
    this.#guidedActive = false;
    this.#awaitingAnswer = false;
    this.#guidedProgress.textContent = "Complete";
    this.#currentFrequency.textContent = "—";
    this.#setStatus("idle", "Guided session complete");
    this.#renderSessionResult();
    this.#renderControls();
  }

  async #playManual(): Promise<void> {
    if (
      this.#disposed ||
      this.#mode !== "manual" ||
      this.#isToneBusy() ||
      this.#guidedActive ||
      !this.#referencePlayed ||
      !this.#setupConfirm.checked
    ) {
      return;
    }

    const frequencyHz = Number(this.#manualFrequency.value);
    const levelDb = Math.min(
      HEARING_MANUAL_LEVEL_MAX_DB,
      Math.max(HEARING_MANUAL_LEVEL_MIN_DB, Number(this.#manualLevel.value)),
    );
    this.#manualLevel.value = String(levelDb);

    await this.#playTone({
      frequencyHz,
      durationSeconds: HEARING_TONE_DURATION_SECONDS,
      levelDb,
      kind: "manual",
      playingLabel: `Playing ${formatHearingFrequency(frequencyHz)} manual tone`,
      onComplete: () => {
        this.#manualStatus.textContent =
          `${formatHearingFrequency(frequencyHz)} manual tone complete at ${levelDb} dB relative to unity. Manual observations do not change the Guided result.`;
        this.#setStatus("idle", "Manual tone complete");
      },
    });
  }

  async #playTone(options: {
    readonly frequencyHz: number;
    readonly durationSeconds: number;
    readonly levelDb: number;
    readonly kind: ToneKind;
    readonly playingLabel: string;
    readonly onComplete: () => void;
  }): Promise<boolean> {
    if (this.#isToneBusy() || this.#disposed) return false;

    const token = ++this.#runToken;
    this.#toneKind = options.kind;
    this.#hideError();
    this.#setStatus("ready", "Preparing tone…");
    this.#renderControls();

    try {
      const { context, output } = await this.#ensureAudio(token);
      if (!this.#isCurrent(token)) return false;

      const capability = this.#capability;
      if (!capability || options.frequencyHz > capability.effectiveMaxHz) {
        this.#toneKind = null;
        this.#setStatus("limited_capability", "Frequency unavailable");
        this.#showError(
          "That frequency is above the safe generated-frequency limit for this audio context. It is unavailable, not a hearing result.",
        );
        this.#renderControls();
        return false;
      }

      output.setLevelDb(options.levelDb);
      const startTime = context.currentTime + DEFAULT_RAMP_SECONDS;
      this.#playback = output.startMonoOscillator({
        frequencyHz: options.frequencyHz,
        waveform: "sine",
        startTime,
        durationSeconds: options.durationSeconds,
      });
      this.#playbackStartTime = startTime;
      this.#setStatus("playing", options.playingLabel);
      this.#renderControls();

      const completionDelayMs =
        (DEFAULT_RAMP_SECONDS + options.durationSeconds) * 1_000 + 25;
      this.#toneTimer = window.setTimeout(() => {
        if (!this.#isCurrent(token)) return;
        this.#toneTimer = null;
        this.#playback = null;
        this.#playbackStartTime = null;
        this.#toneKind = null;
        options.onComplete();
        this.#renderControls();
      }, completionDelayMs);
      return true;
    } catch (error) {
      if (!this.#isCurrent(token)) return false;
      this.#playback = null;
      this.#playbackStartTime = null;
      this.#toneKind = null;
      console.error("Hearing Frequency Test tone failed", error);
      this.#setStatus("error", "Audio output unavailable");
      this.#showError(
        "The browser could not play the requested tone. Check audio output availability and try again.",
      );
      this.#renderControls();
      return false;
    }
  }

  #cancelTone(): void {
    if (this.#toneTimer !== null) {
      window.clearTimeout(this.#toneTimer);
      this.#toneTimer = null;
    }

    const playback = this.#playback;
    const context = this.#context;
    const startTime = this.#playbackStartTime;
    if (playback) {
      try {
        const now = context?.currentTime ?? 0;
        if (context && startTime !== null && startTime > now) {
          playback.stop();
          playback.oscillator.stop(now);
        } else {
          playback.stop();
        }
      } catch (error) {
        console.warn("Hearing Frequency Test tone cancellation failed", error);
      }
    }

    this.#playback = null;
    this.#playbackStartTime = null;
    this.#toneKind = null;
  }

  #stopActive(label: string): void {
    if (this.#disposed || (!this.#isToneBusy() && !this.#guidedActive)) return;
    this.#runToken += 1;
    this.#cancelTone();
    this.#guidedActive = false;
    this.#awaitingAnswer = false;
    this.#guidedIndex = 0;
    this.#currentFrequency.textContent = "—";
    this.#guidedProgress.textContent = "Not started";
    this.#setStatus("idle", label);
    this.#renderControls();
  }

  #applyCapability(capability: HearingCapability): void {
    this.#capability = capability;

    for (const option of this.#manualFrequency.options) {
      const frequencyHz = Number(option.value);
      option.disabled = frequencyHz > capability.effectiveMaxHz;
    }

    if (
      this.#manualFrequency.selectedOptions[0]?.disabled ||
      !this.#manualFrequency.value
    ) {
      const firstAvailable = [...this.#manualFrequency.options].find(
        (option) => !option.disabled,
      );
      this.#manualFrequency.value = firstAvailable?.value ?? "";
    }

    if (capability.limited) {
      this.#capabilityNotice.hidden = false;
      this.#capabilityMessage.textContent =
        `This browser/audio context supports generated tones up to approximately ${formatHearingFrequency(capability.effectiveMaxHz)} in this session. Higher guided steps are unavailable and are not hearing results.`;
    } else {
      this.#capabilityNotice.hidden = true;
      this.#capabilityMessage.textContent = "";
    }

    if (!capability.referenceAvailable) {
      this.#capabilityNotice.hidden = false;
      this.#capabilityMessage.textContent =
        "This audio context cannot safely generate the required 1 kHz setup reference, so Guided and Manual high-frequency playback are unavailable in this session.";
    }
    this.#renderControls();
  }

  #renderSessionResult(): void {
    this.#resultValue.textContent =
      this.#highestHeardHz === null
        ? "—"
        : formatHearingFrequency(this.#highestHeardHz);
  }

  #renderControls(): void {
    const playing = this.#isToneBusy();
    const guidedFrequencies = this.#capability?.guidedFrequenciesHz ?? [];
    const referenceAvailable = this.#capability?.referenceAvailable !== false;
    const setupReady = this.#referencePlayed && this.#setupConfirm.checked;
    const lockMode = playing || this.#guidedActive;

    for (const input of this.#modeInputs) input.disabled = lockMode;
    this.#guidedPanel.hidden = this.#mode !== "guided";
    this.#manualPanel.hidden = this.#mode !== "manual";

    this.#referenceButton.disabled =
      this.#disposed || playing || this.#guidedActive || !referenceAvailable;
    this.#setupConfirm.disabled =
      this.#disposed || !this.#referencePlayed || playing || this.#guidedActive;
    this.#guidedStartButton.disabled =
      this.#disposed ||
      playing ||
      this.#guidedActive ||
      !setupReady ||
      (this.#capability !== null && guidedFrequencies.length === 0);
    this.#heardButton.disabled = !this.#guidedActive || !this.#awaitingAnswer;
    this.#notHeardButton.disabled = !this.#guidedActive || !this.#awaitingAnswer;
    this.#answerPanel.hidden = !this.#guidedActive || !this.#awaitingAnswer;
    this.#stopButton.disabled = !playing && !this.#guidedActive;

    const manualDisabled =
      this.#disposed || this.#mode !== "manual" || playing || this.#guidedActive;
    this.#manualFrequency.disabled = manualDisabled;
    this.#manualLevel.disabled = manualDisabled;
    this.#manualPlayButton.disabled =
      manualDisabled || !setupReady || this.#manualFrequency.value === "";

    this.#root.dataset.hearingMode = this.#mode;
    this.#root.dataset.hearingState = playing
      ? "playing"
      : this.#guidedActive
        ? "listening"
        : "idle";
  }

  #setStatus(state: string, label: string): void {
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
  }

  #hideError(): void {
    this.#errorMessage.hidden = true;
    this.#errorMessage.textContent = "";
  }

  #showError(message: string): void {
    this.#errorMessage.textContent = message;
    this.#errorMessage.hidden = false;
  }

  #isCurrent(token: number): boolean {
    return !this.#disposed && token === this.#runToken;
  }
}
