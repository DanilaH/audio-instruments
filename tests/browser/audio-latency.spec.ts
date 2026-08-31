import { expect, test, type Page } from "@playwright/test";

interface OscillatorRecord {
  readonly id: number;
  startTime: number | null;
  readonly stopTimes: number[];
}

interface LatencyHarnessState {
  audioContextCount: number;
  closedContextCount: number;
  readonly contextOptions: AudioContextOptions[];
  readonly oscillators: OscillatorRecord[];
}

interface LatencyHarnessConfig {
  readonly baseLatency?: number;
  readonly outputLatency?: number;
  readonly failCreateGain?: boolean;
}

async function installLatencyHarness(
  page: Page,
  config: LatencyHarnessConfig = {},
): Promise<void> {
  await page.addInitScript((options: LatencyHarnessConfig) => {
    const state: LatencyHarnessState = {
      audioContextCount: 0,
      closedContextCount: 0,
      contextOptions: [],
      oscillators: [],
    };
    let latestContext: FakeAudioContext | null = null;

    class FakeAudioParam {
      value = 1;

      setValueAtTime(value: number, _time: number) {
        this.value = value;
        return this;
      }

      linearRampToValueAtTime(value: number, _time: number) {
        this.value = value;
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
      readonly gain = new FakeAudioParam();
    }

    class FakeOscillatorNode extends EventTarget {
      readonly frequency = new FakeAudioParam();
      type: OscillatorType = "sine";
      readonly record: OscillatorRecord;

      constructor(readonly context: BaseAudioContext) {
        super();
        this.record = {
          id: state.oscillators.length,
          startTime: null,
          stopTimes: [],
        };
        state.oscillators.push(this.record);
      }

      connect(destination: unknown) {
        return destination;
      }

      disconnect() {}

      start(when = 0) {
        this.record.startTime = when;
      }

      stop(when = 0) {
        this.record.stopTimes.push(when);
      }
    }

    class FakeAudioContext {
      readonly baseLatency = options.baseLatency ?? 0.01254;
      readonly destination: FakeNode;
      readonly outputLatency?: number;
      readonly sampleRate = 48_000;
      state: AudioContextState = "suspended";
      runningPerfMs: number | null = null;
      elapsedBeforeSuspendSec = 0;

      constructor(contextOptions?: AudioContextOptions) {
        state.audioContextCount += 1;
        state.contextOptions.push(contextOptions ?? {});
        if (options.outputLatency !== undefined) {
          this.outputLatency = options.outputLatency;
        }
        this.destination = new FakeNode(this as unknown as BaseAudioContext);
        latestContext = this;
      }

      get currentTime(): number {
        if (this.runningPerfMs === null || this.state !== "running") {
          return this.elapsedBeforeSuspendSec;
        }
        return (
          this.elapsedBeforeSuspendSec +
          (performance.now() - this.runningPerfMs) / 1_000
        );
      }

      async resume() {
        if (this.state === "closed") {
          throw new DOMException("closed", "InvalidStateError");
        }
        if (this.state !== "running") {
          this.runningPerfMs = performance.now();
          this.state = "running";
        }
      }

      async close() {
        if (this.state === "closed") return;
        this.elapsedBeforeSuspendSec = this.currentTime;
        this.runningPerfMs = null;
        this.state = "closed";
        state.closedContextCount += 1;
      }

      createGain() {
        if (options.failCreateGain) {
          throw new DOMException("gain construction failed", "NotSupportedError");
        }
        return new FakeGainNode(
          this as unknown as BaseAudioContext,
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

    Reflect.set(window, "__latencyHarness", state);
    Reflect.set(
      window,
      "__latencyCurrentTime",
      () => latestContext?.currentTime ?? 0,
    );
  }, config);
}

async function harnessState(page: Page): Promise<LatencyHarnessState> {
  return page.evaluate(() =>
    structuredClone(
      Reflect.get(window, "__latencyHarness") as LatencyHarnessState,
    ),
  );
}

async function contextCurrentTime(page: Page): Promise<number> {
  return page.evaluate(() => {
    const currentTime = Reflect.get(window, "__latencyCurrentTime") as () => number;
    return currentTime();
  });
}

async function setOffset(page: Page, value: number): Promise<void> {
  await page.locator("[data-latency-offset]").evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function setOffsetAtContextLead(
  page: Page,
  targetContextSec: number,
  leadMs: number,
  value: number,
): Promise<number> {
  return page.evaluate(
    async ({ targetContextSec: target, leadMs: lead, value: nextValue }) => {
      const currentTime = Reflect.get(window, "__latencyCurrentTime") as () => number;
      const threshold = target - lead / 1_000;
      while (currentTime() < threshold) {
        await new Promise((resolve) => window.setTimeout(resolve, 2));
      }

      const beforeChange = currentTime();
      const input = document.querySelector<HTMLInputElement>(
        "[data-latency-offset]",
      );
      if (!input) throw new Error("Latency offset input is missing");
      input.value = String(nextValue);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return beforeChange;
    },
    { targetContextSec, leadMs, value },
  );
}

async function setDocumentHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((nextHidden) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => nextHidden,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

async function observeVisualPulses(page: Page): Promise<void> {
  await page.evaluate(() => {
    const pulse = document.querySelector<HTMLElement>("[data-latency-pulse]");
    if (!pulse) throw new Error("Latency pulse is missing");
    let count = 0;
    const observer = new MutationObserver(() => {
      if (pulse.dataset.active === "true") count += 1;
    });
    observer.observe(pulse, {
      attributes: true,
      attributeFilter: ["data-active"],
    });
    Reflect.set(window, "__latencyPulseCount", () => count);
  });
}

test("stays lazy until Start, reports browser latency in ms, and schedules the 1 Hz AV plan", async ({
  page,
}) => {
  await installLatencyHarness(page, {
    baseLatency: 0.01254,
    outputLatency: 0.03444,
  });
  await page.goto("/audio-latency-test");
  await observeVisualPulses(page);

  expect((await harnessState(page)).audioContextCount).toBe(0);
  await expect(page.locator("[data-latency-base]")).toHaveText("Start to query");
  await expect(page.locator("[data-latency-output]")).toHaveText(
    "Start to query",
  );
  await expect(page.locator("[data-latency-stop]")).toBeDisabled();
  await expect(page.getByRole("link", { name: "Sound Test" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Speaker Test" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Headphone Test" })).toHaveCount(1);

  await page.locator("[data-latency-start]").click();
  await expect(
    page.locator("#audio-latency-status [data-status-label]"),
  ).toHaveText("AV sync loop active");
  await expect(page.locator("[data-latency-base]")).toHaveText("12.5 ms");
  await expect(page.locator("[data-latency-output]")).toHaveText("34.4 ms");

  await expect
    .poll(async () => (await harnessState(page)).oscillators.length)
    .toBeGreaterThanOrEqual(2);
  const state = await harnessState(page);
  expect(state.audioContextCount).toBe(1);
  expect(state.contextOptions[0]?.latencyHint).toBe("interactive");
  const starts = state.oscillators
    .map((oscillator) => oscillator.startTime)
    .filter((time): time is number => time !== null);
  expect(starts[0]).toBeGreaterThan(0.45);
  expect(starts[0]).toBeLessThan(0.65);
  expect((starts[1] ?? 0) - (starts[0] ?? 0)).toBeCloseTo(1, 2);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const pulseCount = Reflect.get(window, "__latencyPulseCount") as () => number;
        return pulseCount();
      }),
    )
    .toBeGreaterThan(0);
});

test("reanchors on offset changes, preserves the sign convention, and cancels old scheduled clicks", async ({
  page,
}) => {
  await installLatencyHarness(page);
  await page.goto("/audio-latency-test");
  await page.locator("[data-latency-start]").click();
  await expect
    .poll(async () => (await harnessState(page)).oscillators.length)
    .toBeGreaterThanOrEqual(2);

  const beforePositiveState = await harnessState(page);
  const oldCount = beforePositiveState.oscillators.length;
  const beforePositiveTime = await contextCurrentTime(page);
  await setOffset(page, 50);
  await expect(page.locator("[data-latency-offset-value]")).toHaveText([
    "+50 ms",
    "+50 ms",
  ]);
  await expect(page.locator("[data-latency-result]")).toHaveText(
    "Your selected sync offset: +50 ms",
  );
  await expect
    .poll(async () => (await harnessState(page)).oscillators.length)
    .toBeGreaterThan(oldCount);

  const positiveState = await harnessState(page);
  const firstPositiveStart = positiveState.oscillators[oldCount]?.startTime;
  expect(firstPositiveStart).not.toBeNull();
  expect((firstPositiveStart ?? 0) - beforePositiveTime).toBeGreaterThan(0.5);
  expect((firstPositiveStart ?? 0) - beforePositiveTime).toBeLessThan(0.65);
  for (const oscillator of positiveState.oscillators.slice(0, oldCount)) {
    expect(oscillator.stopTimes.length).toBeGreaterThanOrEqual(2);
  }

  const beforeNegativeCount = positiveState.oscillators.length;
  const beforeNegativeTime = await contextCurrentTime(page);
  await setOffset(page, -50);
  await expect(page.locator("[data-latency-offset-value]")).toHaveText([
    "−50 ms",
    "−50 ms",
  ]);
  await expect
    .poll(async () => (await harnessState(page)).oscillators.length)
    .toBeGreaterThan(beforeNegativeCount);

  const negativeState = await harnessState(page);
  const firstNegativeStart = negativeState.oscillators[beforeNegativeCount]?.startTime;
  expect(firstNegativeStart).not.toBeNull();
  expect((firstNegativeStart ?? 0) - beforeNegativeTime).toBeGreaterThan(0.38);
  expect((firstNegativeStart ?? 0) - beforeNegativeTime).toBeLessThan(0.55);
});

test("cancels a not-yet-started click immediately inside the shared fade window", async ({
  page,
}) => {
  await installLatencyHarness(page);
  await page.goto("/audio-latency-test");
  await page.locator("[data-latency-start]").click();
  await expect
    .poll(async () => (await harnessState(page)).oscillators.length)
    .toBeGreaterThan(0);

  const before = await harnessState(page);
  const firstStart = before.oscillators[0]?.startTime;
  expect(firstStart).not.toBeNull();
  if (firstStart === null || firstStart === undefined) return;

  const beforeChange = await setOffsetAtContextLead(page, firstStart, 40, 50);
  expect(firstStart - beforeChange).toBeGreaterThan(0);
  expect(firstStart - beforeChange).toBeLessThan(0.05);

  const after = await harnessState(page);
  const cancellationStop = after.oscillators[0]?.stopTimes.at(-1);
  expect(cancellationStop).toBeDefined();
  expect(cancellationStop ?? Number.POSITIVE_INFINITY).toBeLessThan(firstStart);
});

test("Stop cancels timed work and a hidden tab stays idle until explicit Start", async ({
  page,
}) => {
  await installLatencyHarness(page);
  await page.goto("/audio-latency-test");
  await page.locator("[data-latency-start]").click();
  await expect
    .poll(async () => (await harnessState(page)).oscillators.length)
    .toBeGreaterThan(0);

  await page.locator("[data-latency-stop]").click();
  const stoppedCount = (await harnessState(page)).oscillators.length;
  await page.waitForTimeout(1_150);
  expect((await harnessState(page)).oscillators).toHaveLength(stoppedCount);
  await expect(page.locator("[data-latency-start]")).toBeEnabled();
  await expect(page.locator("[data-latency-stop]")).toBeDisabled();

  await page.locator("[data-latency-start]").click();
  await expect(
    page.locator("#audio-latency-status [data-status-label]"),
  ).toHaveText("AV sync loop active");
  await setDocumentHidden(page, true);
  await expect(
    page.locator("#audio-latency-status [data-status-label]"),
  ).toHaveText("Stopped while tab was hidden");
  const hiddenCount = (await harnessState(page)).oscillators.length;
  await page.waitForTimeout(1_150);
  expect((await harnessState(page)).oscillators).toHaveLength(hiddenCount);

  await setDocumentHidden(page, false);
  await expect(
    page.locator("#audio-latency-status [data-status-label]"),
  ).toHaveText("Stopped while tab was hidden");
  await expect(page.locator("[data-latency-start]")).toBeEnabled();
});

test("BFCache restoration mounts a fresh idle controller and creates a new AudioContext on next Start", async ({
  page,
}) => {
  await installLatencyHarness(page);
  await page.goto("/audio-latency-test");
  await page.locator("[data-latency-start]").click();
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
    page.locator("#audio-latency-status [data-status-label]"),
  ).toHaveText("Ready");
  await expect(page.locator("[data-latency-start]")).toBeEnabled();

  await page.locator("[data-latency-start]").click();
  await expect
    .poll(async () => (await harnessState(page)).audioContextCount)
    .toBe(2);
});

test("shows an explicit fallback when outputLatency is not reported", async ({ page }) => {
  await installLatencyHarness(page, { baseLatency: 0.008 });
  await page.goto("/audio-latency-test");
  await page.locator("[data-latency-start]").click();

  await expect(page.locator("[data-latency-base]")).toHaveText("8.0 ms");
  await expect(page.locator("[data-latency-output]")).toHaveText(
    "Not reported by this browser",
  );
});

test("cleans up a partially created session when audio output construction fails", async ({
  page,
}) => {
  await installLatencyHarness(page, { failCreateGain: true });
  await page.goto("/audio-latency-test");
  await page.locator("[data-latency-start]").click();

  await expect(
    page.locator("#audio-latency-status [data-status-label]"),
  ).toHaveText("Audio output unavailable");
  await expect(page.locator("[data-latency-error]")).toBeVisible();
  await expect
    .poll(async () => (await harnessState(page)).closedContextCount)
    .toBe(1);
  await expect(page.locator("[data-latency-start]")).toBeEnabled();
  await expect(page.locator("[data-latency-stop]")).toBeDisabled();
});
