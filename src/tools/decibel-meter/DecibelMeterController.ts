import {
  AudioAnalyzer,
  METER_DBFS_FLOOR,
  METER_UPDATE_INTERVAL_MS,
  type MeterReading,
} from "../../browser/analysis/AudioAnalyzer";
import {
  DB_CALIBRATION_TARGET_SAMPLES,
  DB_CALIBRATION_WINDOW_MS,
  DbCalibrationStore,
  estimateReferenceCalibratedLevel,
  evaluateCalibrationWindow,
  isReferenceCalibrationEligible,
  meterReadingToCalibrationSample,
  type CalibrationRecord,
  type CalibrationSample,
} from "../../browser/analysis/dbCalibration";
import { AudioSession } from "../../browser/audio-session/AudioSession";
import {
  MicrophoneService,
  type MicrophoneInputDevice,
} from "../../browser/microphone/MicrophoneService";

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Decibel Meter is missing required element: ${selector}`);
  }
  return element;
}

function formatDbfs(value: number): string {
  return `${Math.max(METER_DBFS_FLOOR, value).toFixed(1)} dBFS`;
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

function calibrationFailureMessage(
  reason: "insufficient-valid-samples" | "clipping" | "unstable",
): string {
  if (reason === "clipping") {
    return "Calibration rejected: the browser microphone signal clipped above -1 dBFS. Reduce the input level and repeat with the same reference conditions.";
  }
  if (reason === "unstable") {
    return "Calibration rejected: the 3-second RMS window varied by more than 1.5 dB. Use a steadier reference sound field and try again.";
  }
  return "Calibration rejected: fewer than 25 valid RMS samples were collected in the 3-second window. Try again while keeping the page active.";
}

interface ActiveCalibration {
  readonly record: CalibrationRecord;
  readonly scope: "device-stored" | "session-only";
  readonly deviceId: string | null;
}

export class DecibelMeterController {
  readonly #root: HTMLElement;
  readonly #listeners = new AbortController();
  readonly #startButton: HTMLButtonElement;
  readonly #stopButton: HTMLButtonElement;
  readonly #inputField: HTMLElement;
  readonly #inputSelect: HTMLSelectElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #activeInputLabel: HTMLElement;
  readonly #rmsValue: HTMLElement;
  readonly #peakValue: HTMLElement;
  readonly #meterFill: HTMLElement;
  readonly #estimatePanel: HTMLElement;
  readonly #estimateValue: HTMLElement;
  readonly #estimateBadge: HTMLElement;
  readonly #calibrationEligibility: HTMLElement;
  readonly #referenceInput: HTMLInputElement;
  readonly #weightingConfirm: HTMLInputElement;
  readonly #calibrateButton: HTMLButtonElement;
  readonly #calibrationStatus: HTMLElement;
  readonly #calibrationLiveStatus: HTMLElement;
  readonly #detailsDeviceId: HTMLElement;
  readonly #detailsAnalysisSampleRate: HTMLElement;
  readonly #detailsSampleRate: HTMLElement;
  readonly #detailsChannelCount: HTMLElement;
  readonly #detailsEchoCancellation: HTMLElement;
  readonly #detailsNoiseSuppression: HTMLElement;
  readonly #detailsAutoGainControl: HTMLElement;
  readonly #errorMessage: HTMLElement;
  readonly #selectionError: HTMLElement;
  readonly #calibrationStore: DbCalibrationStore | null;

  #session: AudioSession | null = null;
  #microphone: MicrophoneService | null = null;
  #analyzer: AudioAnalyzer | null = null;
  #meterTimer: number | null = null;
  #devices: readonly MicrophoneInputDevice[] = [];
  #activeCalibration: ActiveCalibration | null = null;
  #calibrationSamples: CalibrationSample[] = [];
  #calibrationTimer: number | null = null;
  #calibrating = false;
  #starting = false;
  #switching = false;
  #stopping = false;
  #disposed = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#startButton = requireElement(root, "[data-db-start]");
    this.#stopButton = requireElement(root, "[data-db-stop]");
    this.#inputField = requireElement(root, "[data-db-input-field]");
    this.#inputSelect = requireElement(root, "[data-db-input]");
    this.#status = requireElement(root, "#decibel-meter-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#activeInputLabel = requireElement(root, "[data-db-active-input]");
    this.#rmsValue = requireElement(root, "[data-db-rms]");
    this.#peakValue = requireElement(root, "[data-db-peak]");
    this.#meterFill = requireElement(root, "[data-db-meter-fill]");
    this.#estimatePanel = requireElement(root, "[data-db-estimate-panel]");
    this.#estimateValue = requireElement(root, "[data-db-estimate]");
    this.#estimateBadge = requireElement(root, "[data-db-estimate-badge]");
    this.#calibrationEligibility = requireElement(root, "[data-db-calibration-eligibility]");
    this.#referenceInput = requireElement(root, "[data-db-reference]");
    this.#weightingConfirm = requireElement(root, "[data-db-weighting-confirm]");
    this.#calibrateButton = requireElement(root, "[data-db-calibrate]");
    this.#calibrationStatus = requireElement(root, "[data-db-calibration-status]");
    this.#calibrationLiveStatus = requireElement(root, "[data-db-calibration-live-status]");
    this.#detailsDeviceId = requireElement(root, "[data-db-detail-device-id]");
    this.#detailsAnalysisSampleRate = requireElement(root, "[data-db-detail-analysis-rate]");
    this.#detailsSampleRate = requireElement(root, "[data-db-detail-sample-rate]");
    this.#detailsChannelCount = requireElement(root, "[data-db-detail-channel-count]");
    this.#detailsEchoCancellation = requireElement(root, "[data-db-detail-echo-cancellation]");
    this.#detailsNoiseSuppression = requireElement(root, "[data-db-detail-noise-suppression]");
    this.#detailsAutoGainControl = requireElement(root, "[data-db-detail-auto-gain]");
    this.#errorMessage = requireElement(root, "[data-db-error]");
    this.#selectionError = requireElement(root, "[data-db-selection-error]");

    let store: DbCalibrationStore | null = null;
    try {
      store = new DbCalibrationStore(window.localStorage);
    } catch {
      store = null;
    }
    this.#calibrationStore = store;

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
    this.#cancelCalibrationCapture();
    this.#stopMeter();
    this.#microphone?.stop();
    this.#activeCalibration = null;

    const session = this.#session;
    this.#clearServiceReferences();
    if (session) await session.dispose();
  }

  #bindEvents(): void {
    const signal = this.#listeners.signal;
    this.#startButton.addEventListener("click", () => void this.#startMicrophone(), {
      signal,
    });
    this.#stopButton.addEventListener("click", () => this.#stopTool(), { signal });
    this.#inputSelect.addEventListener(
      "change",
      () => void this.#switchInput(this.#inputSelect.value),
      { signal },
    );
    this.#referenceInput.addEventListener("input", () => this.#renderControls(), {
      signal,
    });
    this.#weightingConfirm.addEventListener("change", () => this.#renderControls(), {
      signal,
    });
    this.#calibrateButton.addEventListener(
      "click",
      () => this.#startCalibrationCapture(),
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
    if (this.#disposed) throw new Error("Decibel Meter was disposed during Start");

    const microphone = new MicrophoneService(context);
    session.register(microphone);
    const analyzer = new AudioAnalyzer(context);
    session.register(analyzer);
    microphone.connectAnalysisTarget(analyzer.inputNode);

    this.#microphone = microphone;
    this.#analyzer = analyzer;
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
      const { microphone, analyzer } = await this.#ensureServices();
      const capture = await microphone.startDefault();
      if (!this.#isCurrent(token)) return;

      analyzer.resetMeter();
      this.#starting = false;
      this.#renderDevices(this.#devices, capture.settings.deviceId);
      this.#renderCaptureDetails();
      this.#selectCalibrationForActiveInput();
      this.#startMeter();
      this.#setStatus("playing", "Measuring digital microphone level");
      this.#renderControls();
      void this.#refreshInputDevices(token, capture.settings.deviceId);
    } catch (error) {
      if (!this.#isCurrent(token)) return;
      this.#starting = false;
      console.error("Decibel Meter capture failed", error);
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
      this.#stopping ||
      this.#calibrating ||
      this.#disposed ||
      !deviceId
    ) {
      return;
    }

    const token = ++this.#runToken;
    const previousDeviceId = microphone.activeSettings()?.deviceId ?? "";
    this.#switching = true;
    this.#cancelCalibrationCapture();
    this.#stopMeter();
    this.#clearMeterReadouts();
    this.#selectionError.hidden = true;
    this.#setStatus("ready", "Switching input…");
    this.#renderControls();

    try {
      const capture = await microphone.switchToExactDevice(deviceId);
      if (!this.#isCurrent(token)) return;

      analyzer.resetMeter();
      this.#switching = false;
      this.#renderDevices(this.#devices, capture.settings.deviceId);
      this.#renderCaptureDetails();
      this.#selectCalibrationForActiveInput();
      this.#startMeter();
      this.#setStatus("playing", "Measuring digital microphone level");
      this.#renderControls();
      void this.#refreshInputDevices(token, capture.settings.deviceId);
    } catch (error) {
      if (!this.#isCurrent(token)) return;
      console.error("Decibel Meter input switch failed", error);
      this.#inputSelect.value = previousDeviceId;
      this.#selectionError.textContent =
        "That input could not be opened. The previous microphone remains active.";
      this.#selectionError.hidden = false;
      this.#startMeter();
      this.#setStatus("playing", "Measuring digital microphone level");
    } finally {
      if (token === this.#runToken) {
        this.#switching = false;
        if (!this.#disposed) this.#renderControls();
      }
    }
  }

  #startMeter(): void {
    const analyzer = this.#analyzer;
    if (!analyzer) return;
    this.#stopMeter();

    const update = () => {
      if (!this.isActive || this.#disposed || this.#switching) return;
      try {
        this.#renderMeterReading(analyzer.readMeter(performance.now()));
      } catch (error) {
        console.error("Decibel Meter update failed", error);
      }
    };
    update();
    this.#meterTimer = window.setInterval(update, METER_UPDATE_INTERVAL_MS);
  }

  #stopMeter(): void {
    if (this.#meterTimer === null) return;
    window.clearInterval(this.#meterTimer);
    this.#meterTimer = null;
  }

  #renderMeterReading(reading: MeterReading): void {
    this.#rmsValue.textContent = formatDbfs(reading.rmsDbfs);
    this.#peakValue.textContent = formatDbfs(reading.heldPeakDbfs);
    const meterPercent = Math.min(100, Math.max(0, reading.rmsDbfs + 100));
    this.#meterFill.style.setProperty("--db-meter-fill", `${meterPercent}%`);

    if (
      this.#calibrating &&
      this.#calibrationSamples.length < DB_CALIBRATION_TARGET_SAMPLES
    ) {
      this.#calibrationSamples.push(meterReadingToCalibrationSample(reading));
      this.#calibrationStatus.textContent = `Collecting stable reference… ${this.#calibrationSamples.length}/${DB_CALIBRATION_TARGET_SAMPLES} samples`;
    }

    const calibration = this.#activeCalibration;
    if (calibration && this.#isCalibrationEligibleNow()) {
      this.#estimateValue.textContent = `${estimateReferenceCalibratedLevel(
        reading.rmsDbfs,
        calibration.record.offset,
      ).toFixed(1)} dB`;
      this.#estimatePanel.hidden = false;
    } else {
      this.#estimateValue.textContent = "—";
      this.#estimatePanel.hidden = true;
    }
  }

  #startCalibrationCapture(): void {
    if (
      !this.isActive ||
      !this.#isCalibrationEligibleNow() ||
      this.#calibrating ||
      this.#switching ||
      this.#stopping ||
      !this.#weightingConfirm.checked
    ) {
      return;
    }

    const referenceDbSpl = Number(this.#referenceInput.value);
    if (!Number.isFinite(referenceDbSpl) || this.#referenceInput.value.trim() === "") {
      this.#calibrationStatus.textContent =
        "Enter the external reference meter reading before calibration.";
      return;
    }

    this.#hideErrors();
    this.#calibrating = true;
    this.#calibrationSamples = [];
    this.#calibrationStatus.textContent =
      "Collecting a 3-second reference window… keep the sound field steady.";
    this.#calibrationLiveStatus.textContent = "Calibration capture started";
    this.#renderControls();

    this.#calibrationTimer = window.setTimeout(() => {
      this.#calibrationTimer = null;
      this.#finishCalibrationCapture(referenceDbSpl);
    }, DB_CALIBRATION_WINDOW_MS);
  }

  #finishCalibrationCapture(referenceDbSpl: number): void {
    if (!this.#calibrating || this.#disposed) return;
    this.#calibrating = false;

    if (!this.isActive || !this.#isCalibrationEligibleNow()) {
      this.#calibrationSamples = [];
      this.#calibrationStatus.textContent =
        "Calibration cancelled because the active input changed or became unavailable.";
      this.#calibrationLiveStatus.textContent = "Calibration cancelled";
      this.#renderControls();
      return;
    }

    const result = evaluateCalibrationWindow(this.#calibrationSamples, referenceDbSpl);
    this.#calibrationSamples = [];
    if (!result.ok) {
      this.#calibrationStatus.textContent = calibrationFailureMessage(result.reason);
      this.#calibrationLiveStatus.textContent = "Calibration rejected";
      this.#renderControls();
      return;
    }

    const settings = this.#microphone?.activeSettings();
    const deviceId = settings?.deviceId || null;
    const label = deviceLabel(this.#devices, settings?.deviceId);
    const record: CalibrationRecord = {
      offset: result.result.offset,
      createdAt: Date.now(),
      optionalLabel: label,
    };

    let scope: ActiveCalibration["scope"] = "session-only";
    if (deviceId && this.#calibrationStore?.save(deviceId, record)) {
      scope = "device-stored";
    }
    this.#activeCalibration = { record, scope, deviceId };
    this.#calibrationStatus.textContent =
      scope === "device-stored"
        ? "User-calibrated · saved for this reported input device"
        : "User-calibrated · session only";
    this.#calibrationLiveStatus.textContent = "Calibration accepted";
    this.#renderCalibrationState();
    this.#renderControls();
  }

  #cancelCalibrationCapture(): void {
    if (this.#calibrationTimer !== null) {
      window.clearTimeout(this.#calibrationTimer);
      this.#calibrationTimer = null;
    }
    if (this.#calibrating) {
      this.#calibrationLiveStatus.textContent = "Calibration cancelled";
    }
    this.#calibrating = false;
    this.#calibrationSamples = [];
  }

  #isCalibrationEligibleNow(): boolean {
    const settings = this.#microphone?.activeSettings();
    return Boolean(settings && isReferenceCalibrationEligible(settings));
  }

  #selectCalibrationForActiveInput(): void {
    const settings = this.#microphone?.activeSettings();
    this.#activeCalibration = null;
    if (!settings || !isReferenceCalibrationEligible(settings)) {
      this.#renderCalibrationState();
      return;
    }

    const deviceId = settings.deviceId || null;
    if (deviceId) {
      const stored = this.#calibrationStore?.load(deviceId) ?? null;
      if (stored) {
        this.#activeCalibration = {
          record: stored,
          scope: "device-stored",
          deviceId,
        };
      }
    }
    this.#renderCalibrationState();
  }

  #renderCalibrationState(): void {
    const active = this.isActive;
    const eligible = this.#isCalibrationEligibleNow();
    const calibration = this.#activeCalibration;

    if (!active) {
      this.#calibrationEligibility.textContent =
        "Start the microphone to check whether reference calibration is eligible.";
      this.#calibrationStatus.textContent = "Uncalibrated";
      this.#estimatePanel.hidden = true;
      this.#estimateValue.textContent = "—";
      this.#estimateBadge.textContent = "Uncalibrated";
      return;
    }

    if (!eligible) {
      this.#calibrationEligibility.textContent =
        "Reference calibration unavailable: auto gain control, noise suppression and echo cancellation must all be explicitly reported Off by the browser.";
      this.#calibrationStatus.textContent = "dBFS only";
      this.#estimatePanel.hidden = true;
      this.#estimateValue.textContent = "—";
      this.#estimateBadge.textContent = "Uncalibrated";
      return;
    }

    this.#calibrationEligibility.textContent =
      "Eligible: browser settings report auto gain control, noise suppression and echo cancellation all Off.";
    if (!calibration) {
      this.#calibrationStatus.textContent = "Uncalibrated";
      this.#estimatePanel.hidden = true;
      this.#estimateValue.textContent = "—";
      this.#estimateBadge.textContent = "Uncalibrated";
      return;
    }

    this.#estimateBadge.textContent = "User-calibrated";
    this.#calibrationStatus.textContent =
      calibration.scope === "device-stored"
        ? "User-calibrated · saved for this reported input device"
        : "User-calibrated · session only";
  }

  async #stopTool(): Promise<void> {
    if (!this.isActive || this.#stopping || this.#disposed) return;
    ++this.#runToken;
    this.#starting = false;
    this.#switching = false;
    this.#stopping = true;
    this.#cancelCalibrationCapture();
    this.#stopMeter();
    this.#setStatus("ready", "Stopping Decibel Meter…");
    this.#renderControls();

    const sessionCalibration = this.#activeCalibration?.scope === "session-only";
    this.#microphone?.stop();
    this.#analyzer?.resetMeter();
    this.#activeCalibration = sessionCalibration ? null : this.#activeCalibration;
    this.#clearMeterReadouts();
    this.#clearCaptureDetails();
    this.#activeInputLabel.textContent = "No active input";
    this.#stopping = false;
    this.#setStatus("idle", "Stopped");
    this.#renderCalibrationState();
    this.#renderControls();
  }

  #handleTrackEnded(): void {
    if (this.#disposed) return;
    ++this.#runToken;
    this.#starting = false;
    this.#switching = false;
    this.#stopping = false;
    this.#cancelCalibrationCapture();
    this.#stopMeter();
    this.#analyzer?.resetMeter();
    this.#activeCalibration = null;
    this.#clearMeterReadouts();
    this.#clearCaptureDetails();
    this.#activeInputLabel.textContent = "Input device disconnected";
    this.#setStatus("error", "Input device disconnected");
    this.#renderCalibrationState();
    this.#renderControls();
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
      console.warn("Decibel Meter input metadata refresh failed", error);
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

  #renderCaptureDetails(): void {
    const settings = this.#microphone?.activeSettings();
    const analyzer = this.#analyzer;
    if (!settings || !analyzer) {
      this.#clearCaptureDetails();
      return;
    }
    this.#detailsDeviceId.textContent = settings.deviceId || "Not reported";
    this.#detailsAnalysisSampleRate.textContent = `${analyzer.analysisSampleRate} Hz`;
    this.#detailsSampleRate.textContent = formatNumber(settings.sampleRate, " Hz");
    this.#detailsChannelCount.textContent = formatNumber(settings.channelCount);
    this.#detailsEchoCancellation.textContent = formatBoolean(settings.echoCancellation);
    this.#detailsNoiseSuppression.textContent = formatBoolean(settings.noiseSuppression);
    this.#detailsAutoGainControl.textContent = formatBoolean(settings.autoGainControl);
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

  #renderControls(): void {
    const active = this.isActive;
    const busy = this.#starting || this.#switching || this.#stopping;
    const referenceReady =
      this.#referenceInput.value.trim() !== "" &&
      Number.isFinite(Number(this.#referenceInput.value));

    this.#startButton.disabled = active || busy || this.#disposed;
    this.#stopButton.disabled = !active || this.#stopping;
    this.#inputSelect.disabled = !active || busy || this.#calibrating;
    this.#referenceInput.disabled = !active || !this.#isCalibrationEligibleNow() || this.#calibrating;
    this.#weightingConfirm.disabled =
      !active || !this.#isCalibrationEligibleNow() || this.#calibrating;
    this.#calibrateButton.disabled =
      !active ||
      busy ||
      this.#calibrating ||
      !this.#isCalibrationEligibleNow() ||
      !this.#weightingConfirm.checked ||
      !referenceReady;
  }

  #renderIdle(label: string): void {
    this.#root.dataset.dbState = "idle";
    this.#activeInputLabel.textContent = "No active input";
    this.#inputField.hidden = true;
    this.#clearMeterReadouts();
    this.#clearCaptureDetails();
    this.#hideErrors();
    this.#calibrationLiveStatus.textContent = "";
    this.#renderCalibrationState();
    this.#setStatus("idle", label);
    this.#renderControls();
  }

  #clearMeterReadouts(): void {
    this.#rmsValue.textContent = "—";
    this.#peakValue.textContent = "—";
    this.#meterFill.style.setProperty("--db-meter-fill", "0%");
    this.#estimateValue.textContent = "—";
    this.#estimatePanel.hidden = true;
  }

  #setStatus(state: string, label: string): void {
    this.#root.dataset.dbState = state;
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
  }

  async #resetFailedSession(): Promise<void> {
    this.#cancelCalibrationCapture();
    this.#stopMeter();
    const session = this.#session;
    this.#clearServiceReferences();
    this.#activeCalibration = null;
    if (session) {
      try {
        await session.dispose();
      } catch (error) {
        console.error("Decibel Meter failed-session cleanup failed", error);
      }
    }
  }

  #clearServiceReferences(): void {
    this.#session = null;
    this.#microphone = null;
    this.#analyzer = null;
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
