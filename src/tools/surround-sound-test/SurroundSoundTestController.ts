import {
  AudioOutputEngine,
  type OscillatorPlayback,
  type PannedOscillatorPlayback,
  type StereoChannelMode,
} from "../../browser/audio-output/AudioOutputEngine";
import {
  CHANNEL_SEQUENCE_STEP_SECONDS,
  CHANNEL_TEST_DURATION_SECONDS,
  CHANNEL_TEST_FREQUENCY_HZ,
} from "../../browser/audio-output/referenceSignals";
import { AudioSession } from "../../browser/audio-session/AudioSession";
import {
  MultichannelOutputSession,
  type MultichannelBurstPlayback,
  type MultichannelMode,
} from "../../browser/multichannel/MultichannelOutputSession";
import { DEFAULT_RAMP_SECONDS, clamp } from "../../utils/audio";

const LFE_TEST_FREQUENCY_HZ = 80;
const GENERAL_LEVEL_MIN_DB = -60;
const GENERAL_LEVEL_MAX_DB = -12;
const GENERAL_LEVEL_DEFAULT_DB = -24;
const STEREO_PAN_SECONDS = 4;
const MILLISECONDS_PER_SECOND = 1_000;
const TRANSITION_WAIT_MS =
  Math.ceil(DEFAULT_RAMP_SECONDS * MILLISECONDS_PER_SECOND) + 5;

type SurroundMode = MultichannelMode | "stereo-preview" | "unknown";
type StereoAction =
  | "left"
  | "center"
  | "right"
  | "left-to-right"
  | "right-to-left";
type CapabilityState =
  | "unavailable"
  | "candidate"
  | "confirmed"
  | "unsupported";

type SurroundCapabilities = {
  readonly maxChannelCount: number;
  fiveOne: CapabilityState;
  experimentalEight: CapabilityState;
};

type ChannelDefinition = {
  readonly index: number;
  readonly label: string;
  readonly frequencyHz: number;
};

const FIVE_ONE_CHANNELS: readonly ChannelDefinition[] = [
  { index: 0, label: "Front Left", frequencyHz: CHANNEL_TEST_FREQUENCY_HZ },
  { index: 1, label: "Front Right", frequencyHz: CHANNEL_TEST_FREQUENCY_HZ },
  { index: 2, label: "Center", frequencyHz: CHANNEL_TEST_FREQUENCY_HZ },
  { index: 3, label: "LFE", frequencyHz: LFE_TEST_FREQUENCY_HZ },
  { index: 4, label: "Surround Left", frequencyHz: CHANNEL_TEST_FREQUENCY_HZ },
  { index: 5, label: "Surround Right", frequencyHz: CHANNEL_TEST_FREQUENCY_HZ },
];

