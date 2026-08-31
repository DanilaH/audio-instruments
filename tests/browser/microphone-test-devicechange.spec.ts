import { expect, test } from "@playwright/test";

test("device metadata refresh never makes another microphone look active", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = {
      getUserMediaCalls: 0,
      devices: ["mic-1", "mic-2"],
      reportDeviceId: true,
    };

    class FakeAudioParam {
      setValueAtTime() {
        return this;
      }
    }

    class FakeNode {
      readonly gain = new FakeAudioParam();

      constructor(readonly context: BaseAudioContext) {}

      connect(destination: unknown) {
        return destination;
      }

      disconnect() {}
    }

    class FakeAnalyser extends FakeNode {
      fftSize = 2_048;
      smoothingTimeConstant = 0;
      minDecibels = -100;
      maxDecibels = -30;

      get frequencyBinCount() {
        return this.fftSize / 2;
      }

      getFloatTimeDomainData(target: Float32Array) {
        target.fill(0.1);
      }

      getFloatFrequencyData(target: Float32Array) {
        target.fill(-70);
      }
    }

    class FakeTrack extends EventTarget {
      getSettings(): MediaTrackSettings {
        return {
          ...(state.reportDeviceId ? { deviceId: "mic-1" } : {}),
          sampleRate: 48_000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        };
      }

      stop() {}
    }

    const track = new FakeTrack();
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    } as unknown as MediaStream;

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
        return new FakeNode(
          this as unknown as BaseAudioContext,
        ) as unknown as GainNode;
      }

      createAnalyser() {
        return new FakeAnalyser(
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
        return {};
      }

      async getUserMedia(): Promise<MediaStream> {
        state.getUserMediaCalls += 1;
        return stream;
      }

      async enumerateDevices(): Promise<MediaDeviceInfo[]> {
        return state.devices.map(
          (deviceId, index) =>
            ({
              deviceId,
              groupId: `group-${index + 1}`,
              kind: "audioinput",
              label:
                deviceId === "mic-1" ? "Built-in microphone" : "USB microphone",
              toJSON: () => ({}),
            }) as MediaDeviceInfo,
        );
      }
    }

    const mediaDevices = new FakeMediaDevices();
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
      value: mediaDevices,
    });

    Reflect.set(window, "__micDevicechangeState", state);
    Reflect.set(window, "__removeActiveMicFromEnumeration", () => {
      state.devices = ["mic-2"];
      mediaDevices.dispatchEvent(new Event("devicechange"));
    });
    Reflect.set(window, "__prepareUnreportedMicRestart", () => {
      state.devices = ["mic-1", "mic-2"];
      state.reportDeviceId = false;
    });
  });

  await page.goto("/microphone-test");
  await page.locator("[data-mic-start]").click();
  await expect(page.locator("[data-mic-input-select]")).toHaveValue("mic-1");
  await expect(page.locator("[data-mic-active-input]")).toHaveText(
    "Built-in microphone",
  );

  await page.evaluate(() => {
    const removeActive = Reflect.get(
      window,
      "__removeActiveMicFromEnumeration",
    ) as () => void;
    removeActive();
  });

  await expect(page.locator("[data-mic-input-select]")).toHaveValue("mic-1");
  await expect(
    page.locator('[data-mic-input-select] option[value="mic-1"]'),
  ).toHaveText("Active input (not currently listed)");
  await expect(page.locator("[data-mic-active-input]")).toHaveText(
    "Active input",
  );
  await expect(
    page.locator('[data-mic-input-select] option[value="mic-2"]'),
  ).toHaveText("USB microphone");

  expect(
    await page.evaluate(
      () =>
        (
          Reflect.get(window, "__micDevicechangeState") as {
            getUserMediaCalls: number;
          }
        ).getUserMediaCalls,
    ),
  ).toBe(1);

  await page.locator("[data-mic-stop]").click();
  await page.evaluate(() => {
    const prepareRestart = Reflect.get(
      window,
      "__prepareUnreportedMicRestart",
    ) as () => void;
    prepareRestart();
  });
  await page.locator("[data-mic-start]").click();

  await expect(page.locator("[data-mic-input-select]")).toHaveValue("");
  await expect(
    page.locator('[data-mic-input-select] option[value=""]'),
  ).toHaveText("Active input (device ID not reported)");
  await expect(page.locator("[data-mic-active-input]")).toHaveText(
    "Active input",
  );
  await expect(page.locator("[data-mic-input-field]")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (
          Reflect.get(window, "__micDevicechangeState") as {
            getUserMediaCalls: number;
          }
        ).getUserMediaCalls,
    ),
  ).toBe(2);
});
