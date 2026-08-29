import type { SessionResource } from "../audio-session/AudioSession";

export const RECORDING_MAX_DURATION_MS = 15_000;
export const RECORDING_FINALIZATION_TIMEOUT_MS = 1_500;
export const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4",
] as const;

export interface RecordingResult {
  readonly blob: Blob;
  readonly url: string;
  readonly mimeType: string;
}

export interface MediaRecorderFactory {
  isAvailable(): boolean;
  isTypeSupported(mimeType: string): boolean;
  create(stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder;
}

export interface ObjectUrlApi {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

interface ActiveRecording {
  readonly token: number;
  readonly recorder: MediaRecorder;
  readonly chunks: Blob[];
  readonly completion: Promise<RecordingResult>;
  readonly resolve: (result: RecordingResult) => void;
  readonly reject: (error: unknown) => void;
  readonly dataHandler: EventListener;
  readonly stopHandler: EventListener;
  readonly errorHandler: EventListener;
  autoStopTimer: ReturnType<typeof setTimeout> | null;
}

function createBrowserMediaRecorderFactory(): MediaRecorderFactory {
  return {
    isAvailable: () => typeof MediaRecorder !== "undefined",
    isTypeSupported: (mimeType) =>
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(mimeType),
    create: (stream, options) => {
      if (typeof MediaRecorder === "undefined") {
        throw new Error("MediaRecorder is unavailable");
      }
      return options
        ? new MediaRecorder(stream, options)
        : new MediaRecorder(stream);
    },
  };
}

function createBrowserObjectUrlApi(): ObjectUrlApi {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  };
}

export class RecordingUnavailableError extends Error {
  constructor() {
    super("Recording is unavailable in this browser");
    this.name = "RecordingUnavailableError";
  }
}

export function negotiateMediaRecorder(
  stream: MediaStream,
  factory: MediaRecorderFactory,
): MediaRecorder | null {
  if (!factory.isAvailable()) return null;

  for (const mimeType of RECORDER_MIME_CANDIDATES) {
    if (!factory.isTypeSupported(mimeType)) continue;
    try {
      return factory.create(stream, { mimeType });
    } catch {
      // Try the next supported explicit candidate.
    }
  }

  try {
    return factory.create(stream);
  } catch {
    return null;
  }
}

export class AudioRecorder implements SessionResource {
  readonly #factory: MediaRecorderFactory;
  readonly #objectUrls: ObjectUrlApi;

  #active: ActiveRecording | null = null;
  #latest: RecordingResult | null = null;
  #token = 0;
  #disposed = false;

  constructor(
    factory: MediaRecorderFactory = createBrowserMediaRecorderFactory(),
    objectUrls: ObjectUrlApi = createBrowserObjectUrlApi(),
  ) {
    this.#factory = factory;
    this.#objectUrls = objectUrls;
  }

  get isSupported(): boolean {
    return !this.#disposed && this.#factory.isAvailable();
  }

  get isRecording(): boolean {
    return this.#active !== null;
  }

  get latestRecording(): RecordingResult | null {
    return this.#latest ? { ...this.#latest } : null;
  }

  start(stream: MediaStream): Promise<RecordingResult> {
    this.#assertUsable();
    if (this.#active) {
      throw new Error("A microphone recording is already active");
    }

    const recorder = negotiateMediaRecorder(stream, this.#factory);
    if (!recorder) throw new RecordingUnavailableError();

    const token = ++this.#token;
    let resolve!: (result: RecordingResult) => void;
    let reject!: (error: unknown) => void;
    const completion = new Promise<RecordingResult>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });

    const active = {} as ActiveRecording;
    const dataHandler: EventListener = (event) => {
      if (this.#active?.token !== token) return;
      const data = (event as BlobEvent).data;
      if (data && data.size > 0) active.chunks.push(data);
    };
    const stopHandler: EventListener = () => this.#finalize(active);
    const errorHandler: EventListener = (event) => {
      const error =
        "error" in event && (event as Event & { error?: unknown }).error
          ? (event as Event & { error?: unknown }).error
          : new Error("MediaRecorder failed while recording");
      this.#failActive(active, error);
    };

    Object.assign(active, {
      token,
      recorder,
      chunks: [],
      completion,
      resolve,
      reject,
      dataHandler,
      stopHandler,
      errorHandler,
      autoStopTimer: null,
    } satisfies ActiveRecording);

    this.#active = active;
    recorder.addEventListener("dataavailable", dataHandler);
    recorder.addEventListener("stop", stopHandler, { once: true });
    recorder.addEventListener("error", errorHandler, { once: true });

    try {
      recorder.start();
    } catch (error) {
      this.#abandonActive(active);
      throw error;
    }

    active.autoStopTimer = setTimeout(() => {
      if (this.#active !== active) return;
      active.autoStopTimer = null;
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch (error) {
        this.#failActive(active, error);
      }
    }, RECORDING_MAX_DURATION_MS);

    return completion;
  }

  stopRecording(): Promise<RecordingResult> | null {
    const active = this.#active;
    if (!active) return null;

    this.#clearAutoStop(active);
    try {
      if (active.recorder.state !== "inactive") active.recorder.stop();
    } catch (error) {
      this.#failActive(active, error);
    }
    return active.completion;
  }

  async stopForToolTeardown(
    timeoutMs: number = RECORDING_FINALIZATION_TIMEOUT_MS,
  ): Promise<RecordingResult | null> {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
      throw new RangeError("Recording finalization timeout must be non-negative");
    }

    const active = this.#active;
    if (!active) return null;
    const completion = this.stopRecording();
    if (!completion) return null;

    const timeoutToken = Symbol("recording-timeout");
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<typeof timeoutToken>((resolve) => {
      timeoutId = setTimeout(() => resolve(timeoutToken), timeoutMs);
    });

    const outcome = await Promise.race([
      completion.then(
        (result) => ({ kind: "result" as const, result }),
        () => ({ kind: "error" as const }),
      ),
      timeout,
    ]);

    if (timeoutId !== null) clearTimeout(timeoutId);
    if (outcome !== timeoutToken) {
      return outcome.kind === "result" ? outcome.result : null;
    }

    if (this.#active === active) {
      this.#discardActive(
        active,
        new Error("MediaRecorder finalization timed out during tool teardown"),
      );
    }
    return null;
  }

  clearRecording(): void {
    if (!this.#latest) return;
    this.#objectUrls.revokeObjectURL(this.#latest.url);
    this.#latest = null;
  }

  async stop(): Promise<void> {
    await this.stopForToolTeardown();
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    await this.stopForToolTeardown();
    this.clearRecording();
    this.#disposed = true;
  }

  #finalize(active: ActiveRecording): void {
    if (this.#active !== active) return;
    this.#clearAutoStop(active);
    this.#detach(active);
    this.#active = null;

    try {
      const blob = new Blob(active.chunks, { type: active.recorder.mimeType });
      const url = this.#objectUrls.createObjectURL(blob);
      const result: RecordingResult = {
        blob,
        url,
        mimeType: active.recorder.mimeType,
      };
      const previous = this.#latest;
      this.#latest = result;
      if (previous) this.#objectUrls.revokeObjectURL(previous.url);
      active.resolve(result);
    } catch (error) {
      active.reject(error);
    }
  }

  #failActive(active: ActiveRecording, error: unknown): void {
    if (this.#active !== active) return;
    this.#discardActive(active, error);
  }

  #discardActive(active: ActiveRecording, error: unknown): void {
    this.#clearAutoStop(active);
    this.#detach(active);
    if (this.#active === active) this.#active = null;
    active.chunks.length = 0;
    active.reject(error);
  }

  #abandonActive(active: ActiveRecording): void {
    this.#clearAutoStop(active);
    this.#detach(active);
    if (this.#active === active) this.#active = null;
    active.chunks.length = 0;
  }

  #clearAutoStop(active: ActiveRecording): void {
    if (active.autoStopTimer === null) return;
    clearTimeout(active.autoStopTimer);
    active.autoStopTimer = null;
  }

  #detach(active: ActiveRecording): void {
    active.recorder.removeEventListener("dataavailable", active.dataHandler);
    active.recorder.removeEventListener("stop", active.stopHandler);
    active.recorder.removeEventListener("error", active.errorHandler);
  }

  #assertUsable(): void {
    if (this.#disposed) {
      throw new Error("Cannot use a disposed AudioRecorder");
    }
  }
}
