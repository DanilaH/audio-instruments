import { expect, test, type Page } from "@playwright/test";

interface HearingOscillatorRecord {
  readonly id: number;
  frequencyHz: number | null;
  startTime: number | null;
  readonly stopTimes: number[];
}

interface HearingHarnessState {
  audioContextCount: number;
  closedContextCount: number;
  readonly contextOptions: AudioContextOptions[];
  readonly oscillators: HearingOscillatorRecord[];
  readonly masterGainValues: number[];
}

interface HearingHarnessConfig {
  readonly sampleRate?: number;
  readonly resumeDelayMs?: number;
  readonly holdResume?: boolean;
}

async function installHearingHarness(
  page: Page,
  config: HearingHarnessConfig = {},
): Promise<void> {
  await page.addInitScript((options: HearingHarnessConfig) => {
    const state: HearingHarnessState = {
      audioContextCount: 0,
      closedContextCount: 0,
      contextOptions: [],
      oscillators: [],
      masterGainValues: [],
    };
    let releaseResume: (() => void) | null = null;
    const resumeGate = options.holdResume
      ? new Promise<void>((resolve) => {
          releaseResume = resolve;
        })
      : null;

    class FakeAudioParam {
      value = 1;

      constructor(private readonly onValue?: (value: number) => void) {}

      setValueAtTime(value: number, _time: number) {
        this.value = value;
        this.onValue?.(value);
        return this;
      }

      linearRampToValueAtTime(value: number, _time: number) {
        this.value = value;
        this.onValue?.(value);
        return this;
      }

      cancelScheduledValues(_time: number) {
        return this;
      }

      cancelAndHoldAtTime(_time: number) {
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
      readonly gain: FakeAudioParam;

      constructor(
        context: BaseAudioContext,
        onValue?: (value: number) => void,
      ) {
        super(context);
        this.gain = new FakeAudioParam(onValue);
      }
    }

    class FakeOscillatorNode extends EventTarget {
      readonly frequency: FakeAudioParam;
      type: OscillatorType = "sine";
      readonly _record: HearingOscillatorRecord;

      constructor(readonly context: BaseAudioContext) {
        super();
        this._record = {
          id: state.oscillators.length,
          frequencyHz: null,
          startTime: null,
          stopTimes: [],
        };
        state.oscillators.push(this._record);
        this.frequency = new FakeAudioParam((value) => {
          this._record.frequencyHz = value;
        });
      }

      connect(destination: unknown) {
        return destination;
      }

      disconnect() {}

      start(when = 0) {
        this._record.startTime = when;
      }

      stop(when = 0) {
        this._record.stopTimes.push(when);
      }
    }

    class FakeAudioContext {
      readonly sampleRate = options.sampleRate ?? 48_000;
      readonly destination: FakeNode;
      state: AudioContextState = "suspended";
      _runningPerfMs: number | null = null;
      _elapsedBeforeSuspendSec = 0;
      _gainCount = 0;

      constructor(contextOptions?: AudioContextOptions) {
        state.audioContextCount += 1;
        state.contextOptions.push(contextOptions ?? {});
        this.destination = new FakeNode(this as unknown as BaseAudioContext);
      }

      get currentTime(): number {
        if (this._runningPerfMs === null || this.state !== "running") {
          return this._elapsedBeforeSuspendSec;
        }
        return (
          this._elapsedBeforeSuspendSec +
          (performance.now() - this._runningPerfMs) / 1_000
        );
      }

      async resume() {
        if (resumeGate) {
          await resumeGate;
        } else if (options.resumeDelayMs) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, options.resumeDelayMs),
          );
        }
        if (this.state === "closed") {
          throw new DOMException("closed", "InvalidStateError");
        }
        if (this.state !== "running") {
          this._runningPerfMs = performance.now();
          this.state = "running";
        }
      }

      async close() {
        if (this.state === "closed") return;
        this._elapsedBeforeSuspendSec = this.currentTime;
        this._runningPerfMs = null;
        this.state = "closed";
        state.closedContextCount += 1;
      }

      createGain() {
        const isMaster = this._gainCount === 0;
        this._gainCount += 1;
        return new FakeGainNode(
          this as unknown as BaseAudioContext,
          isMaster
            ? (value) => {
                state.masterGainValues.push(value);
              }
            : undefined,
        ) as unknown as GainNode;
      }

      createOscillator() {
        return new FakeOscillatorNode(
          this as unknown as BaseAudioContext,
        ) as unknown as OscillatorNode;
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
    Reflect.set(window, "__hearingHarness", state);
    Reflect.set(window, "__releaseHearingResume", () => releaseResume?.());
  }, config);
}

