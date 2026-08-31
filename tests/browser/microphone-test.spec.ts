import { expect, test, type Page } from "@playwright/test";

interface MicHarnessState {
  audioContextCount: number;
  closedContextCount: number;
  getUserMediaCalls: MediaStreamConstraints[];
  recorderMimeAttempts: Array<string | null>;
  lifecycle: string[];
  activeDeviceId: string | null;
}

async function installMicrophoneHarness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state: MicHarnessState = {
      audioContextCount: 0,
      closedContextCount: 0,
      getUserMediaCalls: [],
      recorderMimeAttempts: [],
      lifecycle: [],
      activeDeviceId: null,
    };

    class FakeAudioParam {
      value = 1;
      setValueAtTime(value: number, _time: number) {
        this.value = value;
        return this;
      }
    }

    class FakeNode {
      readonly connections: unknown[] = [];
      constructor(readonly context: BaseAudioContext) {}
      connect(destination: unknown) {
        this.connections.push(destination);
        return destination;
      }
      disconnect(destination?: unknown) {
        if (destination !== undefined) {
          const index = this.connections.indexOf(destination);
          if (index >= 0) this.connections.splice(index, 1);
          return;
        }
        this.connections.length = 0;
      }
    }

    class FakeGainNode extends FakeNode {
      readonly gain = new FakeAudioParam();
    }

    class FakeAnalyserNode extends FakeNode {
      _fftSize = 2048;
      smoothingTimeConstant = 0;
      get fftSize() {
        return this._fftSize;
      }
      set fftSize(value: number) {
        this._fftSize = value;
      }
      get frequencyBinCount() {
        return this._fftSize / 2;
      }
      getFloatTimeDomainData(target: Float32Array) {
        target.fill(0.125);
      }
      getFloatFrequencyData(target: Float32Array) {
        target.fill(-60);
      }
      minDecibels = -100;
      maxDecibels = -30;
    }

    class FakeTrack extends EventTarget {
      readonly kind = "audio";
      stopCount = 0;
      constructor(readonly deviceId: string) {
        super();
      }
      getSettings(): MediaTrackSettings {
        return {
          deviceId: this.deviceId,
          sampleRate: this.deviceId === "mic-2" ? 44_100 : 48_000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        };
      }
      stop() {
        this.stopCount += 1;
        state.lifecycle.push(`track-stop:${this.deviceId}`);
        if (state.activeDeviceId === this.deviceId) state.activeDeviceId = null;
      }
    }

    class FakeStream {
      constructor(readonly track: FakeTrack) {}
      getTracks() {
        return [this.track] as unknown as MediaStreamTrack[];
      }
      getAudioTracks() {
        return [this.track] as unknown as MediaStreamTrack[];
      }
    }

    const tracks = new Map<string, FakeTrack>();
    const createStream = (deviceId: string) => {
      const track = new FakeTrack(deviceId);
      tracks.set(deviceId, track);
      state.activeDeviceId = deviceId;
      return new FakeStream(track) as unknown as MediaStream;
    };

    class FakeAudioContext {
      currentTime = 0;
      sampleRate = 48_000;
      state: AudioContextState = "suspended";
      readonly destination: FakeNode;

      constructor(_options?: AudioContextOptions) {
        state.audioContextCount += 1;
        this.destination = new FakeNode(this as unknown as BaseAudioContext);
      }
      async resume() {
        this.state = "running";
      }
      async close() {
        if (this.state !== "closed") state.closedContextCount += 1;
        this.state = "closed";
      }
      createGain() {
        return new FakeGainNode(this as unknown as BaseAudioContext) as unknown as GainNode;
      }
      createAnalyser() {
        return new FakeAnalyserNode(this as unknown as BaseAudioContext) as unknown as AnalyserNode;
      }
      createMediaStreamSource(_stream: MediaStream) {
        return new FakeNode(
          this as unknown as BaseAudioContext,
        ) as unknown as MediaStreamAudioSourceNode;
      }
    }

    class FakeMediaDevices extends EventTarget {
      getSupportedConstraints(): MediaTrackSupportedConstraints {
        return {
          deviceId: true,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
      }
      async getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
        state.getUserMediaCalls.push(constraints);
        const audio = constraints.audio as MediaTrackConstraints;
        const exact =
          typeof audio === "object" && audio.deviceId && typeof audio.deviceId === "object"
            ? String((audio.deviceId as ConstrainDOMStringParameters).exact ?? "")
            : "";
        const deviceId = exact || "mic-1";
        state.lifecycle.push(`gum:${deviceId}`);
        if (deviceId === "mic-fail") {
          throw new DOMException("deterministic selection failure", "NotReadableError");
        }
        return createStream(deviceId);
      }
      async enumerateDevices(): Promise<MediaDeviceInfo[]> {
        return [
          {
            deviceId: "mic-1",
            groupId: "group-1",
            kind: "audioinput",
            label: "Built-in microphone",
            toJSON: () => ({}),
          },
          {
            deviceId: "mic-2",
            groupId: "group-2",
            kind: "audioinput",
            label: "USB microphone",
            toJSON: () => ({}),
          },
          {
            deviceId: "mic-fail",
            groupId: "group-3",
            kind: "audioinput",
            label: "Unavailable microphone",
            toJSON: () => ({}),
          },
        ] as MediaDeviceInfo[];
      }
    }

    const mediaDevices = new FakeMediaDevices();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: mediaDevices,
    });

    class FakeMediaRecorder extends EventTarget {
      static isTypeSupported(mimeType: string) {
        return mimeType === "audio/ogg;codecs=opus" || mimeType === "audio/mp4";
      }

      state: RecordingState = "inactive";
      readonly mimeType: string;

      constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
        super();
        const mimeType = options?.mimeType ?? null;
        state.recorderMimeAttempts.push(mimeType);
        this.mimeType = mimeType ?? "browser/default";
      }

      start() {
        this.state = "recording";
        state.lifecycle.push("recorder-start");
      }

      stop() {
        if (this.state === "inactive") return;
        this.state = "inactive";
        state.lifecycle.push("recorder-stop");
        queueMicrotask(() => {
          const dataEvent = new Event("dataavailable") as BlobEvent;
          Object.defineProperty(dataEvent, "data", {
            value: new Blob(["deterministic recording"]),
          });
          this.dispatchEvent(dataEvent);
          this.dispatchEvent(new Event("stop"));
        });
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: FakeMediaRecorder,
    });

    Reflect.set(window, "__micHarness", state);
    Reflect.set(window, "__micEndActiveTrack", () => {
      const deviceId = state.activeDeviceId;
      if (!deviceId) return false;
      tracks.get(deviceId)?.dispatchEvent(new Event("ended"));
      mediaDevices.dispatchEvent(new Event("devicechange"));
      return true;
    });
  });
}

