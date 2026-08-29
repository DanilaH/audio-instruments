import { expect, test, type Page } from "@playwright/test";

type ProbeOptions = {
  maxChannelCount: number;
  throwSix?: boolean;
  mismatchSix?: boolean;
  throwEight?: boolean;
  mismatchEight?: boolean;
  failRestoreAfterTarget?: boolean;
};

type OscillatorRecord = {
  contextId: number;
  frequency: number;
  starts: number[];
  stops: number[];
};

type ConnectionRecord = {
  contextId: number;
  from: string;
  to: string;
  output: number;
  input: number;
};

async function installSurroundProbe(page: Page, options: ProbeOptions): Promise<void> {
  await page.addInitScript((probeOptions) => {
    type ParamEvent = {
      kind: "hold" | "cancel" | "set" | "linear";
      value?: number;
      time: number;
    };
    type ProbeOscillator = {
      contextId: number;
      frequency: number;
      starts: number[];
      stops: number[];
    };
    type ProbeConnection = {
      contextId: number;
      from: string;
      to: string;
      output: number;
      input: number;
    };

    const oscillators: ProbeOscillator[] = [];
    const connections: ProbeConnection[] = [];
    const destinationWrites: string[][] = [];
    const mergers: Array<{ contextId: number; inputs: number }> = [];
    const panEvents: ParamEvent[][] = [];

    Reflect.set(window, "__surroundOscillators", oscillators);
    Reflect.set(window, "__surroundConnections", connections);
    Reflect.set(window, "__surroundDestinationWrites", destinationWrites);
    Reflect.set(window, "__surroundMergers", mergers);
    Reflect.set(window, "__surroundPanEvents", panEvents);
    Reflect.set(window, "__surroundContextCount", 0);
    Reflect.set(window, "__surroundClosedContextCount", 0);

    const increment = (key: string) => {
      const next = Number(Reflect.get(window, key) ?? 0) + 1;
      Reflect.set(window, key, next);
      return next;
    };

    class FakeAudioParam {
      value = 0;
      readonly events: ParamEvent[];
      readonly onSet: ((value: number) => void) | undefined;

      constructor(events: ParamEvent[] = [], onSet?: (value: number) => void) {
        this.events = events;
        this.onSet = onSet;
      }

      cancelAndHoldAtTime(time: number) {
        this.events.push({ kind: "hold", time });
        return this;
      }
      cancelScheduledValues(time: number) {
        this.events.push({ kind: "cancel", time });
        return this;
      }
      setValueAtTime(value: number, time: number) {
        this.value = value;
        this.onSet?.(value);
        this.events.push({ kind: "set", value, time });
        return this;
      }
      linearRampToValueAtTime(value: number, time: number) {
        this.value = value;
        this.events.push({ kind: "linear", value, time });
        return this;
      }
    }

    class FakeNode {
      readonly contextId: number;
      readonly kind: string;

      constructor(contextId: number, kind: string) {
        this.contextId = contextId;
        this.kind = kind;
      }

      connect(destination: unknown, output = 0, input = 0) {
        const target = destination as FakeNode;
        connections.push({
          contextId: this.contextId,
          from: this.kind,
          to: target.kind,
          output,
          input,
        });
        return destination;
      }
      disconnect() {}
    }

    class FakeGainNode extends FakeNode {
      readonly gain = new FakeAudioParam();
    }

    class FakeStereoPannerNode extends FakeNode {
      readonly pan: FakeAudioParam;

      constructor(contextId: number, kind: string) {
        super(contextId, kind);
        const events: ParamEvent[] = [];
        panEvents.push(events);
        this.pan = new FakeAudioParam(events);
      }
    }

    class FakeOscillatorNode extends FakeNode {
      readonly frequency: FakeAudioParam;
      type: OscillatorType = "sine";
      readonly record: ProbeOscillator;

      constructor(contextId: number, index: number) {
        super(contextId, `oscillator-${index}`);
        this.record = {
          contextId,
          frequency: 0,
          starts: [],
          stops: [],
        };
        oscillators.push(this.record);
        this.frequency = new FakeAudioParam([], (value) => {
          this.record.frequency = value;
        });
      }

      start(time = 0) {
        this.record.starts.push(time);
      }
      stop(time = 0) {
        this.record.stops.push(time);
      }
      addEventListener() {}
    }

    class FakeDestinationNode extends FakeNode {
      readonly maxChannelCount = probeOptions.maxChannelCount;
      readonly writes: string[];
      #channelCount = 2;
      #channelCountMode: ChannelCountMode = "max";
      #channelInterpretation: ChannelInterpretation = "speakers";
      #targetApplied = false;

      constructor(contextId: number) {
        super(contextId, "destination");
        this.writes = [];
        destinationWrites.push(this.writes);
      }

      get channelCount() {
        return this.#channelCount;
      }
      set channelCount(value: number) {
        this.writes.push(`count:${value}`);
        if (value === 6 && probeOptions.throwSix) throw new Error("5.1 rejected");
        if (value === 8 && probeOptions.throwEight) throw new Error("8-channel rejected");
        if (
          probeOptions.failRestoreAfterTarget &&
          this.#targetApplied &&
          value === 2
        ) {
          throw new Error("restore rejected");
        }
        this.#channelCount =
          value === 6 && probeOptions.mismatchSix
            ? 5
            : value === 8 && probeOptions.mismatchEight
              ? 7
              : value;
        if (value >= 6) this.#targetApplied = true;
      }

      get channelCountMode() {
        return this.#channelCountMode;
      }
      set channelCountMode(value: ChannelCountMode) {
        this.writes.push(`mode:${value}`);
        if (
          probeOptions.failRestoreAfterTarget &&
          this.#targetApplied &&
          value === "max"
        ) {
          throw new Error("restore rejected");
        }
        this.#channelCountMode = value;
      }

      get channelInterpretation() {
        return this.#channelInterpretation;
      }
      set channelInterpretation(value: ChannelInterpretation) {
        this.writes.push(`interpretation:${value}`);
        this.#channelInterpretation = value;
      }
    }

    class FakeAudioContext {
      currentTime = 10;
      sampleRate = 48_000;
      state = "suspended";
      readonly contextId: number;
      readonly destination: FakeDestinationNode;
      #gainIndex = 0;
      #oscillatorIndex = 0;
      #pannerIndex = 0;

      constructor() {
        this.contextId = increment("__surroundContextCount");
        this.destination = new FakeDestinationNode(this.contextId);
      }

      async resume() {
        this.state = "running";
      }
      async close() {
        this.state = "closed";
        increment("__surroundClosedContextCount");
      }
      createGain() {
        const node = new FakeGainNode(this.contextId, `gain-${this.#gainIndex}`);
        this.#gainIndex += 1;
        return node;
      }
      createOscillator() {
        const node = new FakeOscillatorNode(
          this.contextId,
          this.#oscillatorIndex,
        );
        this.#oscillatorIndex += 1;
        return node;
      }
      createChannelMerger(numberOfInputs = 2) {
        mergers.push({ contextId: this.contextId, inputs: numberOfInputs });
        return new FakeNode(this.contextId, `merger-${numberOfInputs}`);
      }
      createStereoPanner() {
        const node = new FakeStereoPannerNode(
          this.contextId,
          `panner-${this.#pannerIndex}`,
        );
        this.#pannerIndex += 1;
        return node;
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: FakeAudioContext,
    });
  }, options);
}