const EIGHT_CHANNELS: readonly ChannelDefinition[] = Array.from(
  { length: 8 },
  (_, index) => ({
    index,
    label: `Channel ${index + 1}`,
    frequencyHz: CHANNEL_TEST_FREQUENCY_HZ,
  }),
);

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Surround Sound Test is missing required element: ${selector}`);
  }
  return element;
}

function parseMode(value: string | undefined): SurroundMode | null {
  switch (value) {
    case "five-one":
    case "experimental-eight":
    case "stereo-preview":
      return value;
    default:
      return null;
  }
}

function stereoActionLabel(action: StereoAction): string {
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

function stereoChannelMode(
  action: "left" | "center" | "right",
): StereoChannelMode {
  return action === "center" ? "both" : action;
}

function modeReadyLabel(mode: SurroundMode): string {
  switch (mode) {
    case "five-one":
      return "5.1 ready";
    case "experimental-eight":
      return "Experimental 8-channel ready";
    case "stereo-preview":
      return "Stereo spatial preview ready";
    case "unknown":
      return "Capability not checked";
  }
}

function modeVisualLabel(mode: SurroundMode): string {
  switch (mode) {
    case "five-one":
      return "5.1";
    case "experimental-eight":
      return "Experimental 8-channel";
    case "stereo-preview":
      return "Stereo spatial preview";
    case "unknown":
      return "Not checked";
  }
}

function isSelectableCapability(state: CapabilityState): boolean {
  return state === "candidate" || state === "confirmed";
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export class SurroundSoundTestController {
  readonly #root: HTMLElement;
  readonly #listeners = new AbortController();
  readonly #checkButton: HTMLButtonElement;
  readonly #modeButtons: readonly HTMLButtonElement[];
  readonly #fiveOneButtons: readonly HTMLButtonElement[];
  readonly #fiveOneAllButton: HTMLButtonElement;
  readonly #eightButtons: readonly HTMLButtonElement[];
  readonly #eightAllButton: HTMLButtonElement;
  readonly #stereoButtons: readonly HTMLButtonElement[];
  readonly #stopButton: HTMLButtonElement;
  readonly #levelInput: HTMLInputElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #capabilitySummary: HTMLElement;
  readonly #visualLabel: HTMLElement;
  readonly #errorMessage: HTMLElement;
  readonly #modeSelector: HTMLElement;
  readonly #panels: readonly HTMLElement[];
  readonly #timers = new Set<number>();

  #session = new AudioSession();
  #multichannel: MultichannelOutputSession | null = null;
  #stereoEngine: AudioOutputEngine | null = null;
  #stereoPlayback: OscillatorPlayback | PannedOscillatorPlayback | null = null;
  #multichannelPlaybacks: MultichannelBurstPlayback[] = [];
  #capabilities: SurroundCapabilities | null = null;
  #mode: SurroundMode = "unknown";
  #levelDb = GENERAL_LEVEL_DEFAULT_DB;
  #starting = false;
  #disposed = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#checkButton = requireElement(root, "[data-surround-check]");
    this.#modeButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-surround-mode]"),
    ];
    this.#fiveOneButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-surround-51-channel]"),
    ];
    this.#fiveOneAllButton = requireElement(root, "[data-surround-51-all]");
    this.#eightButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-surround-8-channel]"),
    ];
    this.#eightAllButton = requireElement(root, "[data-surround-8-all]");
    this.#stereoButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("[data-surround-stereo]"),
    ];
    this.#stopButton = requireElement(root, "[data-surround-stop]");
    this.#levelInput = requireElement(root, "#surround-level");
    this.#status = requireElement(root, "#surround-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#capabilitySummary = requireElement(root, "[data-surround-capability]");
    this.#visualLabel = requireElement(root, "[data-surround-visual-label]");
    this.#errorMessage = requireElement(root, "[data-surround-error]");
    this.#modeSelector = requireElement(root, "[data-surround-mode-selector]");
    this.#panels = [
      ...root.querySelectorAll<HTMLElement>("[data-surround-panel]"),
    ];

    if (
      this.#modeButtons.length !== 3 ||
      this.#fiveOneButtons.length !== 6 ||
      this.#eightButtons.length !== 8 ||
      this.#stereoButtons.length !== 5 ||
      this.#panels.length !== 3
    ) {
      throw new Error("Surround Sound Test control topology is incomplete");
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
    return (
      this.#starting ||
      this.#stereoPlayback !== null ||
      this.#multichannelPlaybacks.length > 0
    );
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.abort();
    this.#runToken += 1;
    this.#clearTimers();
    this.#stereoPlayback = null;
    this.#multichannelPlaybacks = [];
    this.#multichannel = null;
    this.#stereoEngine = null;
    await this.#session.dispose();
  }

  #bindEvents(): void {
    const signal = this.#listeners.signal;
    this.#checkButton.addEventListener(
      "click",
      () => void this.#checkCapabilities(),
      { signal },
    );

    for (const button of this.#modeButtons) {
      button.addEventListener(
        "click",
        () => {
          const mode = parseMode(button.dataset.surroundMode);
          if (mode) void this.#switchMode(mode);
        },
        { signal },
      );
    }

    for (const button of this.#fiveOneButtons) {
      button.addEventListener(
        "click",
        () => {
          const index = Number(button.dataset.surround51Channel);
          if (Number.isInteger(index)) void this.#runFiveOneChannel(index);
        },
        { signal },
      );
    }
    this.#fiveOneAllButton.addEventListener(
      "click",
      () => void this.#runMultichannelSequence(FIVE_ONE_CHANNELS),
      { signal },
    );

    for (const button of this.#eightButtons) {
      button.addEventListener(
        "click",
        () => {
          const index = Number(button.dataset.surround8Channel);
          if (Number.isInteger(index)) void this.#runEightChannel(index);
        },
        { signal },
      );
    }
    this.#eightAllButton.addEventListener(
      "click",
      () => void this.#runMultichannelSequence(EIGHT_CHANNELS),
      { signal },
    );

    for (const button of this.#stereoButtons) {
      button.addEventListener(
        "click",
        () => {
          const action = button.dataset.surroundStereo as
            | StereoAction
            | undefined;
          if (!action) return;
          if (action === "left-to-right" || action === "right-to-left") {
            void this.#runStereoPan(action);
          } else {
            void this.#runStereoStatic(action);
          }
        },
        { signal },
      );
    }

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
        this.#multichannel?.setLevelDb(this.#levelDb);
        this.#stereoEngine?.setLevelDb(this.#levelDb);
      },
      { signal },
    );
  }

  async #checkCapabilities(): Promise<void> {
    if (this.#disposed || this.#starting || this.#capabilities) return;
    const token = this.#beginStart("Checking browser output capability…");

    try {
      const context = await this.#session.getContext();
      if (!this.#isCurrentRun(token)) return;

      const multichannel = new MultichannelOutputSession(context);
      multichannel.setLevelDb(this.#levelDb);
      this.#session.register(multichannel);
      this.#multichannel = multichannel;

      const candidates = multichannel.inspectCandidates();
      const capabilities: SurroundCapabilities = {
        maxChannelCount: candidates.maxChannelCount,
        fiveOne: candidates.fiveOneCandidate ? "candidate" : "unavailable",
        experimentalEight: candidates.experimentalEightCandidate
          ? "candidate"
          : "unavailable",
      };

      if (candidates.fiveOneCandidate) {
        const result = await multichannel.configure("five-one");
        if (!this.#isCurrentRun(token)) return;
        if (result.status === "restore_failed") {
          await this.#fallbackAfterRestoreFailure(
            token,
            "5.1 configuration left the destination state uncertain, so that AudioContext was closed. Stereo spatial preview is available in a fresh session; run the capability check again before retrying surround.",
          );
          return;
        }
        capabilities.fiveOne =
          result.status === "confirmed" ? "confirmed" : "unsupported";
      }

      this.#capabilities = capabilities;
      this.#mode =
        capabilities.fiveOne === "confirmed" ? "five-one" : "stereo-preview";
      this.#starting = false;
      this.#setCapabilitySummary(this.#capabilityMessage(capabilities));
      this.#renderModes();
      this.#setControlsActive(false);
      this.#setStatus("idle", modeReadyLabel(this.#mode));
    } catch (error) {
      this.#handleError(error, token);
    }
  }

  async #switchMode(mode: SurroundMode): Promise<void> {
    if (
      this.#disposed ||
      this.#starting ||
      !this.#capabilities ||
      mode === "unknown" ||
      mode === this.#mode
    ) {
      return;
    }

    if (
      mode === "five-one" &&
      this.#capabilities.fiveOne !== "confirmed"
    ) {
      return;
    }
    if (
      mode === "experimental-eight" &&
      !isSelectableCapability(this.#capabilities.experimentalEight)
    ) {
      return;
    }

    const previousMode = this.#mode;
    const token = this.#beginStart("Switching output mode…");

    try {
      if (this.#stereoPlayback) {
        this.#stereoPlayback.stop();
        this.#stereoPlayback = null;
        await sleep(TRANSITION_WAIT_MS);
      }
      this.#clearTimers();
      this.#multichannelPlaybacks = [];

      if (mode === "stereo-preview") {
        if (this.#multichannel?.activeMode) {
          const restored = await this.#multichannel.restore();
          if (!restored) {
            await this.#fallbackAfterRestoreFailure(
              token,
              "The multichannel destination could not be restored safely. That AudioContext was closed and Stereo spatial preview is now using a fresh session.",
            );
            return;
          }
        }
        if (!this.#isCurrentRun(token)) return;
        this.#mode = "stereo-preview";
      } else {
        const multichannel = this.#multichannel;
        if (!multichannel) {
          await this.#fallbackAfterRestoreFailure(
            token,
            "Multichannel state is unavailable. Stereo spatial preview is using a fresh session; run the capability check again before retrying surround.",
          );
          return;
        }

        const result = await multichannel.configure(mode);
        if (!this.#isCurrentRun(token)) return;
        if (result.status === "restore_failed") {
          await this.#fallbackAfterRestoreFailure(
            token,
            "The target multichannel mode could not be restored safely. That AudioContext was closed and Stereo spatial preview is now using a fresh session.",
          );
          return;
        }

        if (result.status === "confirmed") {
          this.#mode = mode;
          if (mode === "experimental-eight") {
            this.#capabilities.experimentalEight = "confirmed";
          } else {
            this.#capabilities.fiveOne = "confirmed";
          }
        } else {
          if (mode === "experimental-eight") {
            this.#capabilities.experimentalEight = "unsupported";
          } else {
            this.#capabilities.fiveOne = "unsupported";
          }
          await this.#restorePreviousMode(previousMode, token);
          if (!this.#isCurrentRun(token)) return;
        }
      }

      if (!this.#isCurrentRun(token)) return;
      this.#starting = false;
      this.#setCapabilitySummary(this.#capabilityMessage(this.#capabilities));
      this.#renderModes();
      this.#setControlsActive(false);
      this.#setStatus("idle", modeReadyLabel(this.#mode));
    } catch (error) {
      this.#handleError(error, token);
    }
  }

  async #restorePreviousMode(
    previousMode: SurroundMode,
    token: number,
  ): Promise<void> {
    if (previousMode === "stereo-preview" || previousMode === "unknown") {
      this.#mode = "stereo-preview";
      return;
    }

    const capabilities = this.#capabilities;
    const multichannel = this.#multichannel;
    if (!capabilities || !multichannel) {
      this.#mode = "stereo-preview";
      return;
    }

    const previouslyConfirmed =
      previousMode === "five-one"
        ? capabilities.fiveOne === "confirmed"
        : capabilities.experimentalEight === "confirmed";
    if (!previouslyConfirmed) {
      this.#mode = "stereo-preview";
      return;
    }

    const result = await multichannel.configure(previousMode);
    if (!this.#isCurrentRun(token)) return;
    if (result.status === "restore_failed") {
      await this.#fallbackAfterRestoreFailure(
        token,
        "The previous multichannel mode could not be restored safely. That AudioContext was closed and Stereo spatial preview is now using a fresh session.",
      );
      return;
    }
    if (result.status === "confirmed") {
      this.#mode = previousMode;
      return;
    }

    if (previousMode === "five-one") capabilities.fiveOne = "unsupported";
    else capabilities.experimentalEight = "unsupported";
    this.#mode = "stereo-preview";
  }

  async #runFiveOneChannel(index: number): Promise<void> {
    if (this.#mode !== "five-one" || this.isActive || this.#disposed) return;
    const channel = FIVE_ONE_CHANNELS[index];
    if (!channel) return;
    await this.#runMultichannelBurst(
      channel.index,
      channel.frequencyHz,
      channel.label,
    );
  }

  async #runEightChannel(index: number): Promise<void> {
    if (
      this.#mode !== "experimental-eight" ||
      this.isActive ||
      this.#disposed
    ) {
      return;
    }
    const channel = EIGHT_CHANNELS[index];
    if (!channel) return;
    await this.#runMultichannelBurst(
      channel.index,
      channel.frequencyHz,
      channel.label,
    );
  }

  async #runMultichannelBurst(
    channelIndex: number,
    frequencyHz: number,
    label: string,
  ): Promise<void> {
    const multichannel = this.#multichannel;
    if (!multichannel || this.isActive) return;
    const token = this.#beginStart(`Starting ${label}…`);

    try {
      const context = await this.#session.getContext();
      if (!this.#isCurrentRun(token)) return;
      const playback = multichannel.startChannel(
        channelIndex,
        frequencyHz,
        context.currentTime,
        CHANNEL_TEST_DURATION_SECONDS,
      );
      this.#multichannelPlaybacks = [playback];
      this.#starting = false;
      this.#setControlsActive(true);
      this.#setVisual(label);
      this.#setStatus("playing", `Playing ${label}`);
      this.#schedule(
        CHANNEL_TEST_DURATION_SECONDS * MILLISECONDS_PER_SECOND,
        token,
        () => this.#finishRun(),
      );
    } catch (error) {
      this.#handleError(error, token);
    }
  }

  async #runMultichannelSequence(
    channels: readonly ChannelDefinition[],
  ): Promise<void> {
    const multichannel = this.#multichannel;
    const expectedMode = channels.length === 6 ? "five-one" : "experimental-eight";
    if (
      !multichannel ||
      this.#mode !== expectedMode ||
      this.isActive ||
      this.#disposed
    ) {
      return;
    }

    const token = this.#beginStart("Starting channel sequence…");
    try {
      const context = await this.#session.getContext();
      if (!this.#isCurrentRun(token)) return;
      const startTime = context.currentTime;
      this.#multichannelPlaybacks = channels.map((channel, index) =>
        multichannel.startChannel(
          channel.index,
          channel.frequencyHz,
          startTime + index * CHANNEL_SEQUENCE_STEP_SECONDS,
          CHANNEL_TEST_DURATION_SECONDS,
        ),
      );
      this.#starting = false;
      this.#setControlsActive(true);
      this.#setStatus("playing", "Channel sequence running");

      channels.forEach((channel, index) => {
        const startMs =
          index * CHANNEL_SEQUENCE_STEP_SECONDS * MILLISECONDS_PER_SECOND;
        const gapMs =
          startMs + CHANNEL_TEST_DURATION_SECONDS * MILLISECONDS_PER_SECOND;
        this.#schedule(startMs, token, () => this.#setVisual(channel.label));
        if (index < channels.length - 1) {
          this.#schedule(gapMs, token, () => this.#setVisual("Gap"));
        }
      });

      const totalSeconds =
        (channels.length - 1) * CHANNEL_SEQUENCE_STEP_SECONDS +
        CHANNEL_TEST_DURATION_SECONDS;
      this.#schedule(
        totalSeconds * MILLISECONDS_PER_SECOND,
        token,
        () => this.#finishRun(),
      );
    } catch (error) {
      multichannel.stop();
      this.#handleError(error, token);
    }
  }

  async #getStereoEngine(): Promise<{
    context: AudioContext;
    engine: AudioOutputEngine;
  }> {
    const context = await this.#session.getContext();
    if (this.#disposed) {
      throw new Error("Surround Test was disposed before audio could start");
    }
    if (!this.#stereoEngine) {
      this.#stereoEngine = new AudioOutputEngine(context, {
        levelProfile: "general",
      });
      this.#stereoEngine.setLevelDb(this.#levelDb);
      this.#session.register(this.#stereoEngine);
    }
    return { context, engine: this.#stereoEngine };
  }

  async #runStereoStatic(
    action: "left" | "center" | "right",
  ): Promise<void> {
    if (this.#mode !== "stereo-preview" || this.isActive || this.#disposed) return;
    const token = this.#beginStart(`Starting ${stereoActionLabel(action)}…`);

    try {
      const { engine } = await this.#getStereoEngine();
      if (!this.#isCurrentRun(token)) return;
      this.#stereoPlayback = engine.startOscillator({
        frequencyHz: CHANNEL_TEST_FREQUENCY_HZ,
        waveform: "sine",
        channelMode: stereoChannelMode(action),
        durationSeconds: CHANNEL_TEST_DURATION_SECONDS,
      });
      this.#starting = false;
      this.#setControlsActive(true);
      this.#setVisual(stereoActionLabel(action));
      this.#setStatus("playing", `Playing ${stereoActionLabel(action)}`);
      this.#schedule(
        CHANNEL_TEST_DURATION_SECONDS * MILLISECONDS_PER_SECOND,
        token,
        () => this.#finishRun(),
      );
    } catch (error) {
      this.#handleError(error, token);
    }
  }

  async #runStereoPan(
    action: "left-to-right" | "right-to-left",
  ): Promise<void> {
    if (this.#mode !== "stereo-preview" || this.isActive || this.#disposed) return;
    const token = this.#beginStart(`Starting ${stereoActionLabel(action)} pan…`);

    try {
      const { context, engine } = await this.#getStereoEngine();
      if (!this.#isCurrentRun(token)) return;
      const fromPan = action === "left-to-right" ? -1 : 1;
      const startTime = context.currentTime;
      const playback = engine.startPannedOscillator(
        CHANNEL_TEST_FREQUENCY_HZ,
        fromPan,
        startTime,
        STEREO_PAN_SECONDS,
      );
      playback.schedulePanSweep(
        fromPan,
        -fromPan,
        STEREO_PAN_SECONDS,
        startTime,
      );
      this.#stereoPlayback = playback;
      this.#starting = false;
      this.#setControlsActive(true);
      this.#setVisual(stereoActionLabel(action));
      this.#setStatus("playing", `Panning ${stereoActionLabel(action)}`);
      this.#schedule(
        STEREO_PAN_SECONDS * MILLISECONDS_PER_SECOND,
        token,
        () => this.#finishRun(),
      );
    } catch (error) {
      this.#handleError(error, token);
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

  #stopCurrent(label: string): void {
    if (!this.isActive) return;
    this.#runToken += 1;
    this.#starting = false;
    this.#clearTimers();
    this.#stereoPlayback?.stop();
    this.#stereoPlayback = null;
    this.#multichannel?.stop();
    this.#multichannelPlaybacks = [];
    this.#setControlsActive(false);
    this.#setVisual(modeVisualLabel(this.#mode));
    this.#setStatus("idle", label);
  }

  #finishRun(): void {
    this.#clearTimers();
    this.#starting = false;
    this.#stereoPlayback = null;
    this.#multichannelPlaybacks = [];
    this.#setControlsActive(false);
    this.#setVisual(modeVisualLabel(this.#mode));
    this.#setStatus("idle", "Ready for another check");
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

  #setControlsActive(active: boolean): void {
    const disableStarts = active || this.#starting;
    this.#checkButton.disabled = this.#starting || this.#capabilities !== null;
    for (const button of this.#fiveOneButtons) button.disabled = disableStarts;
    this.#fiveOneAllButton.disabled = disableStarts;
    for (const button of this.#eightButtons) button.disabled = disableStarts;
    this.#eightAllButton.disabled = disableStarts;
    for (const button of this.#stereoButtons) button.disabled = disableStarts;
    for (const button of this.#modeButtons) button.disabled = this.#starting;
    this.#levelInput.disabled = false;
    this.#stopButton.disabled = !active;
  }

  #renderModes(): void {
    const capabilities = this.#capabilities;
    this.#modeSelector.hidden = capabilities === null;

    for (const button of this.#modeButtons) {
      const mode = parseMode(button.dataset.surroundMode);
      const available =
        mode === "stereo-preview" ||
        (mode === "five-one" && capabilities?.fiveOne === "confirmed") ||
        (mode === "experimental-eight" &&
          Boolean(
            capabilities &&
              isSelectableCapability(capabilities.experimentalEight),
          ));
      button.hidden = !available;
      button.setAttribute("aria-pressed", String(mode === this.#mode));
      if (mode === "experimental-eight") {
        button.textContent =
          capabilities?.experimentalEight === "candidate"
            ? "Try Experimental 8-channel"
            : "Experimental 8-channel";
      }
    }

    for (const panel of this.#panels) {
      panel.hidden = panel.dataset.surroundPanel !== this.#mode;
    }
    this.#root.dataset.surroundMode = this.#mode;
    this.#setVisual(modeVisualLabel(this.#mode));
  }

  #capabilityMessage(capabilities: SurroundCapabilities): string {
    const fiveOne =
      capabilities.fiveOne === "confirmed"
        ? "5.1 confirmed by exact destination readback."
        : capabilities.fiveOne === "unsupported"
          ? "5.1 candidate was rejected or did not read back exactly."
          : "5.1 is not a candidate on this output.";
    const eight =
      capabilities.experimentalEight === "confirmed"
        ? "Experimental 8-channel confirmed by exact discrete readback."
        : capabilities.experimentalEight === "candidate"
          ? "Experimental 8-channel is only a candidate until you choose it and exact readback succeeds."
          : capabilities.experimentalEight === "unsupported"
            ? "Experimental 8-channel was not confirmed on this output."
            : "Experimental 8-channel is not a candidate on this output.";

    return `Browser-reported output ceiling: ${capabilities.maxChannelCount} channels. ${fiveOne} ${eight}`;
  }

  #setCapabilitySummary(message: string): void {
    this.#capabilitySummary.textContent = message;
    this.#capabilitySummary.hidden = false;
  }

  #setVisual(label: string): void {
    this.#visualLabel.textContent = label;
  }

  #setStatus(state: string, label: string): void {
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
  }

  async #replaceAudioSession(): Promise<void> {
    const previousSession = this.#session;
    this.#session = new AudioSession();
    this.#multichannel = null;
    this.#stereoEngine = null;
    this.#stereoPlayback = null;
    this.#multichannelPlaybacks = [];

    try {
      await previousSession.dispose();
    } catch (error) {
      console.error("Surround Test failed to dispose uncertain AudioSession", error);
    }
  }

  async #fallbackAfterRestoreFailure(
    token: number,
    message: string,
  ): Promise<void> {
    await this.#replaceAudioSession();
    if (!this.#isCurrentRun(token)) return;
    this.#capabilities = null;
    this.#mode = "stereo-preview";
    this.#starting = false;
    this.#setCapabilitySummary(message);
    this.#renderModes();
    this.#setControlsActive(false);
    this.#setStatus("limited_capability", "Stereo spatial preview ready");
  }

  #handleError(error: unknown, token: number): void {
    if (!this.#isCurrentRun(token)) return;
    console.error("Surround Sound Test failed", error);
    this.#starting = false;
    this.#clearTimers();
    this.#stereoPlayback?.stop();
    this.#stereoPlayback = null;
    this.#multichannel?.stop();
    this.#multichannelPlaybacks = [];
    this.#setControlsActive(false);
    this.#setStatus("error", "Output unavailable");
    this.#showError(
      "This output mode could not be configured or played. Try Stereo spatial preview or check your browser/OS output configuration.",
    );
  }

  #isCurrentRun(token: number): boolean {
    return !this.#disposed && token === this.#runToken;
  }

  #resetIdleUi(): void {
    this.#capabilities = null;
    this.#mode = "unknown";
    this.#capabilitySummary.hidden = true;
    this.#capabilitySummary.textContent = "";
    this.#modeSelector.hidden = true;
    this.#setControlsActive(false);
    this.#renderModes();
    this.#setStatus("idle", "Capability not checked");
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
