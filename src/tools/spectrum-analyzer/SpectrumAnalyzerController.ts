import {
  AudioAnalyzer,
  SPECTRUM_DEFAULT_FFT_SIZE,
  SPECTRUM_DEFAULT_SMOOTHING,
  isSpectrumFftSize,
  type SpectrumFftSize,
} from "../../browser/analysis/AudioAnalyzer";
import { AudioSession } from "../../browser/audio-session/AudioSession";
import {
  MicrophoneService,
  type MicrophoneInputDevice,
} from "../../browser/microphone/MicrophoneService";
import {
  SPECTROGRAM_MIN_COLUMN_INTERVAL_MS,
  SPECTRUM_MAX_RENDER_FPS,
  SpectrogramHistory,
  findDominantFftBin,
  getSpectrumDisplayMaxHz,
} from "./model";
import { SpectrogramCanvas, SpectrumCanvas } from "./renderers";
import { AnalyzerWaveformCanvas } from "./waveformRenderer";

type AnalyzerView = "spectrum" | "waveform" | "spectrogram";

const SPECTRUM_RENDER_INTERVAL_MS = 1_000 / SPECTRUM_MAX_RENDER_FPS;

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Spectrum Analyzer is missing required element: ${selector}`);
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

export class SpectrumAnalyzerController {
  readonly #root: HTMLElement;
  readonly #listeners = new AbortController();
  readonly #startButton: HTMLButtonElement;
  readonly #stopButton: HTMLButtonElement;
  readonly #viewButtons: readonly HTMLButtonElement[];
  readonly #fftSelect: HTMLSelectElement;
  readonly #inputField: HTMLElement;
  readonly #inputSelect: HTMLSelectElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #activeInputLabel: HTMLElement;
  readonly #dominantValue: HTMLElement;
  readonly #analysisRateValue: HTMLElement;
  readonly #fftValue: HTMLElement;
  readonly #binWidthValue: HTMLElement;
  readonly #rangeValue: HTMLElement;
  readonly #canvas: HTMLCanvasElement;
  readonly #errorMessage: HTMLElement;
  readonly #selectionError: HTMLElement;

  readonly #spectrumCanvas: SpectrumCanvas;
  readonly #waveformCanvas: AnalyzerWaveformCanvas;
  readonly #spectrogramCanvas: SpectrogramCanvas;
  readonly #spectrogramHistory = new SpectrogramHistory();

  #session: AudioSession | null = null;
  #microphone: MicrophoneService | null = null;
  #analyzer: AudioAnalyzer | null = null;
  #devices: readonly MicrophoneInputDevice[] = [];
  #view: AnalyzerView = "spectrum";
  #fftSize: SpectrumFftSize = SPECTRUM_DEFAULT_FFT_SIZE;
  #frequencyBuffer: Float32Array | null = null;
  #waveformBuffer: Float32Array | null = null;
  #animationFrame: number | null = null;
  #lastRenderTimestampMs = Number.NEGATIVE_INFINITY;
  #starting = false;
  #switching = false;
  #stopping = false;
  #disposed = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#startButton = requireElement(root, "[data-spectrum-start]");
    this.#stopButton = requireElement(root, "[data-spectrum-stop]");
    this.#viewButtons = Array.from(
      root.querySelectorAll<HTMLButtonElement>("[data-spectrum-view]"),
    );
    if (this.#viewButtons.length !== 3) {
      throw new Error("Spectrum Analyzer requires exactly three view controls");
    }
    this.#fftSelect = requireElement(root, "[data-spectrum-fft]");
    this.#inputField = requireElement(root, "[data-spectrum-input-field]");
    this.#inputSelect = requireElement(root, "[data-spectrum-input]");
    this.#status = requireElement(root, "#spectrum-analyzer-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#activeInputLabel = requireElement(root, "[data-spectrum-active-input]");
    this.#dominantValue = requireElement(root, "[data-spectrum-dominant]");
    this.#analysisRateValue = requireElement(root, "[data-spectrum-analysis-rate]");
    this.#fftValue = requireElement(root, "[data-spectrum-fft-value]");
    this.#binWidthValue = requireElement(root, "[data-spectrum-bin-width]");
    this.#rangeValue = requireElement(root, "[data-spectrum-range]");
    this.#canvas = requireElement(root, "[data-spectrum-canvas]");
    this.#errorMessage = requireElement(root, "[data-spectrum-error]");
    this.#selectionError = requireElement(root, "[data-spectrum-selection-error]");

    this.#spectrumCanvas = new SpectrumCanvas(this.#canvas);
    this.#waveformCanvas = new AnalyzerWaveformCanvas(this.#canvas);
    this.#spectrogramCanvas = new SpectrogramCanvas(this.#canvas);

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
    this.#stopRendering();
    this.#microphone?.stop();
    this.#clearVisualState();

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
    this.#fftSelect.addEventListener("change", () => this.#changeFft(), { signal });
    for (const button of this.#viewButtons) {
      button.addEventListener(
        "click",
        () => {
          const view = button.dataset.spectrumView;
          if (
            view === "spectrum" ||
            view === "waveform" ||
            view === "spectrogram"
          ) {
            this.#setView(view);
          }
        },
        { signal },
      );
    }
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
      throw new Error("Spectrum Analyzer was disposed during Start");
    }

    const microphone = new MicrophoneService(context);
    session.register(microphone);

    const analyzer = new AudioAnalyzer(context);
    session.register(analyzer);
    analyzer.configureSpectrum({
      fftSize: this.#fftSize,
      smoothingTimeConstant: SPECTRUM_DEFAULT_SMOOTHING,
    });
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
      const { microphone } = await this.#ensureServices();
      const capture = await microphone.startDefault();
      if (!this.#isCurrent(token)) return;

      this.#starting = false;
      this.#clearVisualState();
      this.#renderDevices(this.#devices, capture.settings.deviceId);
      this.#renderAnalysisDetails();
      this.#setStatus("playing", "Analyzing microphone");
      this.#renderControls();
      this.#startRendering();
      void this.#refreshInputDevices(token, capture.settings.deviceId);
    } catch (error) {
      if (!this.#isCurrent(token)) return;
      this.#starting = false;
      console.error("Spectrum Analyzer capture failed", error);
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
    this.#selectionError.hidden = true;
    this.#setStatus("ready", "Switching input…");
    this.#renderControls();

    try {
      const capture = await microphone.switchToExactDevice(deviceId);
      if (!this.#isCurrent(token)) return;

      this.#clearVisualState();
      this.#switching = false;
      this.#renderDevices(this.#devices, capture.settings.deviceId);
      this.#renderAnalysisDetails();
      this.#setStatus("playing", "Analyzing microphone");
      this.#renderControls();
      void this.#refreshInputDevices(token, capture.settings.deviceId);
    } catch (error) {
      if (!this.#isCurrent(token)) return;
      console.error("Spectrum Analyzer input switch failed", error);
      this.#inputSelect.value = previousDeviceId;
      this.#selectionError.textContent =
        "That input could not be opened. The previous microphone remains active.";
      this.#selectionError.hidden = false;
      this.#setStatus("playing", "Analyzing microphone");
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
    this.#setStatus("ready", "Stopping analyzer…");
    this.#renderControls();

    this.#stopRendering();
    this.#microphone?.stop();
    this.#clearVisualState();
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
    this.#stopRendering();
    this.#clearVisualState();
    this.#activeInputLabel.textContent = "Input device disconnected";
    this.#inputField.hidden = true;
    this.#setStatus("error", "Input device disconnected");
    this.#renderControls();
  }

  #changeFft(): void {
    const value = Number(this.#fftSelect.value);
    if (!isSpectrumFftSize(value)) {
      this.#fftSelect.value = String(this.#fftSize);
      return;
    }

    const previous = this.#fftSize;
    try {
      this.#analyzer?.configureSpectrum({ fftSize: value });
      this.#fftSize = value;
      this.#frequencyBuffer = null;
      this.#waveformBuffer = null;
      this.#spectrogramHistory.clear();
      this.#dominantValue.textContent = "—";
      this.#clearCanvas();
      this.#lastRenderTimestampMs = Number.NEGATIVE_INFINITY;
      this.#renderAnalysisDetails();
    } catch (error) {
      console.error("Spectrum Analyzer FFT change failed", error);
      this.#fftSize = previous;
      this.#fftSelect.value = String(previous);
      this.#showError(
        "That FFT size could not be applied in the current browser session.",
      );
    }
  }

  #setView(view: AnalyzerView): void {
    if (view === this.#view) return;
    this.#view = view;
    this.#lastRenderTimestampMs = Number.NEGATIVE_INFINITY;
    this.#dominantValue.textContent = "—";
    this.#clearCanvas();
    if (view === "spectrogram") this.#spectrogramHistory.clear();
    this.#renderControls();
  }

  #startRendering(): void {
    this.#stopRendering();
    this.#lastRenderTimestampMs = Number.NEGATIVE_INFINITY;

    const frame = (timestampMs: number) => {
      if (!this.isActive || this.#disposed) {
        this.#animationFrame = null;
        return;
      }

      const intervalMs =
        this.#view === "spectrogram"
          ? SPECTROGRAM_MIN_COLUMN_INTERVAL_MS
          : SPECTRUM_RENDER_INTERVAL_MS;

      if (timestampMs - this.#lastRenderTimestampMs >= intervalMs) {
        this.#lastRenderTimestampMs = timestampMs;
        this.#renderFrame(timestampMs);
      }
      this.#animationFrame = window.requestAnimationFrame(frame);
    };

    this.#animationFrame = window.requestAnimationFrame(frame);
  }

  #stopRendering(): void {
    if (this.#animationFrame === null) return;
    window.cancelAnimationFrame(this.#animationFrame);
    this.#animationFrame = null;
  }

  #renderFrame(timestampMs: number): void {
    const analyzer = this.#analyzer;
    if (!analyzer) return;

    try {
      if (this.#view === "waveform") {
        const buffer = this.#ensureWaveformBuffer(analyzer);
        analyzer.readWaveform(buffer);
        this.#waveformCanvas.draw(buffer);
        return;
      }

      const frequencyData = this.#ensureFrequencyBuffer(analyzer);
      analyzer.readFrequencyData(frequencyData);

      if (this.#view === "spectrogram") {
        this.#spectrogramHistory.ingest(timestampMs, frequencyData);
        this.#spectrogramCanvas.draw(
          this.#spectrogramHistory.columnsForRender(timestampMs),
          timestampMs,
          analyzer.analysisSampleRate,
          analyzer.spectrumFftSize,
        );
        return;
      }

      this.#spectrumCanvas.draw(
        frequencyData,
        analyzer.analysisSampleRate,
        analyzer.spectrumFftSize,
      );
      const dominant = findDominantFftBin(
        frequencyData,
        analyzer.analysisSampleRate,
        analyzer.spectrumFftSize,
      );
      this.#dominantValue.textContent = dominant
        ? `${Math.round(dominant.frequencyHz)} Hz`
        : "—";
    } catch (error) {
      console.error("Spectrum Analyzer render failed", error);
    }
  }

  #ensureFrequencyBuffer(analyzer: AudioAnalyzer): Float32Array {
    if (
      !this.#frequencyBuffer ||
      this.#frequencyBuffer.length !== analyzer.frequencyBinCount
    ) {
      this.#frequencyBuffer = new Float32Array(analyzer.frequencyBinCount);
    }
    return this.#frequencyBuffer;
  }

  #ensureWaveformBuffer(analyzer: AudioAnalyzer): Float32Array {
    if (
      !this.#waveformBuffer ||
      this.#waveformBuffer.length !== analyzer.spectrumFftSize
    ) {
      this.#waveformBuffer = new Float32Array(analyzer.spectrumFftSize);
    }
    return this.#waveformBuffer;
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
      console.warn("Spectrum Analyzer input metadata refresh failed", error);
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
    const analyzer = this.#analyzer;
    if (!analyzer) {
      this.#analysisRateValue.textContent = "Not active";
      this.#fftValue.textContent = String(this.#fftSize);
      this.#binWidthValue.textContent = "—";
      this.#rangeValue.textContent = "20 Hz → —";
      return;
    }

    const maxHz = getSpectrumDisplayMaxHz(analyzer.analysisSampleRate);
    this.#analysisRateValue.textContent = `${analyzer.analysisSampleRate} Hz`;
    this.#fftValue.textContent = String(analyzer.spectrumFftSize);
    this.#binWidthValue.textContent = `${analyzer.frequencyBinWidthHz.toFixed(1)} Hz`;
    this.#rangeValue.textContent = `20 Hz → ${Math.round(maxHz)} Hz`;
  }

  #clearVisualState(): void {
    this.#frequencyBuffer = null;
    this.#waveformBuffer = null;
    this.#spectrogramHistory.clear();
    this.#dominantValue.textContent = "—";
    this.#lastRenderTimestampMs = Number.NEGATIVE_INFINITY;
    this.#clearCanvas();
  }

  #clearCanvas(): void {
    this.#spectrumCanvas.clear();
  }

  #renderControls(): void {
    const active = this.isActive;
    const busy = this.#starting || this.#switching || this.#stopping;

    this.#startButton.disabled = active || busy || this.#disposed;
    this.#stopButton.disabled = !active || this.#stopping;
    this.#inputSelect.disabled = !active || busy;
    this.#fftSelect.disabled = busy || this.#disposed;

    for (const button of this.#viewButtons) {
      const selected = button.dataset.spectrumView === this.#view;
      button.setAttribute("aria-pressed", String(selected));
    }
  }

  #renderIdle(label: string): void {
    this.#root.dataset.spectrumState = "idle";
    this.#fftSelect.value = String(this.#fftSize);
    this.#activeInputLabel.textContent = "No active input";
    this.#inputField.hidden = true;
    this.#hideErrors();
    this.#clearVisualState();
    this.#renderAnalysisDetails();
    this.#setStatus("idle", label);
    this.#renderControls();
  }

  #setStatus(state: string, label: string): void {
    this.#root.dataset.spectrumState = state;
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
  }

  async #resetFailedSession(): Promise<void> {
    this.#stopRendering();
    const session = this.#session;
    this.#clearServiceReferences();
    this.#clearVisualState();
    if (session) {
      try {
        await session.dispose();
      } catch (error) {
        console.error("Spectrum Analyzer failed-session cleanup failed", error);
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
