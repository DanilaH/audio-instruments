import { expect, test, type Page } from "@playwright/test";

interface DeviceMetadataHarnessOptions {
  failEnumerateCall: number;
}

async function installHarness(
  page: Page,
  options: DeviceMetadataHarnessOptions,
): Promise<void> {
  await page.addInitScript(({ failEnumerateCall }) => {
    const state = {
      enumerateCount: 0,
      getUserMediaCalls: [] as MediaStreamConstraints[],
      stoppedDeviceIds: [] as string[],
      activeDeviceId: null as string | null,
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
        if (destination === undefined) {
          this.connections.length = 0;
          return;
        }
        const index = this.connections.indexOf(destination);
        if (index >= 0) this.connections.splice(index, 1);
      }
    }

    class FakeGainNode extends FakeNode {
      readonly gain = new FakeAudioParam();
    }

    class FakeAnalyserNode extends FakeNode {
      _fftSize = 2_048;
      smoothingTimeConstant = 0;
      minDecibels = -100;
      maxDecibels = -30;
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
        target.fill(0.1);
      }
      getFloatFrequencyData(target: Float32Array) {
        target.fill(-60);
      }
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
        state.stoppedDeviceIds.push(this.deviceId);
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

    class FakeAudioContext {
      currentTime = 0;
      sampleRate = 48_000;
      state: AudioContextState = "suspended";
      readonly destination = new FakeNode(this as unknown as BaseAudioContext);

      async resume() {
        this.state = "running";
      }
      async close() {
        this.state = "closed";
      }
      createGain() {
        return new FakeGainNode(
          this as unknown as BaseAudioContext,
        ) as unknown as GainNode;
      }
      createAnalyser() {
        return new FakeAnalyserNode(
          this as unknown as BaseAudioContext,
        ) as unknown as AnalyserNode;
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
        state.activeDeviceId = deviceId;
        return new FakeStream(new FakeTrack(deviceId)) as unknown as MediaStream;
      }

      async enumerateDevices(): Promise<MediaDeviceInfo[]> {
        state.enumerateCount += 1;
        if (state.enumerateCount === failEnumerateCall) {
          throw new DOMException("deterministic metadata failure", "NotReadableError");
        }
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
        ] as MediaDeviceInfo[];
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: new FakeMediaDevices(),
    });
    Reflect.set(window, "__micDeviceMetadataState", state);
  }, options);
}

test("a device-list metadata failure does not tear down a valid initial capture", async ({
  page,
}) => {
  await installHarness(page, { failEnumerateCall: 1 });
  await page.goto("/microphone-test");
  await page.locator("[data-mic-start]").click();

  await expect(page.locator("#microphone-test-status [data-status-label]")).toHaveText(
    "Microphone active",
  );
  await expect(page.locator("[data-mic-error]")).toBeHidden();
  await expect(page.locator("[data-mic-input-field]")).toBeHidden();
  await expect(page.locator("[data-mic-active-input]")).toHaveText("Active input");
  await expect(page.locator("[data-mic-detail-device-id]")).toHaveText("mic-1");

  const state = await page.evaluate(() =>
    structuredClone(Reflect.get(window, "__micDeviceMetadataState")),
  );
  expect(state).toMatchObject({
    enumerateCount: 1,
    activeDeviceId: "mic-1",
    stoppedDeviceIds: [],
  });
});

test("post-switch metadata failure keeps the successfully selected replacement active", async ({
  page,
}) => {
  await installHarness(page, { failEnumerateCall: 2 });
  await page.goto("/microphone-test");
  await page.locator("[data-mic-start]").click();

  const select = page.locator("[data-mic-input-select]");
  await expect(select).toBeVisible();
  await select.selectOption("mic-2");

  await expect(page.locator("#microphone-test-status [data-status-label]")).toHaveText(
    "Microphone active",
  );
  await expect(page.locator("[data-mic-selection-error]")).toBeHidden();
  await expect(select).toHaveValue("mic-2");
  await expect(page.locator("[data-mic-active-input]")).toHaveText("USB microphone");
  await expect(page.locator("[data-mic-detail-device-id]")).toHaveText("mic-2");
  await expect(page.locator("[data-mic-detail-sample-rate]")).toHaveText("44100 Hz");

  const state = await page.evaluate(() =>
    structuredClone(Reflect.get(window, "__micDeviceMetadataState")),
  );
  expect(state).toMatchObject({
    enumerateCount: 2,
    activeDeviceId: "mic-2",
    stoppedDeviceIds: ["mic-1"],
  });
});
