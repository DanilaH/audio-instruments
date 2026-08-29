import { AudioAnalyzer } from "../../browser/analysis/AudioAnalyzer";
import {
  PITCH_ANALYSIS_INTERVAL_MS,
  PitchStabilizer,
  downsampleAveraged,
  estimatePitchYin,
  getPitchAnalysisConfiguration,
  mapFrequencyToNote,
  type PitchAnalysisConfiguration,
} from "../../browser/analysis/pitch";
import { AudioSession } from "../../browser/audio-session/AudioSession";
import {
  MicrophoneService,
  type MicrophoneInputDevice,
} from "../../browser/microphone/MicrophoneService";

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Pitch Detector is missing required element: ${selector}`);
  }
  return element;
}

function captureErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Microphone permission was denied. Allow microphone access for this site, then try again.";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No microphone input was found. Connect or enable an input device, then try again.";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "The microphone could not be opened. It may be busy in another application or unavailable to the browser.";
    }
  }
  return "The microphone could not start. Check browser permission and input-device availability, then try again.";
}

function deviceLabel(
  devices: readonly MicrophoneInputDevice[],
  deviceId: string | undefined,
): string {
  if (!deviceId) return "Active input";
  const index = devices.findIndex((device) => device.deviceId === deviceId);
  if (index < 0) return "Active input";
  return devices[index]?.label || `Input ${index + 1}`;
}

function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  if (rounded === 0) return "0 cents";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)} cents`;
}

export class PitchDetectorController {
  readonly #root: HTMLElement;
  readonly #listeners = new AbortController();
  readonly #startButton: HTMLButtonElement;
  readonly #stopButton: HTMLButtonElement;
  readonly #inputField: HTMLElement;
  readonly #inputSelect: HTMLSelectElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #activeInputLabel: HTMLElement;
  readonly #noteValue: HTMLElement;
  readonly #frequencyValue: HTMLElement;
  readonly #centsValue: HTMLElement;
  readonly #confidenceValue: HTMLElement;
  readonly #stabilityValue: HTMLElement;
  readonly #resultMessage: HTMLElement;
  readonly #needle: HTMLElement;
  readonly #analysisRateValue: HTMLElement;
  readonly #downsampleValue: HTMLElement;
  readonly #frameSizeValue: HTMLElement;
  readonly #errorMessage: HTMLElement;
  readonly #selectionError: HTMLElement;
  readonly #stabilizer = new PitchStabilizer();

  #session: AudioSession | null = null;
  #microphone: MicrophoneService | null = null;
  #analyzer: AudioAnalyzer | null = null;
  #configuration: PitchAnalysisConfiguration | null = null;
  #sourceBuffer: Float32Array | null = null;
  #analysisBuffer: Float32Array | null = null;
  #analysisTimer: number | null = null;
  #devices: readonly MicrophoneInputDevice[] = [];
  #starting = false;
  #switching = false;
  #stopping = false;
  #disposed = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#startButton = requireElement(root, "[data-pitch-start]");
    this.#stopButton = requireElement(root, "[data-pitch-stop]");
    this.#inputField = requireElement(root, "[data-pitch-input-field]");
    this.#inputSelect = requireElement(root, "[data-pitch-input]");
    this.#status = requireElement(root, "#pitch-detector-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#activeInputLabel = requireElement(root, "[data-pitch-active-input]");
    this.#noteValue = requireElement(root, "[data-pitch-note]");
    this.#frequencyValue = requireElement(root, "[data-pitch-frequency]");
    this.#centsValue = requireElement(root, "[data-pitch-cents]");
    this.#confidenceValue = requireElement(root, "[data-pitch-confidence]");
    this.#stabilityValue = requireElement(root, "[data-pitch-stability]");
    this.#resultMessage = requireElement(root, "[data-pitch-message]");
    this.#needle = requireElement(root, "[data-pitch-needle]");
    this.#analysisRateValue = requireElement(root, "[data-pitch-analysis-rate]");
    this.#downsampleValue = requireElement(root, "[data-pitch-downsample]");
    this.#frameSizeValue = requireElement(root, "[data-pitch-frame-size]");
    this.#errorMessage = requireElement(root, "[data-pitch-error]");
    this.#selectionError = requireElement(root, "[data-pitch-selection-error]");

