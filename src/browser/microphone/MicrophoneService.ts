import type { SessionResource } from "../audio-session/AudioSession";

export interface MicrophoneInputDevice {
  readonly deviceId: string;
  readonly groupId: string;
  readonly label: string;
}

export type MicrophoneCaptureSettings = Readonly<
  Omit<
    MediaTrackSettings,
    "autoGainControl" | "noiseSuppression" | "echoCancellation"
  > & {
    readonly autoGainControl?: boolean;
    readonly noiseSuppression?: boolean;
    readonly echoCancellation?: boolean;
  }
>;

export interface MicrophoneCapture {
  readonly stream: MediaStream;
  readonly settings: MicrophoneCaptureSettings;
}

export interface MicrophoneTrackEndedEvent {
  readonly lastSettings: MicrophoneCaptureSettings;
}

export type MicrophoneTrackEndedListener = (
  event: MicrophoneTrackEndedEvent,
) => void;

export type MicrophoneDeviceListListener = (
  devices: readonly MicrophoneInputDevice[],
) => void;

function getBrowserMediaDevices(): MediaDevices {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    throw new Error("Microphone APIs are unavailable in this environment");
  }
  return navigator.mediaDevices;
}

function copySettings(settings: MediaTrackSettings): MicrophoneCaptureSettings {
  const { autoGainControl, noiseSuppression, echoCancellation, ...rest } = settings;

  return {
    ...rest,
    ...(typeof autoGainControl === "boolean" ? { autoGainControl } : {}),
    ...(typeof noiseSuppression === "boolean" ? { noiseSuppression } : {}),
    ...(typeof echoCancellation === "boolean" ? { echoCancellation } : {}),
  };
}

function stopStreamTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

export function createMicrophoneAudioConstraints(
  supported: MediaTrackSupportedConstraints,
  exactDeviceId?: string,
): MediaTrackConstraints {
  const audio: MediaTrackConstraints = {};

  if (exactDeviceId !== undefined) {
    if (exactDeviceId.trim() === "") {
      throw new RangeError("deviceId must be a non-empty string");
    }
    audio.deviceId = { exact: exactDeviceId };
  }

  if (supported.echoCancellation === true) audio.echoCancellation = false;
  if (supported.noiseSuppression === true) audio.noiseSuppression = false;
  if (supported.autoGainControl === true) audio.autoGainControl = false;

  return audio;
}

export class MicrophoneService implements SessionResource {
  readonly #context: AudioContext;
  readonly #mediaDevices: MediaDevices;
  readonly #analysisTargets = new Set<AudioNode>();
  readonly #trackEndedListeners = new Set<MicrophoneTrackEndedListener>();
  readonly #deviceListListeners = new Set<MicrophoneDeviceListListener>();
  readonly #deviceChangeHandler: EventListener;

  #stream: MediaStream | null = null;
  #source: MediaStreamAudioSourceNode | null = null;
  #track: MediaStreamTrack | null = null;
  #settings: MicrophoneCaptureSettings | null = null;
  #trackEndedHandler: EventListener | null = null;
  #pendingAcquisition: Promise<MicrophoneCapture> | null = null;
  #lifecycleToken = 0;
  #disposed = false;

