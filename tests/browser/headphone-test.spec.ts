import { expect, test, type Page } from "@playwright/test";

type ProbeOptions = { sampleRate?: number };

type ParamEvent = {
  kind: "hold" | "cancel" | "set" | "linear" | "exponential";
  value?: number;
  time: number;
};

async function installHeadphoneProbe(page: Page, options: ProbeOptions = {}): Promise<void> {
  await page.addInitScript(
    ({ sampleRate }) => {
      type ProbeEvent = {
        kind: "hold" | "cancel" | "set" | "linear" | "exponential";
        value?: number;
        time: number;
      };
      type OscillatorRecord = {
        frequency: number;
        frequencyEvents: ProbeEvent[];
        starts: number[];
        stops: number[];
      };
      type SourceRecord = {
        starts: Array<{ time: number; offset: number }>;
        stops: number[];
        loop: boolean;
        bufferLength: number;
        bufferSampleRate: number;
      };

      const gains: ProbeEvent[][] = [];
      const oscillators: OscillatorRecord[] = [];
      const sources: SourceRecord[] = [];
      Reflect.set(window, "__headphoneProbeGains", gains);
      Reflect.set(window, "__headphoneProbeOscillators", oscillators);
      Reflect.set(window, "__headphoneProbeSources", sources);
      Reflect.set(window, "__headphoneContextCount", 0);
      Reflect.set(window, "__headphoneClosedContextCount", 0);
      Reflect.set(window, "__headphoneProbeInstalled", true);

      const increment = (key: string) => {
        Reflect.set(window, key, Number(Reflect.get(window, key) ?? 0) + 1);
      };

      class FakeAudioParam {
        value = 0;
        readonly events: ProbeEvent[];
        readonly onSet: ((value: number) => void) | undefined;

        constructor(events: ProbeEvent[], onSet?: (value: number) => void) {
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
          const events: ProbeEvent[] = [];
          gains.push(events);
          this.gain = new FakeAudioParam(events);
        }
      }

      class FakeOscillatorNode extends FakeNode {
        readonly frequency: FakeAudioParam;
        type: OscillatorType = "sine";
        readonly record: OscillatorRecord;

        constructor() {
          super();
          const frequencyEvents: ProbeEvent[] = [];
          this.record = { frequency: 0, frequencyEvents, starts: [], stops: [] };
          oscillators.push(this.record);
          this.frequency = new FakeAudioParam(frequencyEvents, (value) => {
            this.record.frequency = value;
          });
        }
        start(time = 0) { this.record.starts.push(time); }
        stop(time = 0) { this.record.stops.push(time); }
        addEventListener() {}
      }

      class FakeBufferSourceNode extends FakeNode {
        loop = false;
        #buffer: { length: number; sampleRate: number } | null = null;
        readonly record: SourceRecord;

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
          this.#buffer = value;
          this.record.bufferLength = value?.length ?? 0;
          this.record.bufferSampleRate = value?.sampleRate ?? 0;
        }
        get buffer() { return this.#buffer; }
        start(time = 0, offset = 0) {
          this.record.loop = this.loop;
          this.record.starts.push({ time, offset });
        }
        stop(time = 0) { this.record.stops.push(time); }
        addEventListener() {}
      }

      class FakeAudioBuffer {
        readonly numberOfChannels: number;
        readonly length: number;
        readonly sampleRate: number;
        readonly #channels: Float32Array[];

        constructor(numberOfChannels: number, length: number, rate: number) {
          this.numberOfChannels = numberOfChannels;
          this.length = length;
          this.sampleRate = rate;
          this.#channels = Array.from(
            { length: numberOfChannels },
            () => new Float32Array(length),
          );
        }
        getChannelData(channel: number) {
          const data = this.#channels[channel];
          if (!data) throw new RangeError("Invalid channel");
          return data;
        }
      }

      class FakeAudioContext {
        currentTime = 10;
        sampleRate = sampleRate;
        state = "suspended";
        destination = new FakeNode();

        constructor() { increment("__headphoneContextCount"); }
        async resume() { this.state = "running"; }
        async close() {
          this.state = "closed";
          increment("__headphoneClosedContextCount");
        }
        createGain() { return new FakeGainNode(); }
        createOscillator() { return new FakeOscillatorNode(); }
        createBufferSource() { return new FakeBufferSourceNode(); }
        createChannelMerger(numberOfInputs = 2) {
          void numberOfInputs;
          return new FakeNode();
        }
        createBuffer(numberOfChannels: number, length: number, rate: number) {
          return new FakeAudioBuffer(numberOfChannels, length, rate);
        }
      }

      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        writable: true,
        value: FakeAudioContext,
      });
    },
    { sampleRate: options.sampleRate ?? 48_000 },
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

