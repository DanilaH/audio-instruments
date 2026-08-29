import { expect, test, type Page } from "@playwright/test";

interface SpectrumHarnessState {
  audioContextCount: number;
  closedContextCount: number;
  getUserMediaCalls: MediaStreamConstraints[];
  lifecycle: string[];
  activeDeviceId: string | null;
  frequencyReads: number;
  waveformReads: number;
}

async function installSpectrumHarness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state: SpectrumHarnessState = {
      audioContextCount: 0,
      closedContextCount: 0,
      getUserMediaCalls: [],
      lifecycle: [],
      activeDeviceId: null,
      frequencyReads: 0,
      waveformReads: 0,
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
      #fftSize = 2_048;
      smoothingTimeConstant = 0;
      minDecibels = -100;
      maxDecibels = -30;

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
        state.waveformReads += 1;
        for (let index = 0; index < target.length; index += 1) {
          target[index] = index % 2 === 0 ? 0.18 : -0.18;
        }
      }

      getFloatFrequencyData(target: Float32Array) {
        state.frequencyReads += 1;
        target.fill(-90);
        const binWidth = 48_000 / this.#fftSize;
        const dominantBin = Math.min(
          target.length - 1,
          Math.max(1, Math.round(1_000 / binWidth)),
        );
        target[dominantBin] = -32;
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
          typeof audio === "object" &&
          audio.deviceId &&
          typeof audio.deviceId === "object"
            ? String((audio.deviceId as ConstrainDOMStringParameters).exact ?? "")
            : "";
        const deviceId = exact || "mic-1";
        state.lifecycle.push(`gum:${deviceId}`);
        if (deviceId === "mic-fail") {
          throw new DOMException(
            "deterministic selection failure",
            "NotReadableError",
          );
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
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });

    Reflect.set(window, "__spectrumHarness", state);
    Reflect.set(window, "__spectrumEndActiveTrack", () => {
      const deviceId = state.activeDeviceId;
      if (!deviceId) return false;
      tracks.get(deviceId)?.dispatchEvent(new Event("ended"));
      mediaDevices.dispatchEvent(new Event("devicechange"));
      return true;
    });
  });
}

async function harnessState(page: Page): Promise<SpectrumHarnessState> {
  return page.evaluate(() =>
    structuredClone(Reflect.get(window, "__spectrumHarness") as SpectrumHarnessState),
  );
}

test.beforeEach(async ({ page }) => {
  await installSpectrumHarness(page);
  await page.goto("/spectrum-analyzer");
});

