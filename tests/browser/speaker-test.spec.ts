import { expect, test, type Page } from "@playwright/test";

type ProbeOptions = {
  sampleRate?: number;
};

async function installAudioProbe(page: Page, options: ProbeOptions = {}): Promise<void> {
  await page.addInitScript(
    ({ configuredSampleRate }) => {
      type ParamEvent = {
        kind: "hold" | "cancel" | "set" | "linear" | "exponential";
        value?: number;
        time: number;
      };
      type OscillatorRecord = {
        frequency: number;
        frequencyEvents: ParamEvent[];
        starts: number[];
        stops: number[];
      };
      type BufferSourceRecord = {
        starts: Array<{ time: number; offset: number }>;
        stops: number[];
        loop: boolean;
        bufferLength: number;
        bufferSampleRate: number;
      };

      const gainEvents: ParamEvent[][] = [];
      const oscillators: OscillatorRecord[] = [];
      const sources: BufferSourceRecord[] = [];
      Reflect.set(window, "__speakerProbeGains", gainEvents);
      Reflect.set(window, "__speakerProbeOscillators", oscillators);
      Reflect.set(window, "__speakerProbeSources", sources);
      Reflect.set(window, "__speakerContextCount", 0);
      Reflect.set(window, "__speakerClosedContextCount", 0);
      Reflect.set(window, "__speakerProbeInstalled", true);

      const increment = (key: string) => {
        Reflect.set(window, key, Number(Reflect.get(window, key) ?? 0) + 1);
      };

      class FakeAudioParam {
        value = 0;
        readonly events: ParamEvent[];
        readonly onSet: ((value: number) => void) | undefined;

        constructor(events: ParamEvent[], onSet?: (value: number) => void) {
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

        exponentialRampToValueAtTime(value: number, time: number) {
          this.value = value;
          this.events.push({ kind: "exponential", value, time });
          return this;
        }
      }

      class FakeNode {
        connect(destination: unknown, output = 0, input = 0) {
          void output;
          void input;
          return destination;
        }

        disconnect() {}
      }

      class FakeGainNode extends FakeNode {
        readonly gain: FakeAudioParam;

        constructor() {
          super();
          const events: ParamEvent[] = [];
          gainEvents.push(events);
          this.gain = new FakeAudioParam(events);
        }
      }

      class FakeOscillatorNode extends FakeNode {
        readonly frequency: FakeAudioParam;
        type: OscillatorType = "sine";
        readonly record: OscillatorRecord;

        constructor() {
          super();
          const frequencyEvents: ParamEvent[] = [];
          this.record = { frequency: 0, frequencyEvents, starts: [], stops: [] };
          oscillators.push(this.record);
          this.frequency = new FakeAudioParam(frequencyEvents, (value) => {
            this.record.frequency = value;
          });
        }

        start(time = 0) {
          this.record.starts.push(time);
        }

        stop(time = 0) {
          this.record.stops.push(time);
        }

        addEventListener(
          type: string,
          listener: EventListenerOrEventListenerObject,
          eventOptions?: boolean | AddEventListenerOptions,
        ) {
          void type;
          void listener;
          void eventOptions;
        }
      }

      class FakeBufferSourceNode extends FakeNode {
        loop = false;
        bufferValue: { length: number; sampleRate: number } | null = null;
        readonly record: BufferSourceRecord;

        constructor() {
          super();
          this.record = {
            starts: [],
            stops: [],
            loop: false,
            bufferLength: 0,
            bufferSampleRate: 0,
          };
          sources.push(this.record);
        }

        set buffer(value: { length: number; sampleRate: number } | null) {
          this.bufferValue = value;
          this.record.bufferLength = value?.length ?? 0;
          this.record.bufferSampleRate = value?.sampleRate ?? 0;
        }

        get buffer() {
          return this.bufferValue;
        }

        start(time = 0, offset = 0) {
          this.record.loop = this.loop;
          this.record.starts.push({ time, offset });
        }

        stop(time = 0) {
          this.record.stops.push(time);
        }

        addEventListener(
          type: string,
          listener: EventListenerOrEventListenerObject,
          eventOptions?: boolean | AddEventListenerOptions,
        ) {
          void type;
          void listener;
          void eventOptions;
        }
      }

      class FakeAudioBuffer {
        readonly numberOfChannels: number;
        readonly length: number;
        readonly sampleRate: number;
        readonly channels: Float32Array[];

        constructor(numberOfChannels: number, length: number, sampleRate: number) {
          this.numberOfChannels = numberOfChannels;
          this.length = length;
          this.sampleRate = sampleRate;
          this.channels = Array.from(
            { length: numberOfChannels },
            () => new Float32Array(length),
          );
        }

        getChannelData(channel: number) {
          const data = this.channels[channel];
          if (!data) throw new RangeError("Invalid channel");
          return data;
        }
      }

      class FakeAudioContext {
        currentTime = 10;
        sampleRate = configuredSampleRate;
        state = "suspended";
        destination = new FakeNode();

        constructor() {
          increment("__speakerContextCount");
        }

        async resume() {
          this.state = "running";
        }

        async close() {
          this.state = "closed";
          increment("__speakerClosedContextCount");
        }

        createGain() {
          return new FakeGainNode();
        }

        createOscillator() {
          return new FakeOscillatorNode();
        }

        createBufferSource() {
          return new FakeBufferSourceNode();
        }

        createChannelMerger(numberOfInputs = 2) {
          void numberOfInputs;
          return new FakeNode();
        }

        createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
          return new FakeAudioBuffer(numberOfChannels, length, sampleRate);
        }
      }

      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        writable: true,
        value: FakeAudioContext,
      });
    },
    { configuredSampleRate: options.sampleRate ?? 48_000 },
  );
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