test("Headphone Test starts idle, safe and without an AudioContext", async ({ page }) => {
  await installHeadphoneProbe(page);
  await page.goto("/headphone-test");

  expect(await page.evaluate(() => Reflect.get(window, "__headphoneProbeInstalled"))).toBe(true);
  await expect(page.getByRole("heading", { name: "Headphone Test", level: 1 })).toBeVisible();
  await expect(page.locator("#headphone-status")).toContainText("Ready");
  await expect(page.getByText("Start with your device/headphone volume low.")).toBeVisible();
  for (const name of ["Left", "Right", "Both", "Phase", "Sweep", "Bass / rattle"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Stop" })).toBeDisabled();
  expect(await readCount(page, "__headphoneContextCount")).toBe(0);
});

test("Headphone Left uses the canonical hard-routed 500 Hz / 700 ms burst", async ({ page }) => {
  await installHeadphoneProbe(page);
  await page.goto("/headphone-test");
  await page.getByRole("button", { name: "Left", exact: true }).click();
  await expect(page.locator("#headphone-status")).toContainText("Playing Left ear");

  const oscillators = await readProbe<Array<{ frequency: number; starts: number[]; stops: number[] }>>(
    page,
    "__headphoneProbeOscillators",
  );
  const gains = await readProbe<ParamEvent[][]>(page, "__headphoneProbeGains");
  expect(oscillators).toHaveLength(1);
  expect(oscillators[0]).toMatchObject({ frequency: 500, starts: [10], stops: [10.7] });
  expect(gains[2]?.at(-1)).toMatchObject({ kind: "set", value: 1 });
  expect(gains[3]?.at(-1)).toMatchObject({ kind: "set", value: 0 });
  await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();
});

test("Headphone Phase keeps one canonical correlated source across A/B", async ({ page }) => {
  await installHeadphoneProbe(page);
  await page.goto("/headphone-test");
  await page.getByRole("button", { name: "Phase", exact: true }).click();
  await page.getByRole("button", { name: "In phase" }).click();
  await page.getByRole("button", { name: "Inverted" }).click();
  await page.getByRole("button", { name: "A/B toggle" }).click();

  const sources = await readProbe<
    Array<{
      starts: Array<{ time: number; offset: number }>;
      loop: boolean;
      bufferLength: number;
      bufferSampleRate: number;
    }>
  >(page, "__headphoneProbeSources");
  expect(sources).toHaveLength(1);
  expect(sources[0]).toMatchObject({
    starts: [{ time: 10, offset: 0 }],
    loop: true,
    bufferLength: 176_400,
    bufferSampleRate: 44_100,
  });
  expect(sources[0]?.starts).toHaveLength(1);

  const gains = await readProbe<ParamEvent[][]>(page, "__headphoneProbeGains");
  const right = gains[3] ?? [];
  expect(right).toContainEqual({ kind: "linear", value: 0, time: 10.025 });
  expect(right).toContainEqual({ kind: "linear", value: -1, time: 10.05 });
});

test("Headphone Sweep uses the shared 20 Hz to 20 kHz fifteen-second logarithmic scheduler", async ({
  page,
}) => {
  await installHeadphoneProbe(page);
  await page.goto("/headphone-test");
  await page.getByRole("button", { name: "Sweep", exact: true }).click();
  await page.getByRole("button", { name: "Run headphone sweep" }).click();
  await expect(page.locator("#headphone-status")).toContainText("Headphone sweep running");

  const oscillators = await readProbe<
    Array<{
      frequency: number;
      frequencyEvents: ParamEvent[];
      starts: number[];
      stops: number[];
    }>
  >(page, "__headphoneProbeOscillators");
  expect(oscillators[0]).toMatchObject({ frequency: 20, starts: [10], stops: [25] });
  expect(oscillators[0]?.frequencyEvents).toContainEqual({
    kind: "exponential",
    value: 20_000,
    time: 25,
  });
});

test("Headphone runtime cap clamps Sweep and Bass generation", async ({ page }) => {
  await installHeadphoneProbe(page, { sampleRate: 200 });
  await page.goto("/headphone-test");

  await page.getByRole("button", { name: "Sweep", exact: true }).click();
  await page.getByRole("button", { name: "Run headphone sweep" }).click();
  await expect(page.locator("#headphone-frequency-cap")).toBeVisible();
  await expect(page.locator("#headphone-sweep-high")).toHaveValue("95");
  let oscillators = await readProbe<Array<{ frequencyEvents: ParamEvent[] }>>(
    page,
    "__headphoneProbeOscillators",
  );
  expect(oscillators[0]?.frequencyEvents).toContainEqual({
    kind: "exponential",
    value: 95,
    time: 25,
  });

  await page.getByRole("button", { name: "Bass / rattle", exact: true }).click();
  await page.getByRole("button", { name: "Run bass / rattle sweep" }).click();
  oscillators = await readProbe(page, "__headphoneProbeOscillators");
  expect(oscillators[1]?.frequencyEvents).toContainEqual({
    kind: "exponential",
    value: 95,
    time: 22,
  });
});

test("Headphone mode switching stops active playback and pagehide closes its AudioContext", async ({
  page,
}) => {
  await installHeadphoneProbe(page);
  await page.goto("/headphone-test");
  await page.getByRole("button", { name: "Sweep", exact: true }).click();
  await page.getByRole("button", { name: "Run headphone sweep" }).click();
  await page.getByRole("button", { name: "Phase", exact: true }).click();

  const oscillators = await readProbe<Array<{ stops: number[] }>>(
    page,
    "__headphoneProbeOscillators",
  );
  expect(oscillators[0]?.stops.at(-1)).toBeCloseTo(10.05, 10);
  await expect(page.locator("#headphone-status")).toContainText("Ready");

  await page.getByRole("button", { name: "In phase" }).click();
  expect(await readCount(page, "__headphoneContextCount")).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect.poll(() => readCount(page, "__headphoneClosedContextCount")).toBe(1);
});

test("Headphone related tools are live-only and claims avoid burn-in/quality scoring", async ({ page }) => {
  await page.goto("/headphone-test");
  for (const route of [
    "/speaker-test",
    "/sound-test",
    "/stereo-test",
    "/phase-test",
    "/surround-sound-test",
    "/bass-test",
  ]) {
    await expect(page.locator(`a[href="${route}"]`)).toHaveCount(1);
  }
  await expect(page.getByText(/burn-in/i)).toBeVisible();
  await expect(page.getByText(/quality scoring/i)).toBeVisible();
});
