import { expect, test } from "@playwright/test";

test("partial analyzer construction is disposed before a clean retry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = {
      audioContextCount: 0,
      closedContextCount: 0,
      deviceListenerAdds: 0,
      deviceListenerRemoves: 0,
      getUserMediaCalls: 0,
      failNextAnalyser: true,
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
        return { deviceId: "mic-1", sampleRate: 48_000, channelCount: 1 };
      }
      stop() {}
    }

    const track = new FakeTrack();
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    } as unknown as MediaStream;

    class FakeMediaDevices extends EventTarget {
      addEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: AddEventListenerOptions | boolean,
      ) {
        if (type === "devicechange") state.deviceListenerAdds += 1;
        super.addEventListener(type, callback, options);
      }
      removeEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: EventListenerOptions | boolean,
      ) {
        if (type === "devicechange") state.deviceListenerRemoves += 1;
        super.removeEventListener(type, callback, options);
      }
      getSupportedConstraints(): MediaTrackSupportedConstraints {
        return {};
      }
      async getUserMedia(): Promise<MediaStream> {
        state.getUserMediaCalls += 1;
        return stream;
      }
      async enumerateDevices(): Promise<MediaDeviceInfo[]> {
        return [];
      }
    }

    class FakeAudioContext {
      currentTime = 0;
      sampleRate = 48_000;
      state: AudioContextState = "suspended";
      readonly destination = new FakeNode(this as unknown as BaseAudioContext);

      constructor(_options?: AudioContextOptions) {
        state.audioContextCount += 1;
      }
      async resume() {
        this.state = "running";
      }
      async close() {
        if (this.state !== "closed") state.closedContextCount += 1;
        this.state = "closed";
      }
      createGain() {
        return new FakeGainNode(
          this as unknown as BaseAudioContext,
        ) as unknown as GainNode;
      }
      createAnalyser() {
        if (state.failNextAnalyser) {
          state.failNextAnalyser = false;
          throw new Error("deterministic analyser construction failure");
        }
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

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: new FakeMediaDevices(),
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
    Reflect.set(window, "__spectrumConstructionState", state);
  });

  await page.goto("/spectrum-analyzer");
  await page.locator("[data-spectrum-start]").click();

  await expect(
    page.locator("#spectrum-analyzer-status [data-status-label]"),
  ).toHaveText("Microphone unavailable");
  await expect(page.locator("[data-spectrum-start]")).toBeEnabled();

  const failedState = await page.evaluate(() =>
    structuredClone(Reflect.get(window, "__spectrumConstructionState")),
  );
  expect(failedState).toMatchObject({
    audioContextCount: 1,
    closedContextCount: 1,
    deviceListenerAdds: 1,
    deviceListenerRemoves: 1,
    getUserMediaCalls: 0,
  });

  await page.locator("[data-spectrum-start]").click();
  await expect(
    page.locator("#spectrum-analyzer-status [data-status-label]"),
  ).toHaveText("Analyzing microphone");

  const retryState = await page.evaluate(() =>
    structuredClone(Reflect.get(window, "__spectrumConstructionState")),
  );
  expect(retryState).toMatchObject({
    audioContextCount: 2,
    closedContextCount: 1,
    deviceListenerAdds: 2,
    deviceListenerRemoves: 1,
    getUserMediaCalls: 1,
  });
});