async function readProbe<T>(page: Page, key: string): Promise<T> {
  return page.evaluate(
    (property) => structuredClone(Reflect.get(window, property)),
    key,
  ) as Promise<T>;
}

async function readCount(page: Page, key: string): Promise<number> {
  return page.evaluate(
    (property) => Number(Reflect.get(window, property) ?? 0),
    key,
  );
}

test("Surround starts idle, safe and without creating an AudioContext", async ({ page }) => {
  await installSurroundProbe(page, { maxChannelCount: 8 });
  await page.goto("/surround-sound-test");

  await expect(page.getByRole("heading", { name: "Surround Sound Test", level: 1 })).toBeVisible();
  await expect(page.locator("#surround-status")).toContainText("Capability not checked");
  await expect(page.getByText("Start with your device/headphone volume low.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check surround support" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop" })).toBeDisabled();
  expect(await readCount(page, "__surroundContextCount")).toBe(0);
});

test("unsupported multichannel exposes only the truthful Stereo spatial preview", async ({ page }) => {
  await installSurroundProbe(page, { maxChannelCount: 2 });
  await page.goto("/surround-sound-test");
  await page.getByRole("button", { name: "Check surround support" }).click();

  await expect(page.locator("#surround-status")).toContainText("Stereo spatial preview ready");
  await expect(page.getByRole("button", { name: "Stereo spatial preview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Left", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Center", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Right", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Front Left" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Channel 1" })).toBeHidden();
  await expect(page.locator(".surround-map--five-one")).toBeHidden();
  await expect(page.locator(".surround-map--eight")).toBeHidden();

  const writes = await readProbe<string[][]>(page, "__surroundDestinationWrites");
  expect(writes[0]).toEqual([]);
});

test("5.1 requires exact readback; a mismatch falls back without surround controls", async ({ page }) => {
  await installSurroundProbe(page, { maxChannelCount: 6, mismatchSix: true });
  await page.goto("/surround-sound-test");
  await page.getByRole("button", { name: "Check surround support" }).click();

  await expect(page.locator("[data-surround-capability]")).toContainText(
    "5.1 candidate was rejected or did not read back exactly.",
  );
  await expect(page.getByRole("button", { name: "Front Left" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Stereo spatial preview" })).toBeVisible();
});

test("confirmed 5.1 schedules canonical FL, FR, Center, LFE, SL, SR bursts with 700 ms / 300 ms timing", async ({ page }) => {
  await installSurroundProbe(page, { maxChannelCount: 6 });
  await page.goto("/surround-sound-test");
  await page.getByRole("button", { name: "Check surround support" }).click();

  await expect(page.locator("#surround-status")).toContainText("5.1 ready");
  await expect(page.getByRole("button", { name: "Front Left" })).toBeVisible();
  await expect(page.locator(".surround-map--five-one")).toBeVisible();
  await expect(page.locator(".surround-map--stereo")).toBeHidden();

  await page.getByRole("button", { name: "Test all 5.1 channels" }).click();
  const oscillators = await readProbe<OscillatorRecord[]>(page, "__surroundOscillators");

  expect(oscillators.map(({ frequency }) => frequency)).toEqual([
    500, 500, 500, 80, 500, 500,
  ]);
  expect(oscillators.map(({ starts }) => starts[0])).toEqual([10, 11, 12, 13, 14, 15]);
  expect(oscillators.map(({ stops }) => stops[0])).toEqual([
    10.7, 11.7, 12.7, 13.7, 14.7, 15.7,
  ]);

  const connections = await readProbe<ConnectionRecord[]>(page, "__surroundConnections");
  expect(
    connections
      .filter(({ to, from }) => to === "merger-6" && from.startsWith("gain-"))
      .map(({ input }) => input),
  ).toEqual([0, 1, 2, 3, 4, 5]);
});

test("Stop cancels already-scheduled future multichannel bursts with the shared stop ramp", async ({ page }) => {
  await installSurroundProbe(page, { maxChannelCount: 6 });
  await page.goto("/surround-sound-test");
  await page.getByRole("button", { name: "Check surround support" }).click();
  await page.getByRole("button", { name: "Test all 5.1 channels" }).click();
  await page.getByRole("button", { name: "Stop" }).click();

  const oscillators = await readProbe<OscillatorRecord[]>(page, "__surroundOscillators");
  expect(oscillators).toHaveLength(6);
  for (const oscillator of oscillators) {
    expect(oscillator.stops.at(-1)).toBeCloseTo(10.05, 10);
  }
  await expect(page.getByRole("button", { name: "Stop" })).toBeDisabled();
});

test("experimental 8-channel is only a candidate after the initial check and is confirmed on explicit selection", async ({ page }) => {
  await installSurroundProbe(page, { maxChannelCount: 8 });
  await page.goto("/surround-sound-test");
  await page.getByRole("button", { name: "Check surround support" }).click();

  await expect(page.getByRole("button", { name: "Try Experimental 8-channel" })).toBeVisible();
  let writes = await readProbe<string[][]>(page, "__surroundDestinationWrites");
  expect(writes[0]).not.toContain("count:8");
  await expect(page.locator(".surround-map--eight")).toBeHidden();

  await page.getByRole("button", { name: "Try Experimental 8-channel" }).click();
  await expect(page.locator("#surround-status")).toContainText("Experimental 8-channel ready");
  await expect(page.getByRole("button", { name: "Channel 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Channel 8" })).toBeVisible();
  await expect(page.locator(".surround-map--eight")).toBeVisible();
  await expect(page.locator(".surround-map--five-one")).toBeHidden();

  writes = await readProbe<string[][]>(page, "__surroundDestinationWrites");
  expect(writes[0]).toContain("count:8");
  expect(writes[0]).toContain("interpretation:discrete");
});

test("experimental 8-channel Test All uses raw Channel 1 to Channel 8 in canonical timing", async ({ page }) => {
  await installSurroundProbe(page, { maxChannelCount: 8 });
  await page.goto("/surround-sound-test");
  await page.getByRole("button", { name: "Check surround support" }).click();
  await page.getByRole("button", { name: "Try Experimental 8-channel" }).click();
  await page.getByRole("button", { name: "Test all 8 channels" }).click();

  const oscillators = await readProbe<OscillatorRecord[]>(page, "__surroundOscillators");
  expect(oscillators.map(({ frequency }) => frequency)).toEqual(
    Array.from({ length: 8 }, () => 500),
  );
  expect(oscillators.map(({ starts }) => starts[0])).toEqual([
    10, 11, 12, 13, 14, 15, 16, 17,
  ]);
  expect(oscillators.map(({ stops }) => stops[0])).toEqual([
    10.7, 11.7, 12.7, 13.7, 14.7, 15.7, 16.7, 17.7,
  ]);
});

test("Stereo spatial preview reuses ordinary stereo Center routing and pan primitives", async ({ page }) => {
  await installSurroundProbe(page, { maxChannelCount: 2 });
  await page.goto("/surround-sound-test");
  await page.getByRole("button", { name: "Check surround support" }).click();
  await page.getByRole("button", { name: "Center", exact: true }).click();

  let oscillators = await readProbe<OscillatorRecord[]>(page, "__surroundOscillators");
  expect(oscillators[0]).toMatchObject({ frequency: 500, starts: [10], stops: [10.7] });
  const mergers = await readProbe<Array<{ contextId: number; inputs: number }>>(
    page,
    "__surroundMergers",
  );
  expect(mergers.at(-1)?.inputs).toBe(2);

  await page.waitForTimeout(750);
  await page.getByRole("button", { name: "L → R" }).click();
  const panEvents = await readProbe<Array<Array<{ kind: string; value?: number; time: number }>>>(
    page,
    "__surroundPanEvents",
  );
  expect(panEvents.at(-1)).toContainEqual({ kind: "linear", value: 1, time: 14 });
  oscillators = await readProbe<OscillatorRecord[]>(page, "__surroundOscillators");
  expect(oscillators.at(-1)).toMatchObject({ frequency: 500, starts: [10], stops: [14] });
});

test("failed destination restoration closes the uncertain session before fresh stereo playback", async ({ page }) => {
  await installSurroundProbe(page, {
    maxChannelCount: 6,
    failRestoreAfterTarget: true,
  });
  await page.goto("/surround-sound-test");
  await page.getByRole("button", { name: "Check surround support" }).click();
  await expect(page.locator("#surround-status")).toContainText("5.1 ready");

  await page.getByRole("button", { name: "Stereo spatial preview" }).click();
  await expect(page.locator("#surround-status")).toContainText("Stereo spatial preview ready");
  await expect(page.getByRole("button", { name: "Check surround support" })).toBeEnabled();
  await expect(page.locator("[data-surround-mode-selector]")).toBeHidden();
  expect(await readCount(page, "__surroundClosedContextCount")).toBe(1);
  expect(await readCount(page, "__surroundContextCount")).toBe(1);

  const capabilityCheck = page.getByRole("button", { name: "Check surround support" });
  await page.getByRole("button", { name: "Left", exact: true }).click();
  expect(await readCount(page, "__surroundContextCount")).toBe(2);
  await expect(capabilityCheck).toBeDisabled();
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(capabilityCheck).toBeEnabled();
});

test("pagehide disposal and BFCache pageshow mount a fresh idle controller without stale 5.1 capability", async ({ page }) => {
  await installSurroundProbe(page, { maxChannelCount: 6 });
  await page.goto("/surround-sound-test");
  await page.getByRole("button", { name: "Check surround support" }).click();
  await expect(page.locator("#surround-status")).toContainText("5.1 ready");
  expect(await readCount(page, "__surroundContextCount")).toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
  });
  await expect.poll(() => readCount(page, "__surroundClosedContextCount")).toBe(1);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });

  await expect(page.locator("#surround-status")).toContainText("Capability not checked");
  await expect(page.locator("[data-surround-mode-selector]")).toBeHidden();
  await expect(page.getByRole("button", { name: "Check surround support" })).toBeEnabled();
  expect(await readCount(page, "__surroundContextCount")).toBe(1);

  await page.getByRole("button", { name: "Check surround support" }).click();
  expect(await readCount(page, "__surroundContextCount")).toBe(2);
});