    this.#bindEvents();
    this.#renderIdle("Ready");
  }

  get isActive(): boolean {
    return this.#microphone?.isActive === true;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.abort();
    this.#runToken += 1;
    this.#starting = false;
    this.#switching = false;
    this.#stopping = false;
    this.#stopAnalysisLoop();
    this.#microphone?.stop();
    this.#clearPitchState();

    const session = this.#session;
    this.#clearServiceReferences();
    if (session) await session.dispose();
  }

  #bindEvents(): void {
    const signal = this.#listeners.signal;
    this.#startButton.addEventListener("click", () => void this.#startMicrophone(), {
      signal,
    });
    this.#stopButton.addEventListener("click", () => void this.#stopTool(), {
      signal,
    });
    this.#inputSelect.addEventListener(
      "change",
      () => void this.#switchInput(this.#inputSelect.value),
      { signal },
    );
  }

  async #ensureServices(): Promise<{
    microphone: MicrophoneService;
    analyzer: AudioAnalyzer;
  }> {
    if (this.#session && this.#microphone && this.#analyzer) {
      return { microphone: this.#microphone, analyzer: this.#analyzer };
    }

    const session = new AudioSession();
    this.#session = session;
    const context = await session.getContext();
    if (this.#disposed) {
      throw new Error("Pitch Detector was disposed during Start");
    }

    const microphone = new MicrophoneService(context);
    session.register(microphone);

    const analyzer = new AudioAnalyzer(context);
    session.register(analyzer);
    microphone.connectAnalysisTarget(analyzer.inputNode);

    const configuration = getPitchAnalysisConfiguration(context.sampleRate);
    if (configuration.sourceFrameSize > analyzer.meterConfiguration.fftSize) {
      throw new RangeError(
        "Pitch source frame exceeds the available AudioAnalyzer PCM buffer",
      );
    }

    this.#microphone = microphone;
    this.#analyzer = analyzer;
    this.#configuration = configuration;
    this.#sourceBuffer = new Float32Array(configuration.sourceFrameSize);
    this.#analysisBuffer = new Float32Array(configuration.frameSize);

    microphone.onTrackEnded(() => this.#handleTrackEnded());
    microphone.onDeviceListChanged((devices) => this.#renderDevices(devices));

    return { microphone, analyzer };
  }

  async #startMicrophone(): Promise<void> {
    if (this.#disposed || this.#starting || this.isActive || this.#stopping) return;
    const token = ++this.#runToken;
    this.#starting = true;
    this.#hideErrors();
    this.#setStatus("ready", "Requesting microphone…");
    this.#renderControls();

    try {
      const { microphone } = await this.#ensureServices();
      const capture = await microphone.startDefault();
      if (!this.#isCurrent(token)) return;

      this.#starting = false;
      this.#clearPitchState();
      this.#renderDevices(this.#devices, capture.settings.deviceId);
      this.#renderAnalysisDetails();
      this.#setStatus("playing", "Listening for pitch");
      this.#renderControls();
      this.#startAnalysisLoop();
      void this.#refreshInputDevices(token, capture.settings.deviceId);
    } catch (error) {
      if (!this.#isCurrent(token)) return;
      this.#starting = false;
      console.error("Pitch Detector capture failed", error);
      await this.#resetFailedSession();
      this.#setStatus("error", "Microphone unavailable");
      this.#showError(captureErrorMessage(error));
      this.#renderControls();
    }
  }

  async #switchInput(deviceId: string): Promise<void> {
    const microphone = this.#microphone;
    if (
      !microphone?.isActive ||
      this.#switching ||
      this.#stopping ||
      this.#disposed ||
      !deviceId
    ) {
      return;
    }

    const token = ++this.#runToken;
    const previousDeviceId = microphone.activeSettings()?.deviceId ?? "";
    this.#switching = true;
    this.#stopAnalysisLoop();
    this.#clearPitchState();
    this.#selectionError.hidden = true;
    this.#setStatus("ready", "Switching input…");
    this.#renderControls();

    try {
      const capture = await microphone.switchToExactDevice(deviceId);
      if (!this.#isCurrent(token)) return;

      this.#switching = false;
      this.#renderDevices(this.#devices, capture.settings.deviceId);
      this.#setStatus("playing", "Listening for pitch");
      this.#renderControls();
      this.#startAnalysisLoop();
      void this.#refreshInputDevices(token, capture.settings.deviceId);
    } catch (error) {
      if (!this.#isCurrent(token)) return;
      console.error("Pitch Detector input switch failed", error);
      this.#inputSelect.value = previousDeviceId;
      this.#selectionError.textContent =
        "That input could not be opened. The previous microphone remains active.";
      this.#selectionError.hidden = false;
      this.#setStatus("playing", "Listening for pitch");
      this.#startAnalysisLoop();
    } finally {
      if (token === this.#runToken) {
        this.#switching = false;
        if (!this.#disposed) this.#renderControls();
      }
    }
  }

  async #stopTool(): Promise<void> {
    if (!this.isActive || this.#stopping || this.#disposed) return;

    ++this.#runToken;
    this.#starting = false;
    this.#switching = false;
    this.#stopping = true;
    this.#setStatus("ready", "Stopping pitch detector…");
    this.#renderControls();

    this.#stopAnalysisLoop();
    this.#microphone?.stop();
    this.#clearPitchState();
    this.#activeInputLabel.textContent = "No active input";
    this.#inputField.hidden = true;
    this.#stopping = false;
    this.#setStatus("idle", "Stopped");
    this.#renderControls();
  }

  #handleTrackEnded(): void {
    if (this.#disposed) return;
    ++this.#runToken;
    this.#starting = false;
    this.#switching = false;
    this.#stopping = false;
    this.#stopAnalysisLoop();
    this.#clearPitchState();
    this.#activeInputLabel.textContent = "Input device disconnected";
    this.#inputField.hidden = true;
    this.#setStatus("error", "Input device disconnected");
    this.#renderControls();
  }

  #startAnalysisLoop(): void {
    this.#stopAnalysisLoop();
    if (!this.isActive || this.#disposed) return;
    this.#analysisTimer = window.setInterval(
      () => this.#analyzeFrame(),
      PITCH_ANALYSIS_INTERVAL_MS,
    );
  }

  #stopAnalysisLoop(): void {
    if (this.#analysisTimer === null) return;
    window.clearInterval(this.#analysisTimer);
    this.#analysisTimer = null;
  }

  #analyzeFrame(): void {
    const analyzer = this.#analyzer;
    const configuration = this.#configuration;
    const sourceBuffer = this.#sourceBuffer;
    const analysisBuffer = this.#analysisBuffer;
    if (
      !analyzer ||
      !configuration ||
      !sourceBuffer ||
      !analysisBuffer ||
      !this.isActive ||
      this.#switching ||
      this.#disposed
    ) {
      return;
    }

    try {
      analyzer.readRecentTimeDomain(sourceBuffer);
      downsampleAveraged(
        sourceBuffer,
        configuration.downsampleFactor,
        analysisBuffer,
      );
      const estimate = estimatePitchYin(
        analysisBuffer,
        configuration.analysisRate,
      );

      if (!estimate) {
        this.#stabilizer.reject();
        this.#renderListening();
        return;
      }

      const stabilized = this.#stabilizer.accept(estimate);
      const note = mapFrequencyToNote(stabilized.frequencyHz);
      this.#renderPitch(
        stabilized.frequencyHz,
        note.noteName,
        note.octave,
        note.cents,
        stabilized.confidence,
        stabilized.stable,
      );
    } catch (error) {
      console.error("Pitch Detector analysis failed", error);
      this.#stopAnalysisLoop();
      this.#stabilizer.reject();
      this.#renderListening();
      this.#setStatus("error", "Pitch analysis unavailable");
      this.#showError(
        "Pitch analysis could not continue in this browser session. Stop and start the microphone to retry.",
      );
      this.#renderControls();
    }
  }

  #renderPitch(
    frequencyHz: number,
    noteName: string,
    octave: number,
    cents: number,
    confidence: number,
    stable: boolean,
  ): void {
    this.#root.dataset.pitchResultState = stable ? "stable" : "settling";
    this.#noteValue.textContent = `${noteName}${octave}`;
    this.#frequencyValue.textContent = `${frequencyHz.toFixed(1)} Hz`;
    this.#centsValue.textContent = formatCents(cents);
    this.#confidenceValue.textContent = `${Math.round(confidence * 100)}%`;
    this.#stabilityValue.textContent = stable ? "Stable" : "Settling";
    this.#resultMessage.textContent = stable
      ? "Pitch estimate stabilized across recent accepted frames."
      : "Listening for a consistent monophonic tone…";
    const boundedCents = Math.min(50, Math.max(-50, cents));
    this.#needle.style.setProperty("--pitch-offset", `${boundedCents}%`);
  }

  #renderListening(): void {
    this.#root.dataset.pitchResultState = "listening";
    this.#noteValue.textContent = "—";
    this.#frequencyValue.textContent = "Listening…";
    this.#centsValue.textContent = "—";
    this.#confidenceValue.textContent = "—";
    this.#stabilityValue.textContent = "Unstable";
    this.#resultMessage.textContent = "Signal too weak or unstable";
    this.#needle.style.setProperty("--pitch-offset", "0%");
  }

  #clearPitchState(): void {
    this.#stabilizer.reset();
    this.#root.dataset.pitchResultState = "idle";
    this.#noteValue.textContent = "—";
    this.#frequencyValue.textContent = "—";
    this.#centsValue.textContent = "—";
    this.#confidenceValue.textContent = "—";
    this.#stabilityValue.textContent = "Waiting";
    this.#resultMessage.textContent =
      "Start the microphone and provide one steady monophonic tone.";
    this.#needle.style.setProperty("--pitch-offset", "0%");
  }

  async #refreshInputDevices(
    token: number,
    selectedDeviceId: string | undefined,
  ): Promise<void> {
    const microphone = this.#microphone;
    if (!microphone) return;

    try {
      const devices = await microphone.listInputs();
      if (!this.#isCurrent(token)) return;
      this.#renderDevices(devices, selectedDeviceId);
    } catch (error) {
      if (!this.#isCurrent(token)) return;
      console.warn("Pitch Detector input metadata refresh failed", error);
    }
  }

  #renderDevices(
    devices: readonly MicrophoneInputDevice[],
    selectedDeviceId: string | undefined =
      this.#microphone?.activeSettings()?.deviceId,
  ): void {
    this.#devices = devices;
    this.#inputSelect.replaceChildren();

    const hasReportedSelectedDevice = Boolean(selectedDeviceId);
    const selectedDeviceIsListed =
      hasReportedSelectedDevice &&
      devices.some((device) => device.deviceId === selectedDeviceId);

    if (this.isActive && !selectedDeviceIsListed) {
      const activeOption = document.createElement("option");
      activeOption.value = selectedDeviceId ?? "";
      activeOption.textContent = hasReportedSelectedDevice
        ? "Active input (not currently listed)"
        : "Active input (device ID not reported)";
      activeOption.selected = true;
      this.#inputSelect.append(activeOption);
    }

    devices.forEach((device, index) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || `Input ${index + 1}`;
      this.#inputSelect.append(option);
    });

    if (selectedDeviceId && selectedDeviceIsListed) {
      this.#inputSelect.value = selectedDeviceId;
    }

    const hasAlternativeInput = devices.some(
      (device) => !selectedDeviceId || device.deviceId !== selectedDeviceId,
    );
    this.#inputField.hidden = !this.isActive || !hasAlternativeInput;

    if (this.isActive) {
      this.#activeInputLabel.textContent = deviceLabel(devices, selectedDeviceId);
    }
    this.#renderControls();
  }

  #renderAnalysisDetails(): void {
    const configuration = this.#configuration;
    if (!configuration) {
      this.#analysisRateValue.textContent = "Not active";
      this.#downsampleValue.textContent = "—";
      this.#frameSizeValue.textContent = "—";
      return;
    }

    this.#analysisRateValue.textContent = `${configuration.analysisRate.toFixed(
      configuration.analysisRate % 1 === 0 ? 0 : 1,
    )} Hz`;
    this.#downsampleValue.textContent = `${configuration.downsampleFactor}×`;
    this.#frameSizeValue.textContent = `${configuration.frameSize} samples`;
  }

  #renderControls(): void {
    const active = this.isActive;
    const busy = this.#starting || this.#switching || this.#stopping;
    this.#startButton.disabled = active || busy || this.#disposed;
    this.#stopButton.disabled = !active || this.#stopping;
    this.#inputSelect.disabled = !active || busy;
  }

  #renderIdle(label: string): void {
    this.#root.dataset.pitchState = "idle";
    this.#activeInputLabel.textContent = "No active input";
    this.#inputField.hidden = true;
    this.#hideErrors();
    this.#clearPitchState();
    this.#renderAnalysisDetails();
    this.#setStatus("idle", label);
    this.#renderControls();
  }

  #setStatus(state: string, label: string): void {
    this.#root.dataset.pitchState = state;
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
  }

  async #resetFailedSession(): Promise<void> {
    this.#stopAnalysisLoop();
    const session = this.#session;
    this.#clearServiceReferences();
    this.#clearPitchState();
    if (session) {
      try {
        await session.dispose();
      } catch (error) {
        console.error("Pitch Detector failed-session cleanup failed", error);
      }
    }
  }

  #clearServiceReferences(): void {
    this.#session = null;
    this.#microphone = null;
    this.#analyzer = null;
    this.#configuration = null;
    this.#sourceBuffer = null;
    this.#analysisBuffer = null;
  }

  #hideErrors(): void {
    this.#errorMessage.hidden = true;
    this.#errorMessage.textContent = "";
    this.#selectionError.hidden = true;
    this.#selectionError.textContent = "";
  }

  #showError(message: string): void {
    this.#errorMessage.textContent = message;
    this.#errorMessage.hidden = false;
  }

  #isCurrent(token: number): boolean {
    return !this.#disposed && token === this.#runToken;
  }
}
