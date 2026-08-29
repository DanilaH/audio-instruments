import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AudioRecorder,
  RECORDER_MIME_CANDIDATES,
  RECORDING_FINALIZATION_TIMEOUT_MS,
  RECORDING_MAX_DURATION_MS,
  RecordingUnavailableError,
  negotiateMediaRecorder,
  type MediaRecorderFactory,
  type ObjectUrlApi,
} from "../../src/browser/recording/AudioRecorder";

class FakeMediaRecorder extends EventTarget {
  state: RecordingState = "inactive";
  readonly mimeType: string;
  startCount = 0;
  stopCount = 0;
  throwOnStart = false;
  throwOnStop = false;
  emitStopSynchronously = false;

  constructor(mimeType: string) {
    super();
    this.mimeType = mimeType;
  }

  start(): void {
    this.startCount += 1;
    if (this.throwOnStart) throw new DOMException("start failed", "InvalidStateError");
    this.state = "recording";
  }

  stop(): void {
    this.stopCount += 1;
    if (this.throwOnStop) throw new DOMException("stop failed", "InvalidStateError");
    this.state = "inactive";
    if (this.emitStopSynchronously) this.emitStop();
  }

  emitData(blob: Blob): void {
    const event = new Event("dataavailable") as BlobEvent;
    Object.defineProperty(event, "data", { value: blob });
    this.dispatchEvent(event);
  }

  emitStop(): void {
    this.state = "inactive";
    this.dispatchEvent(new Event("stop"));
  }
}

class FakeFactory implements MediaRecorderFactory {
  available = true;
  readonly supported = new Set<string>();
  readonly constructionFailures = new Set<string>();
  failDefaultConstruction = false;
  readonly createCalls: Array<string | null> = [];
  readonly recorders: FakeMediaRecorder[] = [];

  isAvailable(): boolean {
    return this.available;
  }

  isTypeSupported(mimeType: string): boolean {
    return this.supported.has(mimeType);
  }

  create(_stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder {
    const mimeType = options?.mimeType ?? null;
    this.createCalls.push(mimeType);
    if (mimeType ? this.constructionFailures.has(mimeType) : this.failDefaultConstruction) {
      throw new DOMException("construction failed", "NotSupportedError");
    }

    const recorder = new FakeMediaRecorder(mimeType ?? "browser/default");
    this.recorders.push(recorder);
    return recorder as unknown as MediaRecorder;
  }
}

class FakeObjectUrls implements ObjectUrlApi {
  readonly created: Blob[] = [];
  readonly revoked: string[] = [];

  createObjectURL(blob: Blob): string {
    this.created.push(blob);
    return `blob:test-${this.created.length}`;
  }

  revokeObjectURL(url: string): void {
    this.revoked.push(url);
  }
}

function fakeStream(): MediaStream {
  return {} as MediaStream;
}

describe("AudioRecorder MIME negotiation", () => {
  it("tries supported explicit candidates in the exact documented order", () => {
    const factory = new FakeFactory();
    factory.supported.add(RECORDER_MIME_CANDIDATES[0]);
    factory.supported.add(RECORDER_MIME_CANDIDATES[1]);
    factory.constructionFailures.add(RECORDER_MIME_CANDIDATES[0]);

    const recorder = negotiateMediaRecorder(fakeStream(), factory);

    expect(recorder).not.toBeNull();
    expect(factory.createCalls).toEqual([
      "audio/webm;codecs=opus",
      "audio/ogg;codecs=opus",
    ]);
    expect(recorder?.mimeType).toBe("audio/ogg;codecs=opus");
  });

  it("falls back to construction without explicit MIME after explicit candidates fail", () => {
    const factory = new FakeFactory();
    for (const mimeType of RECORDER_MIME_CANDIDATES) {
      factory.supported.add(mimeType);
      factory.constructionFailures.add(mimeType);
    }

    const recorder = negotiateMediaRecorder(fakeStream(), factory);

    expect(factory.createCalls).toEqual([...RECORDER_MIME_CANDIDATES, null]);
    expect(recorder?.mimeType).toBe("browser/default");
  });

  it("returns null when MediaRecorder is absent or every construction path fails", () => {
    const absent = new FakeFactory();
    absent.available = false;
    expect(negotiateMediaRecorder(fakeStream(), absent)).toBeNull();
    expect(absent.createCalls).toEqual([]);

    const failing = new FakeFactory();
    failing.supported.add(RECORDER_MIME_CANDIDATES[2]);
    failing.constructionFailures.add(RECORDER_MIME_CANDIDATES[2]);
    failing.failDefaultConstruction = true;
    expect(negotiateMediaRecorder(fakeStream(), failing)).toBeNull();
    expect(failing.createCalls).toEqual(["audio/mp4", null]);
  });
});

describe("AudioRecorder lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-stops after exactly 15 seconds and leaves the microphone stream alone", async () => {
    const factory = new FakeFactory();
    factory.supported.add(RECORDER_MIME_CANDIDATES[0]);
    const urls = new FakeObjectUrls();
    const stream = fakeStream();
    const recorderService = new AudioRecorder(factory, urls);

    const completion = recorderService.start(stream);
    const recorder = factory.recorders[0]!;
    expect(recorder.startCount).toBe(1);
    expect(recorder.stopCount).toBe(0);

    await vi.advanceTimersByTimeAsync(RECORDING_MAX_DURATION_MS - 1);
    expect(recorder.stopCount).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(recorder.stopCount).toBe(1);
    expect(recorderService.isRecording).toBe(true);

    recorder.emitData(new Blob(["final"]));
    recorder.emitStop();
    const result = await completion;

    expect(result.mimeType).toBe("audio/webm;codecs=opus");
    expect(result.blob.size).toBeGreaterThan(0);
    expect(recorderService.isRecording).toBe(false);
  });

