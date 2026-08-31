import { expect, test } from "@playwright/test";

test("partial service construction is disposed before a clean retry", async ({
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
      _fftSize = 2048;
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
        // The successful retry owns the track until the test ends.
      }
    }

    class FakeStream {
      readonly track = new FakeTrack();

      getTracks() {
        return [this.track] as unknown as MediaStreamTrack[];
      }

      getAudioTracks() {
        return [this.track] as unknown as MediaStreamTrack[];
      }
    }

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
        return {
          deviceId: true,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
      }

      async getUserMedia(): Promise<MediaStream> {
        state.getUserMediaCalls += 1;
        return new FakeStream() as unknown as MediaStream;
      }

      async enumerateDevices(): Promise<MediaDeviceInfo[]> {
        return [
          {
            deviceId: "mic-1",
            groupId: "group-1",
            kind: "audioinput",
            label: "Test microphone",
            toJSON: () => ({}),
          },
        ] as MediaDeviceInfo[];
      }
    }

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
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: undefined,
    });
    Reflect.set(window, "__micConstructionState", state);
  });

  await page.goto("/microphone-test");
  await page.locator("[data-mic-start]").click();

  await expect(
    page.locator("#microphone-test-status [data-status-label]"),
  ).toHaveText("Microphone unavailable");
  await expect(page.locator("[data-mic-start]")).toBeEnabled();

  const failedState = await page.evaluate(() =>
    structuredClone(Reflect.get(window, "__micConstructionState")),
  );
  expect(failedState).toMatchObject({
    audioContextCount: 1,
    closedContextCount: 1,
    deviceListenerAdds: 1,
    deviceListenerRemoves: 1,
    getUserMediaCalls: 0,
  });

  await page.locator("[data-mic-start]").click();
  await expect(
    page.locator("#microphone-test-status [data-status-label]"),
  ).toHaveText("Microphone active");

  const retryState = await page.evaluate(() =>
    structuredClone(Reflect.get(window, "__micConstructionState")),
  );
  expect(retryState).toMatchObject({
    audioContextCount: 2,
    closedContextCount: 1,
    deviceListenerAdds: 2,
    deviceListenerRemoves: 1,
    getUserMediaCalls: 1,
  });
});
