import { expect, test, type Page } from "@playwright/test";

interface PitchHarnessState {
  audioContextCount: number;
  closedContextCount: number;
  getUserMediaCalls: MediaStreamConstraints[];
  lifecycle: string[];
  activeDeviceId: string | null;
  timeDomainReadTimes: number[];
  toneHz: number;
  signalMode: "tone" | "silence";
}

async function installPitchHarness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state: PitchHarnessState = {
      audioContextCount: 0,
      closedContextCount: 0,
      getUserMediaCalls: [],
      lifecycle: [],
      activeDeviceId: null,
      timeDomainReadTimes: [],
      toneHz: 440,
      signalMode: "tone",
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
      fftSize = 2_048;
      smoothingTimeConstant = 0;
      minDecibels = -100;
      maxDecibels = -30;

      get frequencyBinCount() {
        return this.fftSize / 2;
      }
      getFloatTimeDomainData(target: Float32Array) {
        state.timeDomainReadTimes.push(performance.now());
        if (state.signalMode === "silence") {
          target.fill(0);
          return;
        }
        const sampleRate = (this.context as AudioContext).sampleRate;
        for (let index = 0; index < target.length; index += 1) {
          target[index] = Math.sin(
            (2 * Math.PI * state.toneHz * index) / sampleRate,
          );
        }
      }
      getFloatFrequencyData(target: Float32Array) {
        target.fill(-100);
      }
    }

    class FakeTrack extends EventTarget {
      readonly kind = "audio";
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
      async getUserMedia(
        constraints: MediaStreamConstraints,
      ): Promise<MediaStream> {
        state.getUserMediaCalls.push(constraints);
        const audio = constraints.audio as MediaTrackConstraints;
        const exact =
          typeof audio === "object" &&
          audio.deviceId &&
          typeof audio.deviceId === "object"
            ? String(
                (audio.deviceId as ConstrainDOMStringParameters).exact ?? "",
              )
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

    Reflect.set(window, "__pitchHarness", state);
    Reflect.set(
      window,
      "__pitchSetSignal",
      (mode: "tone" | "silence", toneHz = state.toneHz) => {
        state.signalMode = mode;
        state.toneHz = toneHz;
      },
    );
    Reflect.set(window, "__pitchEndActiveTrack", () => {
      const deviceId = state.activeDeviceId;
      if (!deviceId) return false;
      tracks.get(deviceId)?.dispatchEvent(new Event("ended"));
      mediaDevices.dispatchEvent(new Event("devicechange"));
      return true;
    });
  });
}

async function harnessState(page: Page): Promise<PitchHarnessState> {
  return page.evaluate(() =>
    structuredClone(Reflect.get(window, "__pitchHarness") as PitchHarnessState),
  );
}

async function setSignal(
  page: Page,
  mode: "tone" | "silence",
  toneHz?: number,
): Promise<void> {
  await page.evaluate(
    ({ signalMode, frequency }) => {
      const setPitchSignal = Reflect.get(window, "__pitchSetSignal") as (
        mode: "tone" | "silence",
        toneHz?: number,
      ) => void;
      setPitchSignal(signalMode, frequency);
    },
    { signalMode: mode, frequency: toneHz },
  );
}

test.beforeEach(async ({ page }) => {
  await installPitchHarness(page);
  await page.goto("/pitch-detector");
});

test("stays idle until Start, then produces a stabilized YIN A4 estimate at bounded cadence", async ({
  page,
}) => {
  expect((await harnessState(page)).audioContextCount).toBe(0);
  await expect(page.locator("[data-pitch-note]")).toHaveText("—");
  await expect(page.locator("[data-pitch-stop]")).toBeDisabled();
  await expect(page.getByRole("link", { name: "Microphone Test" })).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("link", { name: "Spectrum Analyzer" }),
  ).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Decibel Meter" })).toHaveCount(
    1,
  );

  await page.locator("[data-pitch-start]").click();
  await expect(
    page.locator("#pitch-detector-status [data-status-label]"),
  ).toHaveText("Listening for pitch");
  await expect(page.locator("[data-pitch-input] option")).toHaveCount(3);
  await expect(page.locator("[data-pitch-analysis-rate]")).toHaveText(
    "48000 Hz",
  );
  await expect(page.locator("[data-pitch-downsample]")).toHaveText("1×");
  await expect(page.locator("[data-pitch-frame-size]")).toHaveText(
    "2048 samples",
  );

  await expect(page.locator("[data-pitch-note]")).toHaveText("A4", {
    timeout: 2_000,
  });
  await expect(page.locator("[data-pitch-frequency]")).toContainText("440");
  await expect(page.locator("[data-pitch-stability]")).toHaveText("Stable", {
    timeout: 2_000,
  });
  await expect(page.locator("[data-pitch-confidence]")).not.toHaveText("—");

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
  expect(state.timeDomainReadTimes.length).toBeGreaterThanOrEqual(3);
  const deltas = state.timeDomainReadTimes
    .slice(1)
    .map((time, index) => time - (state.timeDomainReadTimes[index] ?? time));
  expect(deltas.every((delta) => delta >= 40)).toBe(true);
});

