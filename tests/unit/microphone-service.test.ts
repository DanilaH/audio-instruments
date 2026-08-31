import { describe, expect, it, vi } from "vitest";

import {
  MicrophoneService,
  createMicrophoneAudioConstraints,
} from "../../src/browser/microphone/MicrophoneService";

class FakeAudioNode {
  readonly connections: AudioNode[] = [];
  disconnected = false;
  rejectIncomingConnections = false;

  constructor(readonly context: BaseAudioContext) {}

  connect(destination: AudioNode) {
    const fakeDestination = destination as unknown as FakeAudioNode;
    if (fakeDestination.rejectIncomingConnections) {
      throw new DOMException("connection rejected", "InvalidStateError");
    }
    this.connections.push(destination);
    return destination;
  }

  disconnect(destination?: AudioNode) {
    if (destination) {
      const index = this.connections.indexOf(destination);
      if (index >= 0) this.connections.splice(index, 1);
      return;
    }
    this.connections.length = 0;
    this.disconnected = true;
  }
}

class FakeTrack extends EventTarget {
  readonly kind = "audio";
  stopCount = 0;

  constructor(readonly settings: MediaTrackSettings) {
    super();
  }

  getSettings(): MediaTrackSettings {
    return { ...this.settings };
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

class FakeAudioContext {
  readonly sources: FakeAudioNode[] = [];
  readonly destination: FakeAudioNode;

  constructor() {
    this.destination = new FakeAudioNode(this as unknown as BaseAudioContext);
  }

  createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode {
    void stream;
    const source = new FakeAudioNode(this as unknown as BaseAudioContext);
    this.sources.push(source);
    return source as unknown as MediaStreamAudioSourceNode;
  }
}

type StreamFactory = () => MediaStream | Promise<MediaStream>;

class FakeMediaDevices extends EventTarget {
  readonly getUserMediaCalls: MediaStreamConstraints[] = [];
  readonly queue: Array<MediaStream | Error | StreamFactory> = [];
  supported: MediaTrackSupportedConstraints = {};
  devices: MediaDeviceInfo[] = [];
  enumerateCount = 0;

  getSupportedConstraints(): MediaTrackSupportedConstraints {
    return { ...this.supported };
  }

  async getUserMedia(
    constraints: MediaStreamConstraints,
  ): Promise<MediaStream> {
    this.getUserMediaCalls.push(constraints);
    const next = this.queue.shift();
    if (!next) throw new Error("No deterministic stream queued");
    if (next instanceof Error) throw next;
    if (typeof next === "function") return next();
    return next;
  }

  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    this.enumerateCount += 1;
    return [...this.devices];
  }
}

function audioInput(
  deviceId: string,
  label: string,
  groupId = "group",
): MediaDeviceInfo {
  return {
    deviceId,
    groupId,
    kind: "audioinput",
    label,
    toJSON: () => ({}),
  } as MediaDeviceInfo;
}

function videoInput(deviceId: string): MediaDeviceInfo {
  return {
    deviceId,
    groupId: "video-group",
    kind: "videoinput",
    label: "Camera",
    toJSON: () => ({}),
  } as MediaDeviceInfo;
}

function createService(mediaDevices = new FakeMediaDevices()) {
  const context = new FakeAudioContext();
  const service = new MicrophoneService(
    context as unknown as AudioContext,
    mediaDevices as unknown as MediaDevices,
  );
  return { context, mediaDevices, service };
}

function analysisTarget(context: FakeAudioContext): FakeAudioNode {
  return new FakeAudioNode(context as unknown as BaseAudioContext);
}

describe("MicrophoneService", () => {
  it("requests only recognized raw-ish processing constraints and exact selected device semantics", () => {
    expect(
      createMicrophoneAudioConstraints(
        {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
        "mic-2",
      ),
    ).toEqual({
      deviceId: { exact: "mic-2" },
      echoCancellation: false,
      autoGainControl: false,
    });

    expect(() => createMicrophoneAudioConstraints({}, "   ")).toThrow(
      "deviceId must be a non-empty string",
    );
  });

  it("rejects the AudioContext destination as a live microphone analysis target", () => {
    const { context, service } = createService();

    expect(() =>
      service.connectAnalysisTarget(
        context.destination as unknown as AudioNode,
      ),
    ).toThrow(
      "Live microphone monitoring to AudioContext.destination is prohibited",
    );
  });

  it("rejects foreign-context analysis targets without poisoning a later Start", async () => {
    const { context, mediaDevices, service } = createService();
    const foreignContext = new FakeAudioContext();

    expect(() =>
      service.connectAnalysisTarget(
        analysisTarget(foreignContext) as unknown as AudioNode,
      ),
    ).toThrow(
      "Microphone analysis targets must belong to the same AudioContext",
    );

    const validTarget = analysisTarget(context);
    service.connectAnalysisTarget(validTarget as unknown as AudioNode);
    const track = new FakeTrack({ deviceId: "mic-1" });
    const stream = new FakeStream(track) as unknown as MediaStream;
    mediaDevices.queue.push(stream);

    await expect(service.startDefault()).resolves.toMatchObject({ stream });
    expect(context.sources[0]?.connections).toEqual([validTarget]);
    expect(track.stopCount).toBe(0);
  });

  it("enumerates audio inputs without assuming labels are available", async () => {
    const { mediaDevices, service } = createService();
    mediaDevices.devices = [
      audioInput("mic-1", ""),
      videoInput("cam-1"),
      audioInput("mic-2", "Desk mic", "group-2"),
    ];

    await expect(service.listInputs()).resolves.toEqual([
      { deviceId: "mic-1", groupId: "group", label: "" },
      { deviceId: "mic-2", groupId: "group-2", label: "Desk mic" },
    ]);
  });

  it("starts once, connects shared analysis targets and exposes actual track settings", async () => {
    const { context, mediaDevices, service } = createService();
    mediaDevices.supported = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    const track = new FakeTrack({
      deviceId: "mic-1",
      sampleRate: 48_000,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    });
    const stream = new FakeStream(track) as unknown as MediaStream;
    mediaDevices.queue.push(stream);
    const target = analysisTarget(context);
    service.connectAnalysisTarget(target as unknown as AudioNode);

    const [first, repeated] = await Promise.all([
      service.startDefault(),
      service.startDefault(),
    ]);

    expect(first.stream).toBe(stream);
    expect(repeated.stream).toBe(stream);
    expect(mediaDevices.getUserMediaCalls).toHaveLength(1);
    expect(mediaDevices.getUserMediaCalls[0]).toEqual({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]?.connections).toEqual([target]);
    expect(service.activeSettings()).toMatchObject({
      deviceId: "mic-1",
      sampleRate: 48_000,
    });
  });

  it("acquires an exact replacement before stopping the old stream and reconnects analysis", async () => {
    const { context, mediaDevices, service } = createService();
    mediaDevices.supported = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    const oldTrack = new FakeTrack({ deviceId: "mic-old", sampleRate: 44_100 });
    const newTrack = new FakeTrack({ deviceId: "mic-new", sampleRate: 48_000 });
    mediaDevices.queue.push(new FakeStream(oldTrack) as unknown as MediaStream);
    await service.startDefault();

    const target = analysisTarget(context);
    service.connectAnalysisTarget(target as unknown as AudioNode);
    expect(context.sources[0]?.connections).toEqual([target]);

    mediaDevices.queue.push(() => {
      expect(oldTrack.stopCount).toBe(0);
      expect(context.sources[0]?.disconnected).toBe(false);
      return new FakeStream(newTrack) as unknown as MediaStream;
    });

    const replacement = await service.switchToExactDevice("mic-new");

    expect(mediaDevices.getUserMediaCalls[1]).toEqual({
      audio: {
        deviceId: { exact: "mic-new" },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    expect(oldTrack.stopCount).toBe(1);
    expect(context.sources[0]?.disconnected).toBe(true);
    expect(context.sources[1]?.connections).toEqual([target]);
    expect(replacement.settings).toMatchObject({
      deviceId: "mic-new",
      sampleRate: 48_000,
    });
    expect(service.activeSettings()?.deviceId).toBe("mic-new");
  });

  it("preserves the old live stream when exact replacement acquisition fails", async () => {
    const { context, mediaDevices, service } = createService();
    const oldTrack = new FakeTrack({ deviceId: "mic-old" });
    const oldStream = new FakeStream(oldTrack) as unknown as MediaStream;
    mediaDevices.queue.push(oldStream);
    await service.startDefault();
    mediaDevices.queue.push(new DOMException("denied", "NotAllowedError"));

    await expect(service.switchToExactDevice("mic-new")).rejects.toMatchObject({
      name: "NotAllowedError",
    });

    expect(service.activeStream).toBe(oldStream);
    expect(service.activeSettings()?.deviceId).toBe("mic-old");
    expect(oldTrack.stopCount).toBe(0);
    expect(context.sources[0]?.disconnected).toBe(false);
    expect(context.sources).toHaveLength(1);
  });

  it("preserves the old live stream when the replacement analysis graph cannot connect", async () => {
    const { context, mediaDevices, service } = createService();
    const oldTrack = new FakeTrack({ deviceId: "mic-old" });
    const oldStream = new FakeStream(oldTrack) as unknown as MediaStream;
    mediaDevices.queue.push(oldStream);
    await service.startDefault();

    const target = analysisTarget(context);
    service.connectAnalysisTarget(target as unknown as AudioNode);
    target.rejectIncomingConnections = true;

    const newTrack = new FakeTrack({ deviceId: "mic-new" });
    mediaDevices.queue.push(new FakeStream(newTrack) as unknown as MediaStream);

    await expect(service.switchToExactDevice("mic-new")).rejects.toMatchObject({
      name: "InvalidStateError",
    });

    expect(service.activeStream).toBe(oldStream);
    expect(service.activeSettings()?.deviceId).toBe("mic-old");
    expect(oldTrack.stopCount).toBe(0);
    expect(context.sources[0]?.disconnected).toBe(false);
    expect(newTrack.stopCount).toBe(1);
    expect(context.sources[1]?.disconnected).toBe(true);
  });

  it("clears active capture on track end and refreshes device metadata without silent switching", async () => {
    const { mediaDevices, service } = createService();
    const track = new FakeTrack({ deviceId: "mic-1", sampleRate: 48_000 });
    mediaDevices.queue.push(new FakeStream(track) as unknown as MediaStream);
    mediaDevices.devices = [audioInput("mic-1", "Primary")];

    const ended = vi.fn();
    const deviceLists = vi.fn();
    service.onTrackEnded(ended);
    service.onDeviceListChanged(deviceLists);
    await service.startDefault();

    track.dispatchEvent(new Event("ended"));
    await vi.waitFor(() => expect(deviceLists).toHaveBeenCalled());

    expect(service.isActive).toBe(false);
    expect(service.activeSettings()).toBeNull();
    expect(ended).toHaveBeenCalledWith({
      lastSettings: expect.objectContaining({ deviceId: "mic-1" }),
    });

    const callsBeforeDeviceChange = mediaDevices.getUserMediaCalls.length;
    mediaDevices.devices = [
      audioInput("mic-1", "Primary"),
      audioInput("mic-2", "New input"),
    ];
    mediaDevices.dispatchEvent(new Event("devicechange"));
    await vi.waitFor(() =>
      expect(deviceLists).toHaveBeenLastCalledWith([
        { deviceId: "mic-1", groupId: "group", label: "Primary" },
        { deviceId: "mic-2", groupId: "group", label: "New input" },
      ]),
    );
    expect(mediaDevices.getUserMediaCalls).toHaveLength(
      callsBeforeDeviceChange,
    );
  });

  it("cancels a pending acquisition on Stop and deterministically stops the late stream", async () => {
    const { mediaDevices, service } = createService();
    const track = new FakeTrack({ deviceId: "late-mic" });
    let resolveStream!: (stream: MediaStream) => void;
    const delayed = new Promise<MediaStream>((resolve) => {
      resolveStream = resolve;
    });
    mediaDevices.queue.push(() => delayed);

    const pending = service.startDefault();
    service.stop();
    resolveStream(new FakeStream(track) as unknown as MediaStream);

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(track.stopCount).toBe(1);
    expect(service.isActive).toBe(false);
  });

  it("stops active tracks and removes device listeners idempotently on dispose", async () => {
    const { mediaDevices, service } = createService();
    const track = new FakeTrack({ deviceId: "mic-1" });
    mediaDevices.queue.push(new FakeStream(track) as unknown as MediaStream);
    const listener = vi.fn();
    service.onDeviceListChanged(listener);
    await service.startDefault();

    service.dispose();
    service.dispose();
    mediaDevices.dispatchEvent(new Event("devicechange"));
    await Promise.resolve();

    expect(track.stopCount).toBe(1);
    expect(service.isActive).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    expect(() => service.connectAnalysisTarget({} as AudioNode)).toThrow(
      "Cannot use a disposed MicrophoneService",
    );
  });
});