test("stays idle until Start, then applies documented FFT defaults and raw-ish constraints", async ({
  page,
}) => {
  expect((await harnessState(page)).audioContextCount).toBe(0);
  await expect(page.locator("[data-spectrum-fft]")).toHaveValue("2048");
  await expect(page.locator("[data-spectrum-dominant]")).toHaveText("—");
  await expect(page.locator("[data-spectrum-stop]")).toBeDisabled();
  await expect(page.getByRole("link", { name: "Microphone Test" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Pitch Detector" })).toHaveCount(0);

  await page.locator("[data-spectrum-start]").click();
  await expect(
    page.locator("#spectrum-analyzer-status [data-status-label]"),
  ).toHaveText("Analyzing microphone");
  await expect(page.locator("[data-spectrum-stop]")).toBeEnabled();
  await expect(page.locator("[data-spectrum-input-field]")).toBeVisible();
  await expect(page.locator("[data-spectrum-input] option")).toHaveCount(3);
  await expect(page.locator("[data-spectrum-dominant]")).not.toHaveText("—");
  await expect(page.locator("[data-spectrum-analysis-rate]")).toHaveText("48000 Hz");
  await expect(page.locator("[data-spectrum-fft-value]")).toHaveText("2048");
  await expect(page.locator("[data-spectrum-bin-width]")).toHaveText("23.4 Hz");
  await expect(page.locator("[data-spectrum-range]")).toHaveText(
    "20 Hz → 20000 Hz",
  );

  const state = await harnessState(page);
  expect(state.audioContextCount).toBe(1);
  expect(state.getUserMediaCalls).toEqual([
    {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    },
  ]);
  expect(state.frequencyReads).toBeGreaterThan(0);

  await page.locator("[data-spectrum-fft]").selectOption("4096");
  await expect(page.locator("[data-spectrum-fft-value]")).toHaveText("4096");
  await expect(page.locator("[data-spectrum-bin-width]")).toHaveText("11.7 Hz");
  expect((await harnessState(page)).getUserMediaCalls).toHaveLength(1);
});

test("switches Spectrum, Waveform and Spectrogram without another capture", async ({
  page,
}) => {
  await page.locator("[data-spectrum-start]").click();
  const callsAfterStart = (await harnessState(page)).getUserMediaCalls.length;

  await page.locator('[data-spectrum-view="waveform"]').click();
  await expect(page.locator('[data-spectrum-view="waveform"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect
    .poll(async () => (await harnessState(page)).waveformReads)
    .toBeGreaterThan(0);
  await expect(page.locator("[data-spectrum-dominant]")).toHaveText("—");

  const frequencyReadsBeforeSpectrogram = (await harnessState(page)).frequencyReads;
  await page.locator('[data-spectrum-view="spectrogram"]').click();
  await expect(page.locator('[data-spectrum-view="spectrogram"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect
    .poll(async () => (await harnessState(page)).frequencyReads)
    .toBeGreaterThan(frequencyReadsBeforeSpectrogram);

  await page.locator('[data-spectrum-view="spectrum"]').click();
  await expect(page.locator("[data-spectrum-dominant]")).not.toHaveText("—");
  expect((await harnessState(page)).getUserMediaCalls).toHaveLength(callsAfterStart);
});

test("failed exact input selection preserves the previous live microphone", async ({
  page,
}) => {
  await page.locator("[data-spectrum-start]").click();
  const select = page.locator("[data-spectrum-input]");
  await select.selectOption("mic-fail");

  await expect(page.locator("[data-spectrum-selection-error]")).toContainText(
    "previous microphone remains active",
  );
  await expect(select).toHaveValue("mic-1");
  await expect(page.locator("[data-spectrum-active-input]")).toHaveText(
    "Built-in microphone",
  );

  const state = await harnessState(page);
  expect(state.lifecycle).toContain("gum:mic-fail");
  expect(state.lifecycle).not.toContain("track-stop:mic-1");
});

test("successful exact switch acquires the new input before old-stream teardown", async ({
  page,
}) => {
  await page.locator("[data-spectrum-start]").click();
  await page.locator("[data-spectrum-input]").selectOption("mic-2");

  await expect(page.locator("[data-spectrum-active-input]")).toHaveText(
    "USB microphone",
  );
  const state = await harnessState(page);
  const acquireIndex = state.lifecycle.indexOf("gum:mic-2");
  const stopIndex = state.lifecycle.indexOf("track-stop:mic-1");
  expect(acquireIndex).toBeGreaterThan(-1);
  expect(stopIndex).toBeGreaterThan(acquireIndex);
  expect(state.getUserMediaCalls[1]).toEqual({
    audio: {
      deviceId: { exact: "mic-2" },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
});

test("Stop cancels rendering, restart resumes one live analysis flow, and track loss disconnects", async ({
  page,
}) => {
  await page.locator("[data-spectrum-start]").click();
  await expect
    .poll(async () => (await harnessState(page)).frequencyReads)
    .toBeGreaterThan(0);

  await page.locator("[data-spectrum-stop]").click();
  await expect(
    page.locator("#spectrum-analyzer-status [data-status-label]"),
  ).toHaveText("Stopped");
  await expect(page.locator("[data-spectrum-dominant]")).toHaveText("—");
  await expect(page.locator("[data-spectrum-start]")).toBeEnabled();

  const readsAfterStop = (await harnessState(page)).frequencyReads;
  await page.waitForTimeout(80);
  expect((await harnessState(page)).frequencyReads).toBe(readsAfterStop);
  expect((await harnessState(page)).lifecycle).toContain("track-stop:mic-1");

  await page.locator("[data-spectrum-start]").click();
  await expect
    .poll(async () => (await harnessState(page)).frequencyReads)
    .toBeGreaterThan(readsAfterStop);
  expect((await harnessState(page)).getUserMediaCalls).toHaveLength(2);

  await page.evaluate(() => {
    const endTrack = Reflect.get(window, "__spectrumEndActiveTrack") as () => boolean;
    endTrack();
  });
  await expect(
    page.locator("#spectrum-analyzer-status [data-status-label]"),
  ).toHaveText("Input device disconnected");
  await expect(page.locator("[data-spectrum-active-input]")).toHaveText(
    "Input device disconnected",
  );
  await expect(page.locator("[data-spectrum-dominant]")).toHaveText("—");
  await expect(page.locator("[data-spectrum-start]")).toBeEnabled();
});

test("BFCache restoration is idle and the next Start creates a fresh AudioContext", async ({
  page,
}) => {
  await page.locator("[data-spectrum-start]").click();
  expect((await harnessState(page)).audioContextCount).toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
  });
  await expect
    .poll(async () => (await harnessState(page)).closedContextCount)
    .toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await expect(
    page.locator("#spectrum-analyzer-status [data-status-label]"),
  ).toHaveText("Ready");
  await expect(page.locator("[data-spectrum-dominant]")).toHaveText("—");

  await page.locator("[data-spectrum-start]").click();
  await expect(
    page.locator("#spectrum-analyzer-status [data-status-label]"),
  ).toHaveText("Analyzing microphone");
  expect((await harnessState(page)).audioContextCount).toBe(2);
});
