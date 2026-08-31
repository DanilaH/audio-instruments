import { expect, test, type Page } from "@playwright/test";

interface DbHarnessState {
  audioContextCount: number;
  closedContextCount: number;
  getUserMediaCalls: MediaStreamConstraints[];
  lifecycle: string[];
  activeDeviceId: string | null;
  meterReadTimes: number[];
  meterMode: "stable" | "clipping" | "unstable";
  defaultDevice: "mic-1" | "mic-no-id";
}

async function installDbHarness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state: DbHarnessState = {
      audioContextCount: 0,
      closedContextCount: 0,
      getUserMediaCalls: [],
      lifecycle: [],
      activeDeviceId: null,
      meterReadTimes: [],
      meterMode: "stable",
      defaultDevice: "mic-1",
    };

    class FakeAudioParam {
      value = 1;
      setValueAtTime(value: number) {
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
      fftSizeValue = 2_048;
      smoothingTimeConstant = 0;
      minDecibels = -100;
      maxDecibels = -30;

      get fftSize() {
        return this.fftSizeValue;
      }
      set fftSize(value: number) {
        this.fftSizeValue = value;
      }
      get frequencyBinCount() {
        return this.fftSizeValue / 2;
      }
      getFloatTimeDomainData(target: Float32Array) {
        state.meterReadTimes.push(performance.now());
        const readIndex = state.meterReadTimes.length;
        if (state.meterMode === "unstable") {
          target.fill(readIndex % 2 === 0 ? 0.005 : 0.02);
          return;
        }
        target.fill(0.01);
        if (state.meterMode === "clipping") target[target.length - 1] = 0.95;
      }
      getFloatFrequencyData(target: Float32Array) {
        target.fill(-100);
      }
    }

    class FakeTrack extends EventTarget {
      readonly kind = "audio";
      constructor(readonly internalId: string) {
        super();
      }
      getSettings(): MediaTrackSettings {
        if (this.internalId === "mic-processed") {
          return {
            deviceId: "mic-processed",
            sampleRate: 48_000,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true,
          };
        }
        if (this.internalId === "mic-no-id") {
          return {
            sampleRate: 48_000,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          };
        }
        return {
          deviceId: this.internalId,
          sampleRate: this.internalId === "mic-2" ? 44_100 : 48_000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        };
      }
      stop() {
        state.lifecycle.push(`track-stop:${this.internalId}`);
        if (state.activeDeviceId === this.internalId) state.activeDeviceId = null;
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
        const deviceId = exact || state.defaultDevice;
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
            deviceId: "mic-processed",
            groupId: "group-3",
            kind: "audioinput",
            label: "Processed microphone",
            toJSON: () => ({}),
          },
          {
            deviceId: "mic-fail",
            groupId: "group-4",
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

    Reflect.set(window, "__dbHarness", state);
    Reflect.set(window, "__dbSetMeterMode", (mode: DbHarnessState["meterMode"]) => {
      state.meterMode = mode;
    });
    Reflect.set(
      window,
      "__dbSetDefaultDevice",
      (device: DbHarnessState["defaultDevice"]) => {
        state.defaultDevice = device;
      },
    );
    Reflect.set(window, "__dbEndActiveTrack", () => {
      const deviceId = state.activeDeviceId;
      if (!deviceId) return false;
      tracks.get(deviceId)?.dispatchEvent(new Event("ended"));
      mediaDevices.dispatchEvent(new Event("devicechange"));
      return true;
    });
  });
}

async function harnessState(page: Page): Promise<DbHarnessState> {
  return page.evaluate(() =>
    structuredClone(Reflect.get(window, "__dbHarness") as DbHarnessState),
  );
}

async function setMeterMode(
  page: Page,
  mode: DbHarnessState["meterMode"],
): Promise<void> {
  await page.evaluate((value) => {
    const setMode = Reflect.get(window, "__dbSetMeterMode") as (
      mode: DbHarnessState["meterMode"],
    ) => void;
    setMode(value);
  }, mode);
}

test.beforeEach(async ({ page }) => {
  await installDbHarness(page);
  await page.goto("/decibel-meter");
});