test("weak input hides the current pitch and breaks stability without a random note", async ({
  page,
}) => {
  await page.locator("[data-pitch-start]").click();
  await expect(page.locator("[data-pitch-note]")).toHaveText("A4", {
    timeout: 2_000,
  });

  await setSignal(page, "silence");
  await expect(page.locator("[data-pitch-frequency]")).toHaveText(
    "Listening…",
    {
      timeout: 2_000,
    },
  );
  await expect(page.locator("[data-pitch-note]")).toHaveText("—");
  await expect(page.locator("[data-pitch-message]")).toHaveText(
    "Signal too weak or unstable",
  );

  await setSignal(page, "tone", 660);
  await expect(page.locator("[data-pitch-note]")).toHaveText("E5", {
    timeout: 2_000,
  });
  await expect(page.locator("[data-pitch-stability]")).toHaveText("Stable", {
    timeout: 2_000,
  });
});

test("failed exact input selection preserves the previous microphone and resumes analysis", async ({
  page,
}) => {
  await page.locator("[data-pitch-start]").click();
  await expect(page.locator("[data-pitch-note]")).toHaveText("A4", {
    timeout: 2_000,
  });

  const select = page.locator("[data-pitch-input]");
  await select.selectOption("mic-fail");
  await expect(page.locator("[data-pitch-selection-error]")).toContainText(
    "previous microphone remains active",
  );
  await expect(select).toHaveValue("mic-1");
  await expect(page.locator("[data-pitch-active-input]")).toHaveText(
    "Built-in microphone",
  );
  await expect(page.locator("[data-pitch-note]")).toHaveText("A4", {
    timeout: 2_000,
  });

  const state = await harnessState(page);
  expect(state.lifecycle).toContain("gum:mic-fail");
  expect(state.lifecycle).not.toContain("track-stop:mic-1");
});

test("successful exact switch acquires the replacement before old-track teardown and clears old stabilization", async ({
  page,
}) => {
  await page.locator("[data-pitch-start]").click();
  await expect(page.locator("[data-pitch-stability]")).toHaveText("Stable", {
    timeout: 2_000,
  });

  await setSignal(page, "tone", 523.251);
  await page.locator("[data-pitch-input]").selectOption("mic-2");
  await expect(page.locator("[data-pitch-active-input]")).toHaveText(
    "USB microphone",
  );
  await expect(page.locator("[data-pitch-note]")).toHaveText("C5", {
    timeout: 2_000,
  });

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

test("Stop cancels the 20 Hz analysis loop and restart does not create a second AudioContext", async ({
  page,
}) => {
  await page.locator("[data-pitch-start]").click();
  await expect(page.locator("[data-pitch-note]")).toHaveText("A4", {
    timeout: 2_000,
  });

  await page.locator("[data-pitch-stop]").click();
  await expect(
    page.locator("#pitch-detector-status [data-status-label]"),
  ).toHaveText("Stopped");
  await expect(page.locator("[data-pitch-note]")).toHaveText("—");
  const readsAtStop = (await harnessState(page)).timeDomainReadTimes.length;
  await page.waitForTimeout(160);
  expect((await harnessState(page)).timeDomainReadTimes).toHaveLength(
    readsAtStop,
  );

  await page.locator("[data-pitch-start]").click();
  await expect(page.locator("[data-pitch-note]")).toHaveText("A4", {
    timeout: 2_000,
  });
  expect((await harnessState(page)).audioContextCount).toBe(1);
});

test("track loss clears the estimate and requires explicit restart", async ({
  page,
}) => {
  await page.locator("[data-pitch-start]").click();
  await expect(page.locator("[data-pitch-note]")).toHaveText("A4", {
    timeout: 2_000,
  });

  await page.evaluate(() => {
    const endTrack = Reflect.get(
      window,
      "__pitchEndActiveTrack",
    ) as () => boolean;
    endTrack();
  });

  await expect(
    page.locator("#pitch-detector-status [data-status-label]"),
  ).toHaveText("Input device disconnected");
  await expect(page.locator("[data-pitch-active-input]")).toHaveText(
    "Input device disconnected",
  );
  await expect(page.locator("[data-pitch-note]")).toHaveText("—");
  await expect(page.locator("[data-pitch-start]")).toBeEnabled();
});

test("BFCache restoration remounts a fresh idle detector and next Start creates a new context", async ({
  page,
}) => {
  await page.locator("[data-pitch-start]").click();
  await expect(page.locator("[data-pitch-note]")).toHaveText("A4", {
    timeout: 2_000,
  });
  expect((await harnessState(page)).audioContextCount).toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
  });
  await expect
    .poll(async () => (await harnessState(page)).closedContextCount)
    .toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });
  await expect(
    page.locator("#pitch-detector-status [data-status-label]"),
  ).toHaveText("Ready");
  await expect(page.locator("[data-pitch-note]")).toHaveText("—");

  await page.locator("[data-pitch-start]").click();
  await expect(page.locator("[data-pitch-note]")).toHaveText("A4", {
    timeout: 2_000,
  });
  expect((await harnessState(page)).audioContextCount).toBe(2);
});
