import { expect, test, type Page } from "@playwright/test";

async function installNoDeviceIdHarness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class FakeAudioParam {
      value = 1;
      setValueAtTime(value: number) {
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
      #fftSize = 2_048;
      smoothingTimeConstant = 0;

      get fftSize() {
        return this.#fftSize;
      }

      set fftSize(value: number) {
        this.#fftSize = value;
      }

      get frequencyBinCount() {
        return this.#fftSize / 2;
      }

      getFloatTimeDomainData(target: Float32Array) {
        target.fill(0.01);
      }

      getFloatFrequencyData(target: Float32Array) {
        target.fill(-100);
      }
    }

    class FakeTrack extends EventTarget {
      readonly kind = "audio";

      getSettings(): MediaTrackSettings {
        return {
          sampleRate: 48_000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        };
      }

      stop() {}
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

    class FakeAudioContext {
      currentTime = 0;
      sampleRate = 48_000;
      state: AudioContextState = "suspended";
      readonly destination: FakeNode;

      constructor(_options?: AudioContextOptions) {
        this.destination = new FakeNode(this as unknown as BaseAudioContext);
      }

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

      async getUserMedia(): Promise<MediaStream> {
        return new FakeStream() as unknown as MediaStream;
      }

      async enumerateDevices(): Promise<MediaDeviceInfo[]> {
        return [];
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
  });
}

test("calibration without a reported deviceId is session-only and clears on Stop", async ({
  page,
}) => {
  await installNoDeviceIdHarness(page);
  await page.goto("/decibel-meter");

  await page.locator("[data-db-start]").click();
  await expect(page.locator("[data-db-detail-device-id]")).toHaveText(
    "Not reported",
  );
  await expect(page.locator("[data-db-calibration-eligibility]")).toContainText(
    "Eligible",
  );

  await page.locator("[data-db-reference]").fill("72");
  await page.locator("[data-db-weighting-confirm]").check();
  await page.locator("[data-db-calibrate]").click();

  await expect(page.locator("[data-db-calibration-live-status]")).toHaveText(
    "Calibration accepted",
    { timeout: 4_500 },
  );
  await expect(page.locator("[data-db-calibration-status]")).toContainText(
    "session only",
  );
  await expect(page.locator("[data-db-estimate]")).toHaveText("72.0 dB");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("browserAudioLab.dbCalibration.v2"),
    ),
  ).toBeNull();

  await page.locator("[data-db-stop]").click();
  await expect(page.locator("[data-db-calibration-status]")).toHaveText(
    "Uncalibrated",
  );
  await expect(page.locator("[data-db-estimate-panel]")).toBeHidden();

  await page.locator("[data-db-start]").click();
  await expect(page.locator("[data-db-calibration-status]")).toHaveText(
    "Uncalibrated",
  );
  await expect(page.locator("[data-db-estimate-panel]")).toBeHidden();
  await expect(page.locator("[data-db-calibrate]")).toHaveText(
    "Capture 3-second reference",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("browserAudioLab.dbCalibration.v2"),
    ),
  ).toBeNull();
});