test("stays dBFS-first until Start, then meters at the shared 10 Hz cadence", async ({
  page,
}) => {
  expect((await harnessState(page)).audioContextCount).toBe(0);
  await expect(page.locator("[data-db-rms]")).toHaveText("—");
  await expect(page.locator("[data-db-peak]")).toHaveText("—");
  await expect(page.locator("[data-db-stop]")).toBeDisabled();
  await expect(page.locator("[data-db-estimate-panel]")).toBeHidden();
  await expect(page.getByRole("link", { name: "Microphone Test" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Spectrum Analyzer" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Pitch Detector" })).toHaveCount(1);

  await page.locator("[data-db-start]").click();
  await expect(page.locator("#decibel-meter-status [data-status-label]")).toHaveText(
    "Measuring digital microphone level",
  );
  await expect(page.locator("[data-db-rms]")).toHaveText("-40.0 dBFS");
  await expect(page.locator("[data-db-peak]")).toHaveText("-40.0 dBFS");
  await expect(page.locator("[data-db-detail-analysis-rate]")).toHaveText("48000 Hz");
  await expect(page.locator("[data-db-detail-sample-rate]")).toHaveText("48000 Hz");
  await expect(page.locator("[data-db-detail-auto-gain]")).toHaveText("Off");
  await expect(page.locator("[data-db-calibration-eligibility]")).toContainText(
    "Eligible",
  );

  const state = await harnessState(page);
  expect(state.getUserMediaCalls).toEqual([
    {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    },
  ]);
  await expect
    .poll(async () => (await harnessState(page)).meterReadTimes.length)
    .toBeGreaterThanOrEqual(3);
  const reads = (await harnessState(page)).meterReadTimes;
  const deltas = reads.slice(1).map((time, index) => time - (reads[index] ?? time));
  expect(deltas.every((delta) => delta >= 80)).toBe(true);
});

test("keeps dBFS active but disables calibration when processing is reported on", async ({
  page,
}) => {
  await page.locator("[data-db-start]").click();
  await page.locator("[data-db-input]").selectOption("mic-processed");

  await expect(page.locator("[data-db-active-input]")).toHaveText(
    "Processed microphone",
  );
  await expect(page.locator("[data-db-rms]")).toHaveText("-40.0 dBFS");
  await expect(page.locator("[data-db-detail-auto-gain]")).toHaveText("On");
  await expect(page.locator("[data-db-calibration-eligibility]")).toContainText(
    "Reference calibration unavailable",
  );
  await expect(page.locator("[data-db-reference]")).toBeDisabled();
  await expect(page.locator("[data-db-calibrate]")).toBeDisabled();
  await expect(page.locator("[data-db-estimate-panel]")).toBeHidden();
});

test("accepts a stable 3-second Z/Flat/Linear reference and persists it by deviceId", async ({
  page,
}) => {
  await page.locator("[data-db-start]").click();
  await page.locator("[data-db-reference]").fill("72");
  await page.locator("[data-db-weighting-confirm]").check();
  await page.locator("[data-db-calibrate]").click();

  await expect(page.locator("[data-db-calibration-live-status]")).toHaveText(
    "Calibration accepted",
    { timeout: 4_500 },
  );
  await expect(page.locator("[data-db-calibration-status]")).toContainText(
    "User-calibrated",
  );
  await expect(page.locator("[data-db-estimate-panel]")).toBeVisible();
  await expect(page.locator("[data-db-estimate]")).toHaveText("72.0 dB");
  await expect(page.locator("[data-db-calibrate]")).toHaveText(
    "Reset current-device calibration",
  );

  const persisted = await page.evaluate(() =>
    localStorage.getItem("browserAudioLab.dbCalibration.v2"),
  );
  expect(persisted).toContain('"mic-1"');
});

test("resets only the active device calibration", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "browserAudioLab.dbCalibration.v2",
      JSON.stringify({
        byDeviceId: {
          "mic-1": {
            offset: 112,
            createdAt: 1_000,
            optionalLabel: "Built-in microphone",
          },
          "mic-2": {
            offset: 104,
            createdAt: 2_000,
            optionalLabel: "USB microphone",
          },
        },
      }),
    );
  });

  await page.locator("[data-db-start]").click();
  await expect(page.locator("[data-db-estimate]")).toHaveText("72.0 dB");
  await expect(page.locator("[data-db-calibrate]")).toHaveText(
    "Reset current-device calibration",
  );

  await page.locator("[data-db-calibrate]").click();
  await expect(page.locator("[data-db-calibration-live-status]")).toHaveText(
    "Calibration reset",
  );
  await expect(page.locator("[data-db-calibration-status]")).toHaveText(
    "Uncalibrated",
  );
  await expect(page.locator("[data-db-estimate-panel]")).toBeHidden();
  await expect(page.locator("[data-db-calibrate]")).toHaveText(
    "Capture 3-second reference",
  );

  const persisted = await page.evaluate(() => {
    const raw = localStorage.getItem("browserAudioLab.dbCalibration.v2");
    return raw ? (JSON.parse(raw) as { byDeviceId: Record<string, unknown> }) : null;
  });
  expect(persisted?.byDeviceId["mic-1"]).toBeUndefined();
  expect(persisted?.byDeviceId["mic-2"]).toBeDefined();
});