  it("keeps only non-empty chunks and replaces the previous object URL after successful finalization", async () => {
    const factory = new FakeFactory();
    factory.supported.add(RECORDER_MIME_CANDIDATES[0]);
    const urls = new FakeObjectUrls();
    const recorderService = new AudioRecorder(factory, urls);

    const firstCompletion = recorderService.start(fakeStream());
    const first = factory.recorders[0]!;
    first.emitData(new Blob([]));
    first.emitData(new Blob(["one"]));
    const firstStop = recorderService.stopRecording();
    expect(firstStop).toBe(firstCompletion);
    first.emitData(new Blob(["two"]));
    first.emitStop();
    const firstResult = await firstCompletion;

    expect(firstResult.url).toBe("blob:test-1");
    expect(urls.created).toHaveLength(1);
    expect(urls.created[0]?.size).toBe(
      new Blob(["one", "two"], { type: "audio/webm;codecs=opus" }).size,
    );

    const secondCompletion = recorderService.start(fakeStream());
    const second = factory.recorders[1]!;
    second.emitData(new Blob(["replacement"]));
    recorderService.stopRecording();
    second.emitStop();
    const secondResult = await secondCompletion;

    expect(secondResult.url).toBe("blob:test-2");
    expect(urls.revoked).toEqual(["blob:test-1"]);
    expect(recorderService.latestRecording?.url).toBe("blob:test-2");
  });

  it("gives normal recorder finalization a chance during tool-wide Stop", async () => {
    const factory = new FakeFactory();
    factory.supported.add(RECORDER_MIME_CANDIDATES[0]);
    const urls = new FakeObjectUrls();
    const recorderService = new AudioRecorder(factory, urls);

    const completion = recorderService.start(fakeStream());
    const recorder = factory.recorders[0]!;
    recorder.emitData(new Blob(["captured"]));

    const teardown = recorderService.stopForToolTeardown();
    expect(recorder.stopCount).toBe(1);
    expect(recorderService.isRecording).toBe(true);
    recorder.emitData(new Blob(["final"]));
    recorder.emitStop();

    await expect(teardown).resolves.toMatchObject({ url: "blob:test-1" });
    await expect(completion).resolves.toMatchObject({ url: "blob:test-1" });
    expect(recorderService.isRecording).toBe(false);
  });

  it("discards an incomplete recording after the 1500 ms teardown timeout but preserves the previous valid recording", async () => {
    const factory = new FakeFactory();
    factory.supported.add(RECORDER_MIME_CANDIDATES[0]);
    const urls = new FakeObjectUrls();
    const recorderService = new AudioRecorder(factory, urls);

    const firstCompletion = recorderService.start(fakeStream());
    const first = factory.recorders[0]!;
    first.emitData(new Blob(["valid"]));
    recorderService.stopRecording();
    first.emitStop();
    await firstCompletion;

    const secondCompletion = recorderService.start(fakeStream());
    void secondCompletion.catch(() => undefined);
    const second = factory.recorders[1]!;
    second.emitData(new Blob(["incomplete"]));

    const teardown = recorderService.stopForToolTeardown();
    expect(second.stopCount).toBe(1);
    await vi.advanceTimersByTimeAsync(RECORDING_FINALIZATION_TIMEOUT_MS);

    await expect(teardown).resolves.toBeNull();
    expect(recorderService.isRecording).toBe(false);
    expect(recorderService.latestRecording?.url).toBe("blob:test-1");
    expect(urls.created).toHaveLength(1);

    second.emitStop();
    expect(urls.created).toHaveLength(1);
  });

  it("keeps recording optional when no recorder can be constructed", () => {
    const factory = new FakeFactory();
    factory.failDefaultConstruction = true;
    const recorderService = new AudioRecorder(factory, new FakeObjectUrls());

    expect(recorderService.isSupported).toBe(true);
    expect(() => recorderService.start(fakeStream())).toThrow(
      RecordingUnavailableError,
    );
    expect(recorderService.isRecording).toBe(false);
  });

  it("revokes the latest local recording on dispose and becomes unusable", async () => {
    const factory = new FakeFactory();
    factory.supported.add(RECORDER_MIME_CANDIDATES[0]);
    const urls = new FakeObjectUrls();
    const recorderService = new AudioRecorder(factory, urls);

    const completion = recorderService.start(fakeStream());
    const recorder = factory.recorders[0]!;
    recorder.emitData(new Blob(["done"]));
    recorderService.stopRecording();
    recorder.emitStop();
    await completion;

    await recorderService.dispose();
    await recorderService.dispose();

    expect(urls.revoked).toEqual(["blob:test-1"]);
    expect(recorderService.latestRecording).toBeNull();
    expect(() => recorderService.start(fakeStream())).toThrow(
      "Cannot use a disposed AudioRecorder",
    );
  });
});