  constructor(context: AudioContext, mediaDevices?: MediaDevices) {
    this.#context = context;
    this.#mediaDevices = mediaDevices ?? getBrowserMediaDevices();
    this.#deviceChangeHandler = () => {
      void this.#publishDeviceListChanged();
    };
    this.#mediaDevices.addEventListener?.(
      "devicechange",
      this.#deviceChangeHandler,
    );
  }

  get isActive(): boolean {
    return this.#stream !== null && this.#track !== null && this.#source !== null;
  }

  get activeStream(): MediaStream | null {
    return this.#stream;
  }

  activeSettings(): MicrophoneCaptureSettings | null {
    return this.#settings ? { ...this.#settings } : null;
  }

  async listInputs(): Promise<readonly MicrophoneInputDevice[]> {
    this.#assertUsable();
    const devices = await this.#mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === "audioinput")
      .map((device) => ({
        deviceId: device.deviceId,
        groupId: device.groupId,
        label: device.label,
      }));
  }

  connectAnalysisTarget(target: AudioNode): () => void {
    this.#assertUsable();
    if (target.context !== this.#context) {
      throw new Error(
        "Microphone analysis targets must belong to the same AudioContext",
      );
    }
    if (target === this.#context.destination) {
      throw new Error(
        "Live microphone monitoring to AudioContext.destination is prohibited",
      );
    }

    if (!this.#analysisTargets.has(target)) {
      this.#source?.connect(target);
      this.#analysisTargets.add(target);
    }

    let connected = true;
    return () => {
      if (!connected) return;
      connected = false;
      if (!this.#analysisTargets.delete(target)) return;
      try {
        this.#source?.disconnect(target);
      } catch {
        // The active source may already have been disconnected during teardown.
      }
    };
  }

  async startDefault(): Promise<MicrophoneCapture> {
    this.#assertUsable();
    const current = this.#currentCapture();
    if (current) return current;
    if (this.#pendingAcquisition) return this.#pendingAcquisition;
    return this.#beginAcquisition();
  }

  async switchToExactDevice(deviceId: string): Promise<MicrophoneCapture> {
    this.#assertUsable();
    if (deviceId.trim() === "") {
      throw new RangeError("deviceId must be a non-empty string");
    }
    if (this.#pendingAcquisition) {
      throw new Error("Microphone acquisition is already in progress");
    }

    const currentSettings = this.#settings;
    if (this.isActive && currentSettings?.deviceId === deviceId) {
      const current = this.#currentCapture();
      if (current) return current;
    }

    return this.#beginAcquisition(deviceId);
  }

  onTrackEnded(listener: MicrophoneTrackEndedListener): () => void {
    this.#assertUsable();
    this.#trackEndedListeners.add(listener);
    return () => this.#trackEndedListeners.delete(listener);
  }

  onDeviceListChanged(listener: MicrophoneDeviceListListener): () => void {
    this.#assertUsable();
    this.#deviceListListeners.add(listener);
    return () => this.#deviceListListeners.delete(listener);
  }

  stop(): void {
    if (this.#disposed) return;
    this.#invalidatePendingAcquisition();
    this.#stopActiveCapture();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#invalidatePendingAcquisition();
    this.#stopActiveCapture();
    this.#disposed = true;
    this.#analysisTargets.clear();
    this.#trackEndedListeners.clear();
    this.#deviceListListeners.clear();
    this.#mediaDevices.removeEventListener?.(
      "devicechange",
      this.#deviceChangeHandler,
    );
  }

  #beginAcquisition(exactDeviceId?: string): Promise<MicrophoneCapture> {
    const token = this.#lifecycleToken;
    const operation = this.#acquireAndCommit(token, exactDeviceId);
    this.#pendingAcquisition = operation;

    const clearPending = () => {
      if (this.#pendingAcquisition === operation) {
        this.#pendingAcquisition = null;
      }
    };
    void operation.then(clearPending, clearPending);

    return operation;
  }

  async #acquireAndCommit(
    token: number,
    exactDeviceId?: string,
  ): Promise<MicrophoneCapture> {
    const supported = this.#mediaDevices.getSupportedConstraints();
    const audio = createMicrophoneAudioConstraints(supported, exactDeviceId);
    const stream = await this.#mediaDevices.getUserMedia({ audio });

    if (!this.#isCurrent(token)) {
      stopStreamTracks(stream);
      throw new DOMException("Microphone acquisition was cancelled", "AbortError");
    }

    const track = stream.getAudioTracks()[0];
    if (!track) {
      stopStreamTracks(stream);
      throw new Error("Microphone stream contains no audio track");
    }

    let source: MediaStreamAudioSourceNode;
    try {
      source = this.#context.createMediaStreamSource(stream);
    } catch (error) {
      stopStreamTracks(stream);
      throw error;
    }

    if (!this.#isCurrent(token)) {
      source.disconnect();
      stopStreamTracks(stream);
      throw new DOMException("Microphone acquisition was cancelled", "AbortError");
    }

    try {
      this.#connectSourceToAnalysisTargets(source);
    } catch (error) {
      source.disconnect();
      stopStreamTracks(stream);
      throw error;
    }

    const settings = copySettings(track.getSettings());
    this.#commitCapture(stream, source, track, settings);
    return { stream, settings: { ...settings } };
  }

  #connectSourceToAnalysisTargets(source: MediaStreamAudioSourceNode): void {
    for (const target of this.#analysisTargets) source.connect(target);
  }

  #commitCapture(
    stream: MediaStream,
    source: MediaStreamAudioSourceNode,
    track: MediaStreamTrack,
    settings: MicrophoneCaptureSettings,
  ): void {
    const oldStream = this.#stream;
    const oldSource = this.#source;
    const oldTrack = this.#track;
    const oldEndedHandler = this.#trackEndedHandler;

    if (oldTrack && oldEndedHandler) {
      oldTrack.removeEventListener("ended", oldEndedHandler);
    }
    oldSource?.disconnect();
    if (oldStream) stopStreamTracks(oldStream);

    this.#stream = stream;
    this.#source = source;
    this.#track = track;
    this.#settings = settings;

    const endedHandler: EventListener = () => this.#handleTrackEnded(track);
    this.#trackEndedHandler = endedHandler;
    track.addEventListener("ended", endedHandler, { once: true });
  }

  #handleTrackEnded(track: MediaStreamTrack): void {
    if (track !== this.#track) return;

    this.#invalidatePendingAcquisition();
    const lastSettings: MicrophoneCaptureSettings = this.#settings
      ? { ...this.#settings }
      : {};
    const stream = this.#stream;
    const source = this.#source;
    source?.disconnect();
    if (stream) stopStreamTracks(stream);
    this.#clearActiveReferences();

    for (const listener of this.#trackEndedListeners) {
      listener({ lastSettings });
    }
    void this.#publishDeviceListChanged();
  }

  #stopActiveCapture(): void {
    const track = this.#track;
    const endedHandler = this.#trackEndedHandler;
    if (track && endedHandler) track.removeEventListener("ended", endedHandler);

    this.#source?.disconnect();
    if (this.#stream) stopStreamTracks(this.#stream);
    this.#clearActiveReferences();
  }

  #invalidatePendingAcquisition(): void {
    this.#lifecycleToken += 1;
    this.#pendingAcquisition = null;
  }

  #clearActiveReferences(): void {
    this.#stream = null;
    this.#source = null;
    this.#track = null;
    this.#settings = null;
    this.#trackEndedHandler = null;
  }

  #currentCapture(): MicrophoneCapture | null {
    if (!this.#stream || !this.#settings) return null;
    return {
      stream: this.#stream,
      settings: { ...this.#settings },
    };
  }

  async #publishDeviceListChanged(): Promise<void> {
    if (this.#disposed) return;

    let devices: readonly MicrophoneInputDevice[];
    try {
      devices = await this.listInputs();
    } catch {
      return;
    }

    if (this.#disposed) return;
    for (const listener of this.#deviceListListeners) listener(devices);
  }

  #isCurrent(token: number): boolean {
    return !this.#disposed && token === this.#lifecycleToken;
  }

  #assertUsable(): void {
    if (this.#disposed) {
      throw new Error("Cannot use a disposed MicrophoneService");
    }
  }
}
