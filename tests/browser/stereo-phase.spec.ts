import { expect, test, type Page } from "@playwright/test";

type AudioProbeOptions = {
  failBufferSourceAt?: number | null;
};

async function installDeterministicAudioContext(
  page: Page,
  options: AudioProbeOptions = {},
): Promise<void> {
  await page.addInitScript(
    ({ failBufferSourceAt }) => {
      type ParamEvent = {
        kind: "hold" | "cancel" | "set" | "linear";
        value?: number;
        time: number;
      };
      type OscillatorRecord = {
        frequency: number;
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

      const increment = (key: string) => {
        const current = Number(Reflect.get(window, key) ?? 0);
        Reflect.set(window, key, current + 1);
      };

      const gainEvents: ParamEvent[][] = [];
      const panEvents: ParamEvent[][] = [];
      const oscillators: OscillatorRecord[] = [];
      const bufferSources: BufferSourceRecord[] = [];
      let bufferSourceCreateCount = 0;

      Reflect.set(window, "__audioProbeGains", gainEvents);
      Reflect.set(window, "__audioProbePans", panEvents);
      Reflect.set(window, "__audioProbeOscillators", oscillators);
      Reflect.set(window, "__audioProbeBufferSources", bufferSources);
      Reflect.set(window, "__audioProbeContextCount", 0);
      Reflect.set(window, "__audioProbeClosedContextCount", 0);
      Reflect.set(window, "__audioProbeInstalled", true);

      class FakeAudioParam {
        value = 0;
        readonly events: ParamEvent[];

        constructor(events: ParamEvent[]) {
          this.events = events;
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
          this.events.push({ kind: "set", value, time });
          return this;
        }

        linearRampToValueAtTime(value: number, time: number) {
          this.value = value;
          this.events.push({ kind: "linear", value, time });
          return this;
        }
      }

      class FakeAudioNode {
        connect(destination: unknown, output = 0, input = 0) {
          void output;
          void input;
          return destination;
        }

        disconnect() {}
      }

      class FakeGainNode extends FakeAudioNode {
        readonly gain: FakeAudioParam;

        constructor() {
          super();
          const events: ParamEvent[] = [];
          gainEvents.push(events);
          this.gain = new FakeAudioParam(events);
        }
      }

      class FakeStereoPannerNode extends FakeAudioNode {
        readonly pan: FakeAudioParam;

        constructor() {
          super();
          const events: ParamEvent[] = [];
          panEvents.push(events);
          this.pan = new FakeAudioParam(events);
        }
      }

      class FakeOscillatorNode extends FakeAudioNode {
        readonly frequency: FakeAudioParam;
        type: OscillatorType = "sine";
        readonly record: OscillatorRecord;

        constructor() {
          super();
          this.record = { frequency: 0, starts: [], stops: [] };
          oscillators.push(this.record);
          const events: ParamEvent[] = [];
          this.frequency = new FakeAudioParam(events);
          const originalSet = this.frequency.setValueAtTime.bind(this.frequency);
          this.frequency.setValueAtTime = (value: number, time: number) => {
            this.record.frequency = value;
            return originalSet(value, time);
          };
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
          listenerOptions?: boolean | AddEventListenerOptions,
        ) {
          void type;
          void listener;
          void listenerOptions;
        }
      }

      class FakeBufferSourceNode extends FakeAudioNode {
        loop = false;
        #buffer: { length: number; sampleRate: number } | null = null;
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
          bufferSources.push(this.record);
        }

        set buffer(value: { length: number; sampleRate: number } | null) {
          this.#buffer = value;
          this.record.bufferLength = value?.length ?? 0;
          this.record.bufferSampleRate = value?.sampleRate ?? 0;
        }

        get buffer() {
          return this.#buffer;
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
          listenerOptions?: boolean | AddEventListenerOptions,
        ) {
          void type;
          void listener;
          void listenerOptions;
        }
      }

      class FakeAudioBuffer {
        readonly numberOfChannels: number;
        readonly length: number;
        readonly sampleRate: number;
        readonly #channels: Float32Array[];

        constructor(numberOfChannels: number, length: number, sampleRate: number) {
          this.numberOfChannels = numberOfChannels;
          this.length = length;
          this.sampleRate = sampleRate;
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
        sampleRate = 48_000;
        state = "suspended";
        destination = new FakeAudioNode();

        constructor() {
          increment("__audioProbeContextCount");
        }

        async resume() {
          this.state = "running";
        }

        async close() {
          this.state = "closed";
          increment("__audioProbeClosedContextCount");
        }

        createGain() {
          return new FakeGainNode();
        }

        createStereoPanner() {
          return new FakeStereoPannerNode();
        }

        createOscillator() {
          return new FakeOscillatorNode();
        }

        createBufferSource() {
          bufferSourceCreateCount += 1;
          if (failBufferSourceAt === bufferSourceCreateCount) {
            throw new Error("Injected buffer-source creation failure");
          }
          return new FakeBufferSourceNode();
        }

        createChannelMerger(numberOfInputs = 2) {
          void numberOfInputs;
          return new FakeAudioNode();
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
    { failBufferSourceAt: options.failBufferSourceAt ?? null },
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

test("Stereo Test exposes a safe lazy idle baseline", async ({ page }) => {
  await installDeterministicAudioContext(page);
  await page.goto("/stereo-test");

  expect(await page.evaluate(() => Reflect.get(window, "__audioProbeInstalled"))).toBe(true);
  await expect(page.getByRole("heading", { name: "Stereo Test", level: 1 })).toBeVisible();
  await expect(page.locator("#stereo-status")).toContainText("Ready");
  await expect(page.getByText("Start with your device/headphone volume low.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop" })).toBeDisabled();
  expect(await readCount(page, "__audioProbeContextCount")).toBe(0);
});

test("Stereo static Center uses the shared hard Both route", async ({ page }) => {
  await installDeterministicAudioContext(page);
  await page.goto("/stereo-test");

  await page.getByRole("button", { name: "Center" }).click();
  await expect(page.locator("#stereo-status")).toContainText("Playing Center");

  const oscillators = await readProbe<Array<{ frequency: number; starts: number[]; stops: number[] }>>(
    page,
    "__audioProbeOscillators",
  );
  const gains = await readProbe<Array<Array<{ kind: string; value?: number; time: number }>>>(
    page,
    "__audioProbeGains",
  );

  expect(oscillators).toHaveLength(1);
  expect(oscillators[0]).toMatchObject({ frequency: 500, starts: [10], stops: [10.7] });
  expect(gains[2]?.at(-1)).toMatchObject({ kind: "set", value: 1, time: 10 });
  expect(gains[3]?.at(-1)).toMatchObject({ kind: "set", value: 1, time: 10 });
});

test("Stereo L to R uses one four-second linear StereoPanner sweep and exposes Stop", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await page.goto("/stereo-test");

  await page.getByRole("button", { name: "L → R" }).click();
  await expect(page.locator("#stereo-status")).toContainText("Panning L → R");
  await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();

  const oscillators = await readProbe<Array<{ frequency: number; starts: number[]; stops: number[] }>>(
    page,
    "__audioProbeOscillators",
  );
  const pans = await readProbe<Array<Array<{ kind: string; value?: number; time: number }>>>(
    page,
    "__audioProbePans",
  );

  expect(oscillators).toHaveLength(1);
  expect(oscillators[0]).toMatchObject({ frequency: 500, starts: [10], stops: [14] });
  expect(pans).toHaveLength(1);
  expect(pans[0]).toEqual([
    { kind: "set", value: -1, time: 10 },
    { kind: "cancel", time: 10 },
    { kind: "set", value: -1, time: 10 },
    { kind: "linear", value: 1, time: 14 },
  ]);

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.locator("#stereo-status")).toContainText("Stopped");
});

test("Phase Test keeps one running correlated source across In phase, Inverted and A/B", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await page.goto("/phase-test");

  expect(await readCount(page, "__audioProbeContextCount")).toBe(0);
  await page.getByRole("button", { name: "In phase" }).click();
  await expect(page.locator("#phase-status")).toContainText("Playing in phase");

  let sources = await readProbe<Array<{ starts: Array<{ time: number; offset: number }>; loop: boolean; bufferLength: number; bufferSampleRate: number }>>(
    page,
    "__audioProbeBufferSources",
  );
  expect(sources).toHaveLength(1);
  expect(sources[0]).toMatchObject({
    starts: [{ time: 10, offset: 0 }],
    loop: true,
    bufferLength: 176_400,
    bufferSampleRate: 44_100,
  });

  await page.getByRole("button", { name: "Inverted" }).click();
  await expect(page.locator("#phase-status")).toContainText("Playing inverted");
  await page.getByRole("button", { name: "A/B toggle" }).click();
  await expect(page.locator("#phase-status")).toContainText("Playing in phase");

  sources = await readProbe(page, "__audioProbeBufferSources");
  expect(sources).toHaveLength(1);
  expect(sources[0]?.starts).toHaveLength(1);

  const gains = await readProbe<Array<Array<{ kind: string; value?: number; time: number }>>>(
    page,
    "__audioProbeGains",
  );
  const leftEvents = gains[2] ?? [];
  const rightEvents = gains[3] ?? [];
  expect(leftEvents).toEqual([{ kind: "set", value: 1, time: 10 }]);
  expect(rightEvents.slice(0, 5)).toEqual([
    { kind: "set", value: 1, time: 10 },
    { kind: "hold", time: 10 },
    { kind: "linear", value: 0, time: 10.025 },
    { kind: "set", value: 0, time: 10.025 },
    { kind: "linear", value: -1, time: 10.05 },
  ]);
  expect(rightEvents.slice(5)).toEqual([
    { kind: "hold", time: 10 },
    { kind: "linear", value: 0, time: 10.025 },
    { kind: "set", value: 0, time: 10.025 },
    { kind: "linear", value: 1, time: 10.05 },
  ]);

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.locator("#phase-status")).toContainText("Stopped");
});

test("Stereo and Phase close their tool-local AudioContext on pagehide", async ({ page }) => {
  await installDeterministicAudioContext(page);

  await page.goto("/stereo-test");
  await page.getByRole("button", { name: "Left" }).click();
  expect(await readCount(page, "__audioProbeContextCount")).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect.poll(() => readCount(page, "__audioProbeClosedContextCount")).toBe(1);

  await page.goto("/phase-test");
  await page.getByRole("button", { name: "In phase" }).click();
  expect(await readCount(page, "__audioProbeContextCount")).toBe(2);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect.poll(() => readCount(page, "__audioProbeClosedContextCount")).toBe(2);
});

test("Stereo and Phase expose only implemented related-tool links", async ({ page }) => {
  await page.goto("/stereo-test");
  await expect(page.locator('a[href="/sound-test"]')).toHaveCount(1);
  await expect(page.locator('a[href="/phase-test"]')).toHaveCount(1);
  await expect(page.locator('a[href="/speaker-test"]')).toHaveCount(0);
  await expect(page.locator('a[href="/headphone-test"]')).toHaveCount(0);

  await page.goto("/phase-test");
  await expect(page.locator('a[href="/stereo-test"]')).toHaveCount(1);
  await expect(page.locator('a[href="/sound-test"]')).toHaveCount(1);
  await expect(page.locator('a[href="/speaker-test"]')).toHaveCount(0);
  await expect(page.locator('a[href="/headphone-test"]')).toHaveCount(0);
});