test("loads calibration only for the matching device and restores it when switching back", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "browserAudioLab.dbCalibration.v2",
      JSON.stringify({
        byDeviceId: {
          "mic-1": {
            offset: 112,
            createdAt: 1_000,
            optionalLabel: "Built-in microphone",
          },
        },
      }),
    );
  });

  await page.locator("[data-db-start]").click();
  await expect(page.locator("[data-db-estimate]")).toHaveText("72.0 dB");

  await page.locator("[data-db-input]").selectOption("mic-2");
  await expect(page.locator("[data-db-active-input]")).toHaveText("USB microphone");
  await expect(page.locator("[data-db-calibration-status]")).toHaveText(
    "Uncalibrated",
  );
  await expect(page.locator("[data-db-estimate-panel]")).toBeHidden();

  await page.locator("[data-db-input]").selectOption("mic-1");
  await expect(page.locator("[data-db-calibration-status]")).toContainText(
    "User-calibrated",
  );
  await expect(page.locator("[data-db-estimate]")).toHaveText("72.0 dB");
});

test("failed exact selection preserves the previous input and its calibration", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "browserAudioLab.dbCalibration.v2",
      JSON.stringify({ byDeviceId: { "mic-1": { offset: 112, createdAt: 1_000 } } }),
    );
  });
  await page.locator("[data-db-start]").click();
  await expect(page.locator("[data-db-estimate]")).toHaveText("72.0 dB");

  const select = page.locator("[data-db-input]");
  await select.selectOption("mic-fail");
  await expect(page.locator("[data-db-selection-error]")).toContainText(
    "previous microphone remains active",
  );
  await expect(select).toHaveValue("mic-1");
  await expect(page.locator("[data-db-estimate]")).toHaveText("72.0 dB");

  const state = await harnessState(page);
  expect(state.lifecycle).toContain("gum:mic-fail");
  expect(state.lifecycle).not.toContain("track-stop:mic-1");
});

test("rejects clipping during calibration and leaves the tool dBFS-only", async ({ page }) => {
  await page.locator("[data-db-start]").click();
  await setMeterMode(page, "clipping");
  await page.locator("[data-db-reference]").fill("72");
  await page.locator("[data-db-weighting-confirm]").check();
  await page.locator("[data-db-calibrate]").click();

  await expect(page.locator("[data-db-calibration-live-status]")).toHaveText(
    "Calibration rejected",
    { timeout: 4_500 },
  );
  await expect(page.locator("[data-db-calibration-status]")).toContainText("clipped");
  await expect(page.locator("[data-db-estimate-panel]")).toBeHidden();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("browserAudioLab.dbCalibration.v2"),
    ),
  ).toBeNull();
});

test("Stop cancels meter work and an in-flight calibration window", async ({ page }) => {
  await page.locator("[data-db-start]").click();
  await page.locator("[data-db-reference]").fill("72");
  await page.locator("[data-db-weighting-confirm]").check();
  await page.locator("[data-db-calibrate]").click();
  await page.waitForTimeout(350);
  await page.locator("[data-db-stop]").click();
  await expect(page.locator("#decibel-meter-status [data-status-label]")).toHaveText(
    "Stopped",
  );
  const readsAtStop = (await harnessState(page)).meterReadTimes.length;
  await page.waitForTimeout(3_100);
  expect((await harnessState(page)).meterReadTimes).toHaveLength(readsAtStop);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("browserAudioLab.dbCalibration.v2"),
    ),
  ).toBeNull();
  await expect(page.locator("[data-db-estimate-panel]")).toBeHidden();
});

test("track loss clears the estimate and BFCache restoration creates a fresh session", async ({
  page,
}) => {
  await page.locator("[data-db-start]").click();
  expect((await harnessState(page)).audioContextCount).toBe(1);

  await page.evaluate(() => {
    const endTrack = Reflect.get(window, "__dbEndActiveTrack") as () => boolean;
    endTrack();
  });
  await expect(page.locator("#decibel-meter-status [data-status-label]")).toHaveText(
    "Input device disconnected",
  );
  await expect(page.locator("[data-db-rms]")).toHaveText("—");

  await page.locator("[data-db-start]").click();
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
  });
  await expect.poll(async () => (await harnessState(page)).closedContextCount).toBe(1);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await expect(page.locator("#decibel-meter-status [data-status-label]")).toHaveText(
    "Ready",
  );
  await page.locator("[data-db-start]").click();
  expect((await harnessState(page)).audioContextCount).toBe(2);
});