async function harnessState(page: Page): Promise<MicHarnessState> {
  return page.evaluate(() =>
    structuredClone(Reflect.get(window, "__micHarness") as MicHarnessState),
  );
}

test.beforeEach(async ({ page }) => {
  await installMicrophoneHarness(page);
  await page.goto("/microphone-test");
});

test("stays idle until explicit Start, then uses raw-ish constraints and actual settings", async ({
  page,
}) => {
  expect((await harnessState(page)).audioContextCount).toBe(0);
  await expect(page.locator("[data-mic-rms]")).toHaveText("—");
  await expect(page.locator("[data-mic-record]")).toBeDisabled();

  await page.locator("[data-mic-start]").click();
  await expect(page.locator("#microphone-test-status [data-status-label]")).toHaveText(
    "Microphone active",
  );
  await expect(page.locator("[data-mic-rms]")).not.toHaveText("—");
  await expect(page.locator("[data-mic-peak]")).not.toHaveText("—");
  await expect(page.locator("[data-mic-input-field]")).toBeVisible();
  await expect(page.locator("[data-mic-input-select] option")).toHaveCount(3);

  const state = await harnessState(page);
  expect(state.audioContextCount).toBe(1);
  expect(state.getUserMediaCalls).toHaveLength(1);
  expect(state.getUserMediaCalls[0]).toEqual({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  await page.locator(".mic-details").evaluate((details) => {
    (details as HTMLDetailsElement).open = true;
  });
  await expect(page.locator("[data-mic-detail-device-id]")).toHaveText("mic-1");
  await expect(page.locator("[data-mic-detail-sample-rate]")).toHaveText("48000 Hz");
  await expect(page.locator("[data-mic-detail-echo-cancellation]")).toHaveText("Off");
});

test("failed exact input selection preserves the previous live microphone", async ({ page }) => {
  await page.locator("[data-mic-start]").click();
  const select = page.locator("[data-mic-input-select]");
  await select.selectOption("mic-fail");

  await expect(page.locator("[data-mic-selection-error]")).toContainText(
    "previous microphone remains active",
  );
  await expect(select).toHaveValue("mic-1");
  await expect(page.locator("[data-mic-active-input]")).toHaveText(
    "Built-in microphone",
  );

  const state = await harnessState(page);
  expect(state.lifecycle).toContain("gum:mic-fail");
  expect(state.lifecycle).not.toContain("track-stop:mic-1");
});

test("successful exact input switch acquires the replacement before old-track teardown", async ({
  page,
}) => {
  await page.locator("[data-mic-start]").click();
  await page.locator("[data-mic-input-select]").selectOption("mic-2");

  await expect(page.locator("[data-mic-active-input]")).toHaveText("USB microphone");
  await expect(page.locator("[data-mic-detail-sample-rate]")).toHaveText("44100 Hz");

  const lifecycle = (await harnessState(page)).lifecycle;
  expect(lifecycle.indexOf("gum:mic-2")).toBeGreaterThan(-1);
  expect(lifecycle.indexOf("track-stop:mic-1")).toBeGreaterThan(
    lifecycle.indexOf("gum:mic-2"),
  );
  expect((await harnessState(page)).getUserMediaCalls[1]).toEqual({
    audio: {
      deviceId: { exact: "mic-2" },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
});

test("recording locks input selection and tool-wide Stop finalizes recorder before mic tracks", async ({
  page,
}) => {
  await page.locator("[data-mic-start]").click();
  await page.locator("[data-mic-record]").click();

  await expect(page.locator("[data-mic-input-select]")).toBeDisabled();
  await expect(page.locator("[data-mic-record-stop]")).toBeEnabled();
  expect((await harnessState(page)).recorderMimeAttempts).toEqual([
    "audio/ogg;codecs=opus",
  ]);

  await page.locator("[data-mic-stop]").click();
  await expect(page.locator("#microphone-test-status [data-status-label]")).toHaveText(
    "Stopped",
  );
  await expect(page.locator("[data-mic-playback]")).toBeVisible();

  const lifecycle = (await harnessState(page)).lifecycle;
  expect(lifecycle.indexOf("recorder-stop")).toBeGreaterThan(-1);
  expect(lifecycle.indexOf("track-stop:mic-1")).toBeGreaterThan(
    lifecycle.indexOf("recorder-stop"),
  );
});

test("track end clears live measurements and keeps an explicit disconnected state after device refresh", async ({
  page,
}) => {
  await page.locator("[data-mic-start]").click();
  await expect(page.locator("[data-mic-rms]")).not.toHaveText("—");

  await page.evaluate(() => {
    const endTrack = Reflect.get(window, "__micEndActiveTrack") as () => boolean;
    endTrack();
  });

  await expect(page.locator("#microphone-test-status [data-status-label]")).toHaveText(
    "Input device disconnected",
  );
  await expect(page.locator("[data-mic-active-input]")).toHaveText(
    "Input device disconnected",
  );
  await expect(page.locator("[data-mic-rms]")).toHaveText("—");
  await expect(page.locator("[data-mic-peak]")).toHaveText("—");
  await expect(page.locator("[data-mic-start]")).toBeEnabled();
});

test("BFCache restoration remounts a fresh idle controller and next Start creates a new context", async ({
  page,
}) => {
  await page.locator("[data-mic-start]").click();
  expect((await harnessState(page)).audioContextCount).toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
  });
  await expect.poll(async () => (await harnessState(page)).closedContextCount).toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await expect(page.locator("#microphone-test-status [data-status-label]")).toHaveText(
    "Ready",
  );
  await expect(page.locator("[data-mic-rms]")).toHaveText("—");

  await page.locator("[data-mic-start]").click();
  await expect(page.locator("#microphone-test-status [data-status-label]")).toHaveText(
    "Microphone active",
  );
  expect((await harnessState(page)).audioContextCount).toBe(2);
});