async function harnessState(page: Page): Promise<HearingHarnessState> {
  return page.evaluate(() =>
    structuredClone(
      Reflect.get(window, "__hearingHarness") as HearingHarnessState,
    ),
  );
}

async function selectMode(
  page: Page,
  mode: "guided" | "manual",
): Promise<void> {
  await page
    .locator("label.mode-pill")
    .filter({ hasText: mode === "guided" ? "Guided" : "Manual" })
    .click();
}

async function playSetupReference(page: Page): Promise<void> {
  await page.locator("[data-hearing-reference]").click();
  await expect(
    page.locator("#hearing-frequency-status [data-status-label]"),
  ).toHaveText("Setup reference complete", { timeout: 2_000 });
}

async function confirmListeningSetup(page: Page): Promise<void> {
  await page.locator("[data-hearing-setup-confirm]").check();
}

async function startGuided(page: Page): Promise<void> {
  await confirmListeningSetup(page);
  await page.locator("[data-hearing-guided-start]").click();
}

async function setManualLevel(page: Page, levelDb: number): Promise<void> {
  await page.locator("#hearing-manual-level").evaluate((element, value) => {
    const input = element as HTMLInputElement;
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, levelDb);
}

test("keeps high-frequency playback locked behind a fresh 1 kHz / -36 dB listening setup", async ({
  page,
}) => {
  await installHearingHarness(page);
  await page.goto("/hearing-frequency-test");

  expect((await harnessState(page)).audioContextCount).toBe(0);
  await expect(page.locator("[data-hearing-result]")).toHaveText("—");
  await expect(page.locator("[data-hearing-guided-start]")).toBeDisabled();
  await expect(page.locator("[data-hearing-stop]")).toBeDisabled();
  await expect(page.getByRole("link", { name: "Tone Generator" })).toHaveCount(
    1,
  );
  await expect(page.getByRole("link", { name: "Headphone Test" })).toHaveCount(
    1,
  );

  await selectMode(page, "manual");
  await expect(page.locator("[data-hearing-manual-play]")).toBeDisabled();
  expect((await harnessState(page)).audioContextCount).toBe(0);
  await selectMode(page, "guided");

  await playSetupReference(page);

  const state = await harnessState(page);
  expect(state.audioContextCount).toBe(1);
  expect(state.contextOptions[0]?.latencyHint).toBe("interactive");
  expect(state.oscillators).toHaveLength(1);
  expect(state.oscillators[0]?.frequencyHz).toBe(1_000);
  const start = state.oscillators[0]?.startTime ?? 0;
  const scheduledStop = state.oscillators[0]?.stopTimes[0] ?? 0;
  expect(scheduledStop - start).toBeCloseTo(1, 5);

  const guidedGain = 10 ** (-36 / 20);
  expect(
    state.masterGainValues.some((value) => Math.abs(value - guidedGain) < 1e-6),
  ).toBe(true);
  await expect(page.locator("[data-hearing-setup-confirm]")).toBeEnabled();

  await confirmListeningSetup(page);
  await expect(page.locator("[data-hearing-guided-start]")).toBeEnabled();

  await page.locator("[data-hearing-reference]").click();
  await expect(page.locator("[data-hearing-setup-confirm]")).not.toBeChecked();
  await expect(page.locator("[data-hearing-setup-confirm]")).toBeDisabled();
  await expect(page.locator("[data-hearing-guided-start]")).toBeDisabled();

  await expect(
    page.locator("#hearing-frequency-status [data-status-label]"),
  ).toHaveText("Setup reference complete", { timeout: 2_000 });
  await expect(page.locator("[data-hearing-setup-status]")).toContainText(
    "Reference complete",
  );
  await expect(page.locator("[data-hearing-setup-confirm]")).toBeEnabled();
  await expect(page.locator("[data-hearing-setup-confirm]")).not.toBeChecked();
  await expect(page.locator("[data-hearing-guided-start]")).toBeDisabled();
});

test("Guided mode records only explicit heard answers and continues after a not-heard answer", async ({
  page,
}) => {
  await installHearingHarness(page, { sampleRate: 18_000 });
  await page.goto("/hearing-frequency-test");
  await playSetupReference(page);
  await startGuided(page);

  const expected = [
    { frequency: "2 kHz", heard: true },
    { frequency: "4 kHz", heard: false },
    { frequency: "6 kHz", heard: true },
    { frequency: "8 kHz", heard: false },
  ] as const;

  for (const step of expected) {
    await expect(page.locator("[data-hearing-current-frequency]")).toHaveText(
      step.frequency,
    );
    await expect(page.locator("[data-hearing-answer-panel]")).toBeVisible({
      timeout: 1_500,
    });
    await page
      .locator(step.heard ? "[data-hearing-heard]" : "[data-hearing-not-heard]")
      .click();
  }

  await expect(
    page.locator("#hearing-frequency-status [data-status-label]"),
  ).toHaveText("Guided session complete");
  await expect(page.locator("[data-hearing-result]")).toHaveText("6 kHz");
  await expect(page.locator("[data-hearing-progress]")).toHaveText("Complete");

  const frequencies = (await harnessState(page)).oscillators.map(
    (oscillator) => oscillator.frequencyHz,
  );
  expect(frequencies).toEqual([1_000, 2_000, 4_000, 6_000, 8_000]);
});

test("capability filtering removes unavailable Guided and Manual frequencies without creating hearing results", async ({
  page,
}) => {
  await installHearingHarness(page, { sampleRate: 32_000 });
  await page.goto("/hearing-frequency-test");
  await playSetupReference(page);

  await expect(page.locator("#hearing-frequency-cap")).toBeVisible();
  await expect(page.locator("#hearing-frequency-cap")).toContainText(
    "15.2 kHz",
  );
  await expect(page.locator("[data-hearing-result]")).toHaveText("—");

  await selectMode(page, "manual");
  await expect(page.locator("[data-hearing-manual-play]")).toBeDisabled();
  const unavailableOptions = page.locator(
    "[data-hearing-manual-frequency] option[disabled]",
  );
  await expect(unavailableOptions).toHaveCount(3);
  await expect(unavailableOptions.nth(0)).toHaveAttribute("value", "16000");
  await expect(unavailableOptions.nth(1)).toHaveAttribute("value", "18000");
  await expect(unavailableOptions.nth(2)).toHaveAttribute("value", "20000");

  await confirmListeningSetup(page);
  await expect(page.locator("[data-hearing-manual-play]")).toBeEnabled();
});

test("does not schedule a tone when even the 1 kHz setup reference is above the session capability", async ({
  page,
}) => {
  await installHearingHarness(page, { sampleRate: 2_000 });
  await page.goto("/hearing-frequency-test");
  await page.locator("[data-hearing-reference]").click();

  await expect(page.locator("#hearing-frequency-cap")).toContainText(
    "cannot safely generate the required 1 kHz setup reference",
  );
  await expect(page.locator("[data-hearing-reference]")).toBeDisabled();
  await expect(page.locator("[data-hearing-guided-start]")).toBeDisabled();
  await expect(page.locator("[data-hearing-result]")).toHaveText("—");
  expect((await harnessState(page)).oscillators).toHaveLength(0);

  await selectMode(page, "manual");
  await expect(page.locator("[data-hearing-manual-play]")).toBeDisabled();
});

test("Manual mode uses finite 800 ms tones and never changes the Guided session result", async ({
  page,
}) => {
  await installHearingHarness(page, { sampleRate: 5_000 });
  await page.goto("/hearing-frequency-test");
  await playSetupReference(page);
  await startGuided(page);

  await expect(page.locator("[data-hearing-answer-panel]")).toBeVisible({
    timeout: 1_500,
  });
  await page.locator("[data-hearing-heard]").click();
  await expect(
    page.locator("#hearing-frequency-status [data-status-label]"),
  ).toHaveText("Guided session complete");
  await expect(page.locator("[data-hearing-result]")).toHaveText("2 kHz");

  await selectMode(page, "manual");
  await setManualLevel(page, -24);
  await page.locator("[data-hearing-manual-play]").click();
  await expect(
    page.locator("#hearing-frequency-status [data-status-label]"),
  ).toHaveText("Manual tone complete", { timeout: 1_500 });
  await expect(page.locator("[data-hearing-result]")).toHaveText("2 kHz");
  await expect(page.locator("[data-hearing-manual-status]")).toContainText(
    "Manual observations do not change the Guided result",
  );

  const state = await harnessState(page);
  const manualOscillator = state.oscillators.at(-1);
  const manualStart = manualOscillator?.startTime ?? 0;
  const manualStop = manualOscillator?.stopTimes[0] ?? 0;
  expect(manualStop - manualStart).toBeCloseTo(0.8, 5);
  expect(manualOscillator?.frequencyHz).toBe(2_000);
  const manualGain = 10 ** (-24 / 20);
  expect(
    state.masterGainValues.some((value) => Math.abs(value - manualGain) < 1e-6),
  ).toBe(true);
});

test("Stop cancels tone preparation atomically before duplicate audio can start", async ({
  page,
}) => {
  await installHearingHarness(page, { holdResume: true });
  await page.goto("/hearing-frequency-test");

  await page.locator("[data-hearing-reference]").click();
  await expect(page.locator("[data-hearing-stop]")).toBeEnabled();
  await page.locator("[data-hearing-stop]").click();
  await expect(
    page.locator("#hearing-frequency-status [data-status-label]"),
  ).toHaveText("Stopped");
  await page.evaluate(() => {
    const release = Reflect.get(window, "__releaseHearingResume") as () => void;
    release();
  });
  await expect
    .poll(async () => (await harnessState(page)).closedContextCount)
    .toBe(1);

  const state = await harnessState(page);
  expect(state.oscillators).toHaveLength(0);
  await expect(page.locator("[data-hearing-reference]")).toBeEnabled();
});

test("hidden-tab Stop and BFCache restoration leave a fresh idle session", async ({
  page,
}) => {
  await installHearingHarness(page);
  await page.goto("/hearing-frequency-test");
  await page.locator("[data-hearing-reference]").click();
  await expect(
    page.locator("#hearing-frequency-status [data-status-label]"),
  ).toContainText("Playing");

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.locator("#hearing-frequency-status [data-status-label]"),
  ).toHaveText("Stopped while tab was hidden");

  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
  });
  await expect
    .poll(async () => (await harnessState(page)).closedContextCount)
    .toBe(1);

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });
  await expect(
    page.locator("#hearing-frequency-status [data-status-label]"),
  ).toHaveText("Ready");
  await expect(page.locator("[data-hearing-result]")).toHaveText("—");

  await page.locator("[data-hearing-reference]").click();
  await expect
    .poll(async () => (await harnessState(page)).audioContextCount)
    .toBe(2);
});
