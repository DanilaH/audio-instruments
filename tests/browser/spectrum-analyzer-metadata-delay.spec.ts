import { expect, test } from "@playwright/test";

test("slow device enumeration never blocks active analyzer state or Stop", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = {
      enumerateStarted: 0,
      trackStopCount: 0,
    };

    class FakeAudioParam {
      value = 1;
      setValueAtTime(value: number, _time: number) {
        this.value = value;
        return this;
      }
    }

    class FakeNode {
      constructor(readonly context: BaseAudioContext) {}
      connect(destination: unknown) {
        return destination;
      }
      disconnect() {}
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
        target.fill(-70);
      }
    }

    class FakeTrack extends EventTarget {
      getSettings(): MediaTrackSettings {
        return {
          deviceId: "mic-1",
          sampleRate: 48_000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        };
      }
      stop() {
        state.trackStopCount += 1;
      }
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

    let resolveEnumeration!: (devices: MediaDeviceInfo[]) => void;
    const enumeration = new Promise<MediaDeviceInfo[]>((resolve) => {
      resolveEnumeration = resolve;
    });

    class FakeMediaDevices extends EventTarget {
      getSupportedConstraints(): MediaTrackSupportedConstraints {
        return {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
      }
      async getUserMedia(): Promise<MediaStream> {
        return stream;
      }
      enumerateDevices(): Promise<MediaDeviceInfo[]> {
        state.enumerateStarted += 1;
        return enumeration;
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: new FakeMediaDevices(),
    });
    Reflect.set(window, "__spectrumMetadataDelayState", state);
    Reflect.set(window, "__resolveSpectrumEnumeration", () => {
      resolveEnumeration([
        {
          deviceId: "mic-1",
          groupId: "group-1",
          kind: "audioinput",
          label: "Delayed microphone",
          toJSON: () => ({}),
        } as MediaDeviceInfo,
      ]);
    });
  });

  await page.goto("/spectrum-analyzer");
  await page.locator("[data-spectrum-start]").click();

  await expect(
    page.locator("#spectrum-analyzer-status [data-status-label]"),
  ).toHaveText("Analyzing microphone");
  await expect(page.locator("[data-spectrum-stop]")).toBeEnabled();
  await expect(page.locator("[data-spectrum-analysis-rate]")).toHaveText(
    "48000 Hz",
  );

  const beforeStop = await page.evaluate(() =>
    structuredClone(Reflect.get(window, "__spectrumMetadataDelayState")),
  );
  expect(beforeStop).toEqual({ enumerateStarted: 1, trackStopCount: 0 });

  await page.locator("[data-spectrum-stop]").click();
  await expect(
    page.locator("#spectrum-analyzer-status [data-status-label]"),
  ).toHaveText("Stopped");

  await page.evaluate(() => {
    const resolve = Reflect.get(
      window,
      "__resolveSpectrumEnumeration",
    ) as () => void;
    resolve();
  });
  await page.waitForTimeout(0);

  await expect(
    page.locator("#spectrum-analyzer-status [data-status-label]"),
  ).toHaveText("Stopped");
  await expect(page.locator("[data-spectrum-input-field]")).toBeHidden();

  const afterStop = await page.evaluate(() =>
    structuredClone(Reflect.get(window, "__spectrumMetadataDelayState")),
  );
  expect(afterStop).toEqual({ enumerateStarted: 1, trackStopCount: 1 });
});
