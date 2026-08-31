import { describe, expect, it } from "vitest";

import { MicrophoneService } from "../../src/browser/microphone/MicrophoneService";

class FakeNode {
  disconnected = false;

  constructor(readonly context: BaseAudioContext) {}

  connect(destination: AudioNode) {
    return destination;
  }

  disconnect() {
    this.disconnected = true;
  }
}

class FakeAudioContext {
  readonly destination = new FakeNode(this as unknown as BaseAudioContext);

  createMediaStreamSource(_stream: MediaStream): MediaStreamAudioSourceNode {
    return new FakeNode(
      this as unknown as BaseAudioContext,
    ) as unknown as MediaStreamAudioSourceNode;
  }
}

class FakeTrack extends EventTarget {
  stopCount = 0;

  constructor(readonly deviceId: string) {
    super();
  }

  getSettings(): MediaTrackSettings {
    return { deviceId: this.deviceId };
  }

  stop(): void {
    this.stopCount += 1;
  }
}

class FakeStream {
  constructor(readonly track: FakeTrack) {}

  getTracks(): MediaStreamTrack[] {
    return [this.track as unknown as MediaStreamTrack];
  }

  getAudioTracks(): MediaStreamTrack[] {
    return [this.track as unknown as MediaStreamTrack];
  }
}

type StreamFactory = () => MediaStream | Promise<MediaStream>;

class FakeMediaDevices extends EventTarget {
  readonly queue: Array<MediaStream | StreamFactory> = [];
  readonly calls: MediaStreamConstraints[] = [];

  getSupportedConstraints(): MediaTrackSupportedConstraints {
    return { deviceId: true };
  }

  async getUserMedia(
    constraints: MediaStreamConstraints,
  ): Promise<MediaStream> {
    this.calls.push(constraints);
    const next = this.queue.shift();
    if (!next) throw new Error("No deterministic stream queued");
    return typeof next === "function" ? next() : next;
  }

  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    return [];
  }
}

describe("MicrophoneService pending handoff lifecycle", () => {
  it("cancels a late replacement after track loss and allows an immediate clean retry", async () => {
    const context = new FakeAudioContext();
    const mediaDevices = new FakeMediaDevices();
    const service = new MicrophoneService(
      context as unknown as AudioContext,
      mediaDevices as unknown as MediaDevices,
    );

    const oldTrack = new FakeTrack("mic-old");
    mediaDevices.queue.push(new FakeStream(oldTrack) as unknown as MediaStream);
    await service.startDefault();

    let resolveLate!: (stream: MediaStream) => void;
    const lateStreamPromise = new Promise<MediaStream>((resolve) => {
      resolveLate = resolve;
    });
    mediaDevices.queue.push(() => lateStreamPromise);
    const pendingSwitch = service.switchToExactDevice("mic-late");

    oldTrack.dispatchEvent(new Event("ended"));
    expect(service.isActive).toBe(false);

    const retryTrack = new FakeTrack("mic-retry");
    const retryStream = new FakeStream(retryTrack) as unknown as MediaStream;
    mediaDevices.queue.push(retryStream);
    const retry = service.startDefault();

    const lateTrack = new FakeTrack("mic-late");
    resolveLate(new FakeStream(lateTrack) as unknown as MediaStream);

    await expect(pendingSwitch).rejects.toMatchObject({ name: "AbortError" });
    await expect(retry).resolves.toMatchObject({ stream: retryStream });

    expect(lateTrack.stopCount).toBe(1);
    expect(service.activeStream).toBe(retryStream);
    expect(service.activeSettings()?.deviceId).toBe("mic-retry");
    expect(mediaDevices.calls).toHaveLength(3);
  });

  it("lets Start begin a fresh acquisition immediately after Stop invalidates a pending one", async () => {
    const context = new FakeAudioContext();
    const mediaDevices = new FakeMediaDevices();
    const service = new MicrophoneService(
      context as unknown as AudioContext,
      mediaDevices as unknown as MediaDevices,
    );

    let resolveOld!: (stream: MediaStream) => void;
    const oldPendingStream = new Promise<MediaStream>((resolve) => {
      resolveOld = resolve;
    });
    mediaDevices.queue.push(() => oldPendingStream);
    const staleStart = service.startDefault();

    service.stop();

    const freshTrack = new FakeTrack("mic-fresh");
    const freshStream = new FakeStream(freshTrack) as unknown as MediaStream;
    mediaDevices.queue.push(freshStream);
    const freshStart = service.startDefault();

    const staleTrack = new FakeTrack("mic-stale");
    resolveOld(new FakeStream(staleTrack) as unknown as MediaStream);

    await expect(staleStart).rejects.toMatchObject({ name: "AbortError" });
    await expect(freshStart).resolves.toMatchObject({ stream: freshStream });
    expect(staleTrack.stopCount).toBe(1);
    expect(service.activeStream).toBe(freshStream);
  });
});