test("Speaker Test exposes four safe modes with a lazy AudioContext", async ({ page }) => {
  await installAudioProbe(page);
  await page.goto("/speaker-test");

  expect(await page.evaluate(() => Reflect.get(window, "__speakerProbeInstalled"))).toBe(true);
  await expect(page.getByRole("heading", { name: "Speaker Test", level: 1 })).toBeVisible();
  await expect(page.locator("#speaker-status")).toContainText("Ready");
  await expect(page.getByText("Start with your device/headphone volume low.")).toBeVisible();
  for (const name of ["Channel", "Phase", "Sweep", "Bass / rattle"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Stop" })).toBeDisabled();
  expect(await readCount(page, "__speakerContextCount")).toBe(0);
});

test("Speaker channel sequence uses three exact hard-routed reference bursts", async ({ page }) => {
  await installAudioProbe(page);
  await page.goto("/speaker-test");

  await page.getByRole("button", { name: "Run Left → Both → Right" }).click();
  await expect(page.locator("#speaker-status")).toContainText("Channel sequence running");

  const oscillators = await readProbe<
    Array<{ frequency: number; starts: number[]; stops: number[] }>
  >(page, "__speakerProbeOscillators");
  const gains = await readProbe<Array<Array<{ kind: string; value?: number; time: number }>>>(
    page,
    "__speakerProbeGains",
  );

  expect(oscillators).toHaveLength(3);
  expect(oscillators.map((item) => item.frequency)).toEqual([500, 500, 500]);
  expect(oscillators.map((item) => item.starts[0])).toEqual([10, 11, 12]);
  expect(oscillators.map((item) => item.stops[0])).toEqual([10.7, 11.7, 12.7]);
  expect(gains[2]?.at(-1)).toMatchObject({ kind: "set", value: 1 });
  expect(gains[3]?.at(-1)).toMatchObject({ kind: "set", value: 0 });
  expect(gains[5]?.at(-1)).toMatchObject({ kind: "set", value: 1 });
  expect(gains[6]?.at(-1)).toMatchObject({ kind: "set", value: 1 });
  expect(gains[8]?.at(-1)).toMatchObject({ kind: "set", value: 0 });
  expect(gains[9]?.at(-1)).toMatchObject({ kind: "set", value: 1 });
  await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();
});

test("Speaker Phase mode keeps one correlated source across In phase, Inverted and A/B", async ({
  page,
}) => {
  await installAudioProbe(page);
  await page.goto("/speaker-test");

  await page.getByRole("button", { name: "Phase", exact: true }).click();
  await page.getByRole("button", { name: "In phase" }).click();
  await expect(page.locator("#speaker-status")).toContainText("Playing in phase");
  await page.getByRole("button", { name: "Inverted" }).click();
  await expect(page.locator("#speaker-status")).toContainText("Playing inverted");
  await page.getByRole("button", { name: "A/B toggle" }).click();
  await expect(page.locator("#speaker-status")).toContainText("Playing in phase");

  const sources = await readProbe<
    Array<{
      starts: Array<{ time: number; offset: number }>;
      loop: boolean;
      bufferLength: number;
      bufferSampleRate: number;
    }>
  >(page, "__speakerProbeSources");
  expect(sources).toHaveLength(1);
  expect(sources[0]).toMatchObject({
    starts: [{ time: 10, offset: 0 }],
    loop: true,
    bufferLength: 176_400,
    bufferSampleRate: 44_100,
  });

  const gains = await readProbe<Array<Array<{ kind: string; value?: number; time: number }>>>(
    page,
    "__speakerProbeGains",
  );
  const rightEvents = gains[3] ?? [];
  expect(rightEvents).toContainEqual({ kind: "linear", value: 0, time: 10.025 });
  expect(rightEvents).toContainEqual({ kind: "linear", value: -1, time: 10.05 });
  expect(sources[0]?.starts).toHaveLength(1);
});

test("Speaker Sweep uses the shared ten-second logarithmic scheduler", async ({ page }) => {
  await installAudioProbe(page);
  await page.goto("/speaker-test");

  await page.getByRole("button", { name: "Sweep", exact: true }).click();
  await page.getByRole("button", { name: "Run speaker sweep" }).click();
  await expect(page.locator("#speaker-status")).toContainText("Speaker sweep running");

  const oscillators = await readProbe<
    Array<{
      frequency: number;
      frequencyEvents: Array<{ kind: string; value?: number; time: number }>;
      starts: number[];
      stops: number[];
    }>
  >(page, "__speakerProbeOscillators");
  expect(oscillators).toHaveLength(1);
  expect(oscillators[0]).toMatchObject({ frequency: 100, starts: [10], stops: [20] });
  expect(oscillators[0]?.frequencyEvents).toContainEqual({
    kind: "exponential",
    value: 10_000,
    time: 20,
  });
});

test("Speaker Sweep caps its nominal high frequency to the runtime sample-rate ceiling", async ({
  page,
}) => {
  await installAudioProbe(page, { sampleRate: 16_000 });
  await page.goto("/speaker-test");
  await page.getByRole("button", { name: "Sweep", exact: true }).click();
  await page.getByRole("button", { name: "Run speaker sweep" }).click();

  await expect(page.locator("#speaker-frequency-cap")).toBeVisible();
  await expect(page.locator("#speaker-sweep-high")).toHaveValue("7600");
  const oscillators = await readProbe<
    Array<{ frequencyEvents: Array<{ kind: string; value?: number; time: number }> }>
  >(page, "__speakerProbeOscillators");
  expect(oscillators[0]?.frequencyEvents).toContainEqual({
    kind: "exponential",
    value: 7600,
    time: 20,
  });
});

test("Speaker Bass/rattle reuses the 40 to 120 Hz twelve-second logarithmic primitive", async ({
  page,
}) => {
  await installAudioProbe(page);
  await page.goto("/speaker-test");

  await page.getByRole("button", { name: "Bass / rattle", exact: true }).click();
  await page.getByRole("button", { name: "Run bass / rattle sweep" }).click();
  await expect(page.locator("#speaker-status")).toContainText("Bass / rattle sweep running");

  const oscillators = await readProbe<
    Array<{
      frequency: number;
      frequencyEvents: Array<{ kind: string; value?: number; time: number }>;
      stops: number[];
    }>
  >(page, "__speakerProbeOscillators");
  expect(oscillators[0]?.frequency).toBe(40);
  expect(oscillators[0]?.stops).toEqual([22]);
  expect(oscillators[0]?.frequencyEvents).toContainEqual({
    kind: "exponential",
    value: 120,
    time: 22,
  });
});

test("Speaker mode switching stops active playback and pagehide closes the session", async ({
  page,
}) => {
  await installAudioProbe(page);
  await page.goto("/speaker-test");

  await page.getByRole("button", { name: "Sweep", exact: true }).click();
  await page.getByRole("button", { name: "Run speaker sweep" }).click();
  await page.getByRole("button", { name: "Channel", exact: true }).click();
  await expect(page.locator("#speaker-status")).toContainText("Ready");

  const oscillators = await readProbe<Array<{ stops: number[] }>>(
    page,
    "__speakerProbeOscillators",
  );
  expect(oscillators[0]?.stops.at(-1)).toBeCloseTo(10.05, 10);

  await page.getByRole("button", { name: "Left", exact: true }).click();
  expect(await readCount(page, "__speakerContextCount")).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect.poll(() => readCount(page, "__speakerClosedContextCount")).toBe(1);
});

test("Speaker related tools include only currently live routes", async ({ page }) => {
  await page.goto("/speaker-test");
  for (const route of [
    "/sound-test",
    "/stereo-test",
    "/phase-test",
    "/headphone-test",
    "/surround-sound-test",
    "/bass-test",
  ]) {
    await expect(page.locator(`a[href="${route}"]`)).toHaveCount(1);
  }
});