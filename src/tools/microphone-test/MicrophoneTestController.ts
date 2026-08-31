import {
  AudioAnalyzer,
  METER_DBFS_FLOOR,
  METER_UPDATE_INTERVAL_MS,
} from "../../browser/analysis/AudioAnalyzer";
import { AudioSession } from "../../browser/audio-session/AudioSession";
import {
  MicrophoneService,
  type MicrophoneInputDevice,
} from "../../browser/microphone/MicrophoneService";
import {
  AudioRecorder,
  RecordingUnavailableError,
  type RecordingResult,
} from "../../browser/recording/AudioRecorder";
import { WaveformCanvas } from "../../components/visualizations/WaveformCanvas";

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Microphone Test is missing required element: ${selector}`);
  }
  return element;
}

function formatDbfs(value: number): string {
  const bounded = Math.max(METER_DBFS_FLOOR, value);
  return `${bounded.toFixed(1)} dBFS`;
}

function formatBoolean(value: boolean | undefined): string {
  return value === undefined ? "Not reported" : value ? "On" : "Off";
}

function formatNumber(value: number | undefined, suffix = ""): string {
  return value === undefined ? "Not reported" : `${value}${suffix}`;
}

function captureErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Microphone permission was denied. Allow microphone access for this site, then try again.";
    }
    if (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError"
    ) {
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

export class MicrophoneTestController {
  readonly #root: HTMLElement;
  readonly #listeners = new AbortController();
  readonly #startButton: HTMLButtonElement;
  readonly #stopButton: HTMLButtonElement;
  readonly #recordButton: HTMLButtonElement;
  readonly #stopRecordingButton: HTMLButtonElement;
  readonly #inputField: HTMLElement;
  readonly #inputSelect: HTMLSelectElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #activeInputLabel: HTMLElement;
  readonly #rmsValue: HTMLElement;
  readonly #peakValue: HTMLElement;
  readonly #canvas: HTMLCanvasElement;
  readonly #detailsDeviceId: HTMLElement;
  readonly #detailsAnalysisSampleRate: HTMLElement;
  readonly #detailsSampleRate: HTMLElement;
  readonly #detailsChannelCount: HTMLElement;
  readonly #detailsEchoCancellation: HTMLElement;
  readonly #detailsNoiseSuppression: HTMLElement;
  readonly #detailsAutoGainControl: HTMLElement;
  readonly #recordingNotice: HTMLElement;
  readonly #recordingStatus: HTMLElement;
  readonly #playback: HTMLAudioElement;
  readonly #errorMessage: HTMLElement;
  readonly #selectionError: HTMLElement;

  #session: AudioSession | null = null;
  #microphone: MicrophoneService | null = null;
  #analyzer: AudioAnalyzer | null = null;
  #recorder: AudioRecorder | null = null;
  #waveform: WaveformCanvas | null = null;
  #meterTimer: number | null = null;
  #devices: readonly MicrophoneInputDevice[] = [];
  #starting = false;
  #switching = false;
  #stopping = false;
  #recordingUnavailable = false;
  #disposed = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#startButton = requireElement(root, "[data-mic-start]");
    this.#stopButton = requireElement(root, "[data-mic-stop]");
    this.#recordButton = requireElement(root, "[data-mic-record]");
    this.#stopRecordingButton = requireElement(root, "[data-mic-record-stop]");
    this.#inputField = requireElement(root, "[data-mic-input-field]");
    this.#inputSelect = requireElement(root, "[data-mic-input-select]");
    this.#status = requireElement(root, "#microphone-test-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#activeInputLabel = requireElement(root, "[data-mic-active-input]");
    this.#rmsValue = requireElement(root, "[data-mic-rms]");
    this.#peakValue = requireElement(root, "[data-mic-peak]");
    this.#canvas = requireElement(root, "[data-mic-waveform]");
    this.#detailsDeviceId = requireElement(root, "[data-mic-detail-device-id]");
    this.#detailsAnalysisSampleRate = requireElement(
      root,
      "[data-mic-detail-analysis-rate]",
    );
    this.#detailsSampleRate = requireElement(
      root,
      "[data-mic-detail-sample-rate]",
    );
    this.#detailsChannelCount = requireElement(
      root,
      "[data-mic-detail-channel-count]",
    );
    this.#detailsEchoCancellation = requireElement(
      root,
      "[data-mic-detail-echo-cancellation]",
    );
    this.#detailsNoiseSuppression = requireElement(
      root,
      "[data-mic-detail-noise-suppression]",
    );
    this.#detailsAutoGainControl = requireElement(
      root,
      "[data-mic-detail-auto-gain]",
    );
    this.#recordingNotice = requireElement(root, "[data-mic-recording-notice]");
    this.#recordingStatus = requireElement(root, "[data-mic-recording-status]");
    this.#playback = requireElement(root, "[data-mic-playback]");
    this.#errorMessage = requireElement(root, "[data-mic-error]");
    this.#selectionError = requireElement(root, "[data-mic-selection-error]");

    this.#bindEvents();
    this.#renderIdle("Ready");
  }

  get isActive(): boolean {
    return this.#microphone?.isActive === true;
  }

  get isRecording(): boolean {
    return this.#recorder?.isRecording === true;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.abort();
    this.#runToken += 1;
    this.#starting = false;
    this.#switching = false;
    this.#stopping = false;
    this.#stopMeterAndWaveform();

    try {
      await this.#recorder?.stopForToolTeardown();
    } catch {
      // Session disposal below still tears down the remaining resources.
    }
    this.#microphone?.stop();
    this.#waveform?.dispose();
    this.#waveform = null;

    const session = this.#session;
    this.#clearServiceReferences();
    if (session) await session.dispose();
  }

  #bindEvents(): void {
    const signal = this.#listeners.signal;
    this.#startButton.addEventListener(
      "click",
      () => void this.#startMicrophone(),
      {
        signal,
      },
    );
    this.#stopButton.addEventListener("click", () => void this.#stopTool(), {
      signal,
    });
    this.#recordButton.addEventListener("click", () => this.#startRecording(), {
      signal,
    });
    this.#stopRecordingButton.addEventListener(
      "click",
      () => this.#stopRecording(),
      { signal },
    );
    this.#inputSelect.addEventListener(
      "change",
      () => void this.#switchInput(this.#inputSelect.value),
      { signal },
    );
  }

  async #ensureServices(): Promise<{
    microphone: MicrophoneService;
    analyzer: AudioAnalyzer;
    recorder: AudioRecorder;
  }> {
    if (this.#session && this.#microphone && this.#analyzer && this.#recorder) {
      return {
        microphone: this.#microphone,
        analyzer: this.#analyzer,
        recorder: this.#recorder,
      };
    }

    const session = new AudioSession();
    this.#session = session;
    const context = await session.getContext();
    if (this.#disposed)
      throw new Error("Microphone Test was disposed during Start");

    const recorder = new AudioRecorder();
    session.register(recorder);

    const microphone = new MicrophoneService(context);
    session.register(microphone);

    const analyzer = new AudioAnalyzer(context);
    session.register(analyzer);

    microphone.connectAnalysisTarget(analyzer.inputNode);

    this.#recorder = recorder;
    this.#microphone = microphone;
    this.#analyzer = analyzer;
    this.#recordingUnavailable = !recorder.isSupported;

    microphone.onTrackEnded(() => void this.#handleTrackEnded());
    microphone.onDeviceListChanged((devices) => this.#renderDevices(devices));

    return { microphone, analyzer, recorder };
  }

  async #startMicrophone(): Promise<void> {
    if (this.#disposed || this.#starting || this.isActive || this.#stopping)
      return;
    const token = ++this.#runToken;
    this.#starting = true;
    this.#hideErrors();
    this.#setStatus("ready", "Requesting microphone…");
    this.#renderControls();

    try {
      const { microphone, analyzer } = await this.#ensureServices();
      const capture = await microphone.startDefault();
      if (!this.#isCurrent(token)) return;

      analyzer.resetMeter();
      this.#starting = false;
      this.#renderDevices(this.#devices, capture.settings.deviceId);
      this.#renderCaptureDetails();
      this.#startMeterAndWaveform();
      this.#setStatus("playing", "Microphone active");
      this.#renderControls();
      this.#renderRecordingAvailability();
      void this.#refreshInputDevices(token, capture.settings.deviceId);
    } catch (error) {
      if (!this.#isCurrent(token)) return;
      this.#starting = false;
      console.error("Microphone Test capture failed", error);
      await this.#resetFailedSession();
      this.#setStatus("error", "Microphone unavailable");
      this.#showError(captureErrorMessage(error));
      this.#renderControls();
    }
  }

  async #switchInput(deviceId: string): Promise<void> {
    const microphone = this.#microphone;
    const analyzer = this.#analyzer;
    if (
      !microphone?.isActive ||
      !analyzer ||
      this.#switching ||
      this.isRecording ||
      this.#disposed ||
      !deviceId
    ) {
      return;
    }

    const token = ++this.#runToken;
    const previousDeviceId = microphone.activeSettings()?.deviceId ?? "";
    this.#switching = true;
    this.#selectionError.hidden = true;
    this.#setStatus("ready", "Switching input…");
    this.#renderControls();

    try {
      await microphone.switchToExactDevice(deviceId);
      if (!this.#isCurrent(token)) return;

      analyzer.resetMeter();
      this.#clearMeterReadouts();
      this.#renderCaptureDetails();
      this.#switching = false;
      this.#renderDevices(this.#devices, deviceId);
      this.#setStatus("playing", "Microphone active");
      this.#renderControls();
      void this.#refreshInputDevices(token, deviceId);
    } catch (error) {
      if (!this.#isCurrent(token)) return;
      console.error("Microphone Test input switch failed", error);
      this.#inputSelect.value = previousDeviceId;
      this.#selectionError.textContent =
        "That input could not be opened. The previous microphone remains active.";
      this.#selectionError.hidden = false;
      this.#setStatus("playing", "Microphone active");
    } finally {
      if (token === this.#runToken) {
        this.#switching = false;
        if (!this.#disposed) this.#renderControls();
      }
    }
  }

  #startRecording(): void {
    const recorder = this.#recorder;
    const stream = this.#microphone?.activeStream;
    if (
      !recorder ||
      !stream ||
      this.#recordingUnavailable ||
      recorder.isRecording ||
      this.#stopping ||
      this.#disposed
    ) {
      return;
    }

    this.#recordingStatus.textContent = "Recording… up to 15 seconds";
    this.#hideErrors();
    if (!this.#recordingUnavailable) this.#recordingNotice.hidden = true;

    let completion: Promise<RecordingResult>;
    try {
      completion = recorder.start(stream);
    } catch (error) {
      console.error("Microphone Test recording could not start", error);
      if (error instanceof RecordingUnavailableError) {
        this.#recordingUnavailable = true;
        this.#recordingStatus.textContent = "Recording unavailable";
        this.#recordingNotice.textContent =
          "Recording is unavailable in this browser. Live microphone waveform and meters still work.";
      } else {
        this.#recordingStatus.textContent = recorder.latestRecording
          ? "Recording could not start · previous recording remains available"
          : "Recording could not start";
        this.#recordingNotice.textContent =
          "Recording could not start. Live microphone waveform and meters remain available.";
      }
      this.#recordingNotice.hidden = false;
      this.#renderControls();
      return;
    }

    this.#setStatus("playing", "Recording microphone…");
    this.#renderControls();
    void completion.then(
      (result) => this.#handleRecordingComplete(result),
      (error) => this.#handleRecordingError(error),
    );
  }

  #stopRecording(): void {
    if (!this.#recorder?.isRecording) return;
    this.#recordingStatus.textContent = "Finalizing recording…";
    this.#stopRecordingButton.disabled = true;
    this.#recorder.stopRecording();
  }

  #handleRecordingComplete(result: RecordingResult): void {
    if (this.#disposed) return;
    this.#playback.src = result.url;
    this.#playback.hidden = false;
    this.#recordingStatus.textContent = `Local recording ready · ${result.mimeType || "browser-selected format"}`;
    if (this.isActive && !this.#stopping) {
      this.#setStatus("playing", "Microphone active");
    }
    this.#renderControls();
  }

  #handleRecordingError(error: unknown): void {
    if (this.#disposed) return;
    console.error("Microphone Test recording failed", error);
    this.#recordingStatus.textContent = "Recording was not saved";
    this.#recordingNotice.textContent =
      "The recording could not be finalized. Live microphone waveform and meters remain available.";
    this.#recordingNotice.hidden = false;
    if (this.isActive && !this.#stopping) {
      this.#setStatus("playing", "Microphone active");
    }
    this.#renderControls();
  }

  async #stopTool(): Promise<void> {
    if (
      (!this.isActive && !this.isRecording) ||
      this.#stopping ||
      this.#disposed
    ) {
      return;
    }

    const token = ++this.#runToken;
    this.#starting = false;
    this.#switching = false;
    this.#stopping = true;
    this.#setStatus("ready", "Stopping microphone…");
    this.#renderControls();

    try {
      await this.#recorder?.stopForToolTeardown();
    } catch (error) {
      console.error("Microphone Test recording teardown failed", error);
    }

    if (!this.#isCurrent(token)) return;

    this.#stopMeterAndWaveform();
    this.#microphone?.stop();
    this.#analyzer?.resetMeter();
    this.#clearMeterReadouts();
    this.#clearCaptureDetails();
    this.#activeInputLabel.textContent = "No active input";
    this.#stopping = false;
    this.#setStatus("idle", "Stopped");
    this.#renderControls();
  }

  async #handleTrackEnded(): Promise<void> {
    if (this.#disposed) return;
    const token = ++this.#runToken;
    this.#starting = false;
    this.#switching = false;
    this.#stopping = true;
    this.#stopMeterAndWaveform();
    this.#analyzer?.resetMeter();
    this.#clearMeterReadouts();
    this.#clearCaptureDetails();
    this.#activeInputLabel.textContent = "Input device disconnected";
    this.#setStatus("error", "Input device disconnected");
    this.#renderControls();

    try {
      await this.#recorder?.stopForToolTeardown();
    } catch (error) {
      console.error(
        "Microphone Test recorder cleanup after disconnect failed",
        error,
      );
    }

    if (!this.#isCurrent(token)) return;

    this.#stopping = false;
    this.#setStatus("error", "Input device disconnected");
    this.#activeInputLabel.textContent = "Input device disconnected";
    this.#renderControls();
  }

  #startMeterAndWaveform(): void {
    const analyzer = this.#analyzer;
    if (!analyzer) return;
    this.#stopMeterAndWaveform();

    this.#waveform ??= new WaveformCanvas(this.#canvas);
    this.#waveform.start(() => {
      if (!this.isActive || this.#disposed) return null;
      try {
        return analyzer.readWaveform();
      } catch {
        return null;
      }
    });

    const update = () => {
      if (!this.isActive || this.#disposed) return;
      try {
        const reading = analyzer.readMeter(performance.now());
        this.#rmsValue.textContent = formatDbfs(reading.rmsDbfs);
        this.#peakValue.textContent = formatDbfs(reading.heldPeakDbfs);
      } catch (error) {
        console.error("Microphone Test meter update failed", error);
      }
    };
    update();
    this.#meterTimer = window.setInterval(update, METER_UPDATE_INTERVAL_MS);
  }

  #stopMeterAndWaveform(): void {
    if (this.#meterTimer !== null) {
      window.clearInterval(this.#meterTimer);
      this.#meterTimer = null;
    }
    this.#waveform?.stop();
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
      this.#devices = devices;
      this.#renderDevices(devices, selectedDeviceId);
    } catch (error) {
      if (!this.#isCurrent(token)) return;
      console.warn("Microphone Test input metadata refresh failed", error);
    }
  }

  #renderDevices(
    devices: readonly MicrophoneInputDevice[],
    selectedDeviceId: string | undefined = this.#microphone?.activeSettings()
      ?.deviceId,
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
      this.#activeInputLabel.textContent = deviceLabel(
        devices,
        selectedDeviceId,
      );
    }
    this.#renderControls();
  }

  #renderCaptureDetails(): void {
    const settings = this.#microphone?.activeSettings();
    const analyzer = this.#analyzer;
    if (!settings || !analyzer) {
      this.#clearCaptureDetails();
      return;
    }

    this.#detailsDeviceId.textContent = settings.deviceId || "Not reported";
    this.#detailsAnalysisSampleRate.textContent = `${analyzer.analysisSampleRate} Hz`;
    this.#detailsSampleRate.textContent = formatNumber(
      settings.sampleRate,
      " Hz",
    );
    this.#detailsChannelCount.textContent = formatNumber(settings.channelCount);
    this.#detailsEchoCancellation.textContent = formatBoolean(
      settings.echoCancellation,
    );
    this.#detailsNoiseSuppression.textContent = formatBoolean(
      settings.noiseSuppression,
    );
    this.#detailsAutoGainControl.textContent = formatBoolean(
      settings.autoGainControl,
    );
  }

  #clearCaptureDetails(): void {
    for (const element of [
      this.#detailsDeviceId,
      this.#detailsAnalysisSampleRate,
      this.#detailsSampleRate,
      this.#detailsChannelCount,
      this.#detailsEchoCancellation,
      this.#detailsNoiseSuppression,
      this.#detailsAutoGainControl,
    ]) {
      element.textContent = "Not reported";
    }
  }

  #renderRecordingAvailability(): void {
    if (this.#recordingUnavailable) {
      this.#recordingStatus.textContent = "Recording unavailable";
      this.#recordingNotice.textContent =
        "Recording is unavailable in this browser. Live microphone waveform and meters still work.";
      this.#recordingNotice.hidden = false;
    } else if (!this.isRecording) {
      this.#recordingNotice.hidden = true;
    }
  }

  #renderControls(): void {
    const active = this.isActive;
    const recording = this.isRecording;
    const busy = this.#starting || this.#switching || this.#stopping;

    this.#startButton.disabled = active || busy || this.#disposed;
    this.#stopButton.disabled = (!active && !recording) || this.#stopping;
    this.#recordButton.disabled =
      !active || recording || busy || this.#recordingUnavailable;
    this.#stopRecordingButton.disabled = !recording || this.#stopping;
    this.#inputSelect.disabled = !active || recording || busy;
  }

  #renderIdle(label: string): void {
    this.#root.dataset.micState = "idle";
    this.#activeInputLabel.textContent = "No active input";
    this.#inputField.hidden = true;
    this.#playback.hidden = true;
    this.#recordingStatus.textContent = "No local recording yet";
    this.#recordingNotice.hidden = true;
    this.#clearMeterReadouts();
    this.#clearCaptureDetails();
    this.#hideErrors();
    this.#setStatus("idle", label);
    this.#renderControls();
  }

  #setStatus(state: string, label: string): void {
    this.#root.dataset.micState = state;
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
  }

  #clearMeterReadouts(): void {
    this.#rmsValue.textContent = "—";
    this.#peakValue.textContent = "—";
  }

  async #resetFailedSession(): Promise<void> {
    this.#stopMeterAndWaveform();
    const session = this.#session;
    this.#clearServiceReferences();
    if (session) {
      try {
        await session.dispose();
      } catch (error) {
        console.error("Microphone Test failed-session cleanup failed", error);
      }
    }
  }

  #clearServiceReferences(): void {
    this.#session = null;
    this.#microphone = null;
    this.#analyzer = null;
    this.#recorder = null;
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
