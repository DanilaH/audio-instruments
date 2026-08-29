import { expect, test } from "@playwright/test";

test("permission denial closes the failed session and explicit retry uses a fresh AudioContext", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = {
      contextCount: 0,
      closedCount: 0,
      captureCount: 0,
    };

    class FakeParam {
      setValueAtTime() {
        return this;
      }
    }

    class FakeNode {
      readonly context: BaseAudioContext;
      readonly gain = new FakeParam();
      constructor(context: BaseAudioContext) {
        this.context = context;
      }
      connect(destination: unknown) {
        return destination;
      }
      disconnect() {}
    }

    class FakeAnalyser extends FakeNode {
      fftSize = 2_048;
      smoothingTimeConstant = 0;
      get frequencyBinCount() {
        return this.fftSize / 2;
      }
      getFloatTimeDomainData(target: Float32Array) {
        target.fill(0.1);
      }
      getFloatFrequencyData(target: Float32Array) {
        target.fill(-60);
      }
    }

    class FakeContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 48_000;
      readonly destination: FakeNode;

      constructor() {
        state.contextCount += 1;
        this.destination = new FakeNode(this as unknown as BaseAudioContext);
      }
      async resume() {
        this.state = "running";
      }
      async close() {
        if (this.state !== "closed") state.closedCount += 1;
        this.state = "closed";
      }
      createGain() {
        return new FakeNode(this as unknown as BaseAudioContext) as unknown as GainNode;
      }
      createAnalyser() {
        return new FakeAnalyser(this as unknown as BaseAudioContext) as unknown as AnalyserNode;
      }
      createMediaStreamSource() {
        return new FakeNode(
          this as unknown as BaseAudioContext,
        ) as unknown as MediaStreamAudioSourceNode;
      }
    }

    class FakeTrack extends EventTarget {
      stop() {}
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
    }

    const track = new FakeTrack();
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    } as unknown as MediaStream;

    class FakeMediaDevices extends EventTarget {
      getSupportedConstraints(): MediaTrackSupportedConstraints {
        return {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
      }
      async getUserMedia(): Promise<MediaStream> {
        state.captureCount += 1;
        if (state.captureCount === 1) {
          throw new DOMException("permission denied", "NotAllowedError");
        }
        return stream;
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

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeContext,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: new FakeMediaDevices(),
    });
    Reflect.set(window, "__micPermissionHarness", state);
  });

  await page.goto("/microphone-test");
  await page.locator("[data-mic-start]").click();

  await expect(page.locator("#microphone-test-status [data-status-label]")).toHaveText(
    "Microphone unavailable",
  );
  await expect(page.locator("[data-mic-error]")).toContainText(
    "Microphone permission was denied",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        structuredClone(
          Reflect.get(window, "__micPermissionHarness") as {
            contextCount: number;
            closedCount: number;
            captureCount: number;
          },
        ),
      ),
    )
    .toMatchObject({ contextCount: 1, closedCount: 1, captureCount: 1 });

  await page.locator("[data-mic-start]").click();
  await expect(page.locator("#microphone-test-status [data-status-label]")).toHaveText(
    "Microphone active",
  );

  const retryState = await page.evaluate(() =>
    structuredClone(
      Reflect.get(window, "__micPermissionHarness") as {
        contextCount: number;
        closedCount: number;
        captureCount: number;
      },
    ),
  );
  expect(retryState).toEqual({ contextCount: 2, closedCount: 1, captureCount: 2 });
});
