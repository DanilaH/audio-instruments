import { describe, expect, it } from "vitest";

import {
  AudioRecorder,
  type MediaRecorderFactory,
  type ObjectUrlApi,
} from "../../src/browser/recording/AudioRecorder";

class ErroringRecorder extends EventTarget {
  state: RecordingState = "inactive";
  readonly mimeType = "audio/webm;codecs=opus";
  stopCount = 0;

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.stopCount += 1;
    this.state = "inactive";
  }

  emitError(error: unknown): void {
    const event = new Event("error") as Event & { error?: unknown };
    Object.defineProperty(event, "error", { value: error });
    this.dispatchEvent(event);
  }
}

class RecorderFactory implements MediaRecorderFactory {
  readonly recorder = new ErroringRecorder();

  isAvailable(): boolean {
    return true;
  }

  isTypeSupported(mimeType: string): boolean {
    return mimeType === "audio/webm;codecs=opus";
  }

  create(): MediaRecorder {
    return this.recorder as unknown as MediaRecorder;
  }
}

class ObjectUrls implements ObjectUrlApi {
  createCount = 0;

  createObjectURL(): string {
    this.createCount += 1;
    return "blob:unexpected";
  }

  revokeObjectURL(): void {}
}

describe("AudioRecorder runtime errors", () => {
  it("best-effort stops an active MediaRecorder before discarding the failed recording", async () => {
    const factory = new RecorderFactory();
    const objectUrls = new ObjectUrls();
    const recorder = new AudioRecorder(factory, objectUrls);
    const failure = new DOMException("encoder failed", "UnknownError");

    const completion = recorder.start({} as MediaStream);
    factory.recorder.emitError(failure);

    await expect(completion).rejects.toBe(failure);
    expect(factory.recorder.stopCount).toBe(1);
    expect(factory.recorder.state).toBe("inactive");
    expect(recorder.isRecording).toBe(false);
    expect(recorder.latestRecording).toBeNull();
    expect(objectUrls.createCount).toBe(0);
  });
});
