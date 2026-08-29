import { expect, test, type Page } from "@playwright/test";

interface NoiseSourceRecord {
  loop: boolean;
  bufferSampleRate: number | null;
  bufferLength: number | null;
  startTimes: number[];
  stopTimes: number[];
}

async function installDeterministicAudioContext(
  page: Page,
  options: { throwOnBufferSourceCreateNumber?: number } = {},
): Promise<void> {
  await page.addInitScript(
    ({ configuredThrowOnBufferSourceCreateNumber }) => {
      const sources: NoiseSourceRecord[] = [];
      let sourceCreateCount = 0;
      let nextLongTimerId = 1_000_000;
      const longTimers = new Map<number, () => void>();
      const nativeSetTimeout = window.setTimeout.bind(window);
      const nativeClearTimeout = window.clearTimeout.bind(window);

      const incrementCounter = (key: string) => {
        const current = Number(Reflect.get(window, key) ?? 0);
        Reflect.set(window, key, current + 1);
      };

      const publishLongTimerCount = () => {
        Reflect.set(window, "__noisePendingLongTimers", longTimers.size);
      };

      window.setTimeout = ((handler: TimerHandler, timeout?: number) => {
        const delay = Number(timeout ?? 0);
        if (delay >= 60_000 && typeof handler === "function") {
          const timerId = nextLongTimerId;
          nextLongTimerId += 1;
          longTimers.set(timerId, handler as () => void);
          Reflect.set(window, "__noiseLastLongTimerDelay", delay);
          publishLongTimerCount();
          return timerId;
        }
        return nativeSetTimeout(handler, timeout);
      }) as typeof window.setTimeout;

      window.clearTimeout = ((timerId?: number) => {
        const id = Number(timerId ?? 0);
        if (longTimers.delete(id)) {
          incrementCounter("__noiseClearedLongTimers");
          publishLongTimerCount();
          return;
        }
        nativeClearTimeout(timerId);
      }) as typeof window.clearTimeout;

      Reflect.set(window, "__noiseFireLongTimer", () => {
        const first = longTimers.entries().next().value as
          | [number, () => void]
          | undefined;
        if (!first) return false;
        const [timerId, handler] = first;
        longTimers.delete(timerId);
        publishLongTimerCount();
        handler();
        return true;
      });

      class FakeAudioParam {
        value = 1;

        cancelAndHoldAtTime(time: number) {
          void time;
          return this;
        }

        cancelScheduledValues(time: number) {
          void time;
          return this;
        }

        setValueAtTime(value: number, time: number) {
          void time;
          this.value = value;
          return this;
        }

        linearRampToValueAtTime(value: number, time: number) {
          void time;
          this.value = value;
          return this;
        }
      }

      class FakeAudioNode {
        connect(destination: unknown, output = 0, input = 0) {
          void output;
          void input;
          return destination;
        }

        disconnect() {
          // Deterministic browser double owns no native resources.
        }
      }

      class FakeGainNode extends FakeAudioNode {
        gain = new FakeAudioParam();
      }

      class FakeAudioBuffer {
        readonly numberOfChannels: number;
        readonly length: number;
        readonly sampleRate: number;
        readonly channel: Float32Array;

        constructor(numberOfChannels: number, length: number, sampleRate: number) {
          this.numberOfChannels = numberOfChannels;
          this.length = length;
          this.sampleRate = sampleRate;
          this.channel = new Float32Array(length);
        }

        getChannelData(channel: number) {
          if (channel !== 0) throw new RangeError("Only mono buffers are supported in this fake");
          return this.channel;
        }
      }

      class FakeBufferSourceNode extends FakeAudioNode {
        readonly record: NoiseSourceRecord;
        #buffer: FakeAudioBuffer | null = null;

        constructor(record: NoiseSourceRecord) {
          super();
          this.record = record;
        }

        get buffer() {
          return this.#buffer as unknown as AudioBuffer | null;
        }

        set buffer(value: AudioBuffer | null) {
          this.#buffer = value as unknown as FakeAudioBuffer | null;
          this.record.bufferSampleRate = this.#buffer?.sampleRate ?? null;
          this.record.bufferLength = this.#buffer?.length ?? null;
        }

        get loop() {
          return this.record.loop;
        }

        set loop(value: boolean) {
          this.record.loop = value;
        }

        start(time = 0, offset = 0) {
          void offset;
          this.record.startTimes.push(time);
        }

        stop(time = 0) {
          this.record.stopTimes.push(time);
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

      class FakeAudioContext {
        currentTime = 0;
        sampleRate = 48_000;
        state = "suspended";
        destination = new FakeAudioNode();

        constructor() {
          incrementCounter("__noiseAudioContextCount");
        }

        async resume() {
          this.state = "running";
        }

        async close() {
          this.state = "closed";
          incrementCounter("__noiseClosedAudioContextCount");
        }

        createGain() {
          return new FakeGainNode();
        }

        createChannelMerger(numberOfInputs = 2) {
          void numberOfInputs;
          return new FakeAudioNode();
        }

        createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
          incrementCounter("__noiseBufferCount");
          Reflect.set(window, "__noiseLastBufferChannels", numberOfChannels);
          Reflect.set(window, "__noiseLastBufferLength", length);
          Reflect.set(window, "__noiseLastBufferSampleRate", sampleRate);
          return new FakeAudioBuffer(numberOfChannels, length, sampleRate);
        }

        createBufferSource() {
          sourceCreateCount += 1;
          if (
            configuredThrowOnBufferSourceCreateNumber > 0 &&
            sourceCreateCount === configuredThrowOnBufferSourceCreateNumber
          ) {
            throw new Error("deterministic buffer source creation failure");
          }

          const record: NoiseSourceRecord = {
            loop: false,
            bufferSampleRate: null,
            bufferLength: null,
            startTimes: [],
            stopTimes: [],
          };
          sources.push(record);
          Reflect.set(window, "__noiseSources", sources);
          return new FakeBufferSourceNode(record);
        }
      }

      Reflect.set(window, "__noiseSources", sources);
      Reflect.set(window, "__noiseAudioContextCount", 0);
      Reflect.set(window, "__noiseClosedAudioContextCount", 0);
      Reflect.set(window, "__noiseBufferCount", 0);
      Reflect.set(window, "__noisePendingLongTimers", 0);
      Reflect.set(window, "__noiseClearedLongTimers", 0);
      Reflect.set(window, "__noiseLastLongTimerDelay", 0);
      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        writable: true,
        value: FakeAudioContext,
      });
    },
    {
      configuredThrowOnBufferSourceCreateNumber:
        options.throwOnBufferSourceCreateNumber ?? 0,
    },
  );
}

async function openNoise(page: Page): Promise<void> {
  await page.goto("/noise-generator");
}

async function readSources(page: Page): Promise<NoiseSourceRecord[]> {
  return page.evaluate(() =>
    structuredClone(
      (Reflect.get(window, "__noiseSources") ?? []) as NoiseSourceRecord[],
    ),
  );
}

async function readWindowNumber(page: Page, key: string): Promise<number> {
  return page.evaluate(
    (property) => Number(Reflect.get(window, property) ?? 0),
    key,
  );
}

test("Noise Generator exposes the safe idle surface without creating AudioContext", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openNoise(page);

  await expect(
    page.getByRole("heading", { name: "Noise Generator", level: 1 }),
  ).toBeVisible();
  await expect(page.locator("#noise-generator-status")).toContainText("Ready");
  await expect(page.locator("#noise-generator-level")).toHaveValue("-24");
  await expect(page.locator('button[data-noise-kind="white"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('button[data-noise-timer="0"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("[data-noise-long-reminder]")).toBeHidden();
  await expect(
    page.getByText("Start with your device/headphone volume low."),
  ).toBeVisible();
  await expect(page.locator('a[href="/hearing-frequency-test"]')).toHaveCount(0);
  expect(await readWindowNumber(page, "__noiseAudioContextCount")).toBe(0);
});

test("Noise Generator plays one canonical 44.1 kHz eight-second looping reference buffer and stops cleanly", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openNoise(page);

  await page.locator("[data-noise-play]").click();
  await expect(page.locator("#noise-generator-status")).toContainText("White noise");
  await expect(page.locator("[data-noise-stop]")).toBeEnabled();
  await expect(page.locator('button[data-noise-kind="pink"]')).toBeDisabled();
  await expect(page.locator("#noise-generator-level")).toBeEnabled();

  const sources = await readSources(page);
  expect(sources).toHaveLength(1);
  expect(sources[0]?.loop).toBe(true);
  expect(sources[0]?.bufferSampleRate).toBe(44_100);
  expect(sources[0]?.bufferLength).toBe(44_100 * 8);
  expect(sources[0]?.startTimes).toEqual([0]);
  expect(await readWindowNumber(page, "__noiseLastBufferChannels")).toBe(1);
  expect(await readWindowNumber(page, "__noiseBufferCount")).toBe(1);

  await page.locator("[data-noise-play]").click({ force: true });
  expect(await readSources(page)).toHaveLength(1);

  await page.locator("[data-noise-stop]").click();
  await expect(page.locator("#noise-generator-status")).toContainText("Stopped");
  const stopped = await readSources(page);
  expect(stopped[0]?.stopTimes.at(-1)).toBeCloseTo(0.05, 10);
});

test("Noise Generator selects each documented kind before playback without duplicating DSP", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openNoise(page);

  await page.locator('button[data-noise-kind="pink"]').click();
  await expect(page.locator("[data-noise-kind-readout]")).toHaveText("Pink noise");
  await expect(page.locator('button[data-noise-kind="pink"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator('button[data-noise-kind="brown"]').click();
  await expect(page.locator("[data-noise-kind-readout]")).toHaveText("Brown noise");

  await page.locator("[data-noise-play]").click();
  expect(await readWindowNumber(page, "__noiseBufferCount")).toBe(1);
  await page.locator("[data-noise-stop]").click();

  await page.locator("[data-noise-play]").click();
  expect(await readWindowNumber(page, "__noiseBufferCount")).toBe(1);
});

test("Noise Generator timed playback shows the required reminder, clears on Stop and auto-stops", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openNoise(page);

  await page.locator('button[data-noise-timer="1"]').click();
  await expect(page.locator("[data-noise-long-reminder]")).toHaveText(
    "Long playback: keep device/headphone volume at a comfortable level.",
  );

  await page.locator("[data-noise-play]").click();
  expect(await readWindowNumber(page, "__noiseLastLongTimerDelay")).toBe(60_000);
  expect(await readWindowNumber(page, "__noisePendingLongTimers")).toBe(1);

  await page.locator("[data-noise-stop]").click();
  expect(await readWindowNumber(page, "__noisePendingLongTimers")).toBe(0);
  expect(await readWindowNumber(page, "__noiseClearedLongTimers")).toBe(1);

  await page.locator("[data-noise-play]").click();
  expect(await readWindowNumber(page, "__noisePendingLongTimers")).toBe(1);
  expect(
    await page.evaluate(() => {
      const fire = Reflect.get(window, "__noiseFireLongTimer");
      return typeof fire === "function" ? Boolean(fire()) : false;
    }),
  ).toBe(true);
  await expect(page.locator("#noise-generator-status")).toContainText("Timer complete");
  await expect(page.locator("[data-noise-stop]")).toBeDisabled();
  const sources = await readSources(page);
  expect(sources.at(-1)?.stopTimes.at(-1)).toBeCloseTo(0.05, 10);
});

test("Noise Generator cleans a failed source start and allows retry", async ({ page }) => {
  await installDeterministicAudioContext(page, { throwOnBufferSourceCreateNumber: 1 });
  await openNoise(page);

  await page.locator("[data-noise-play]").click();
  await expect(page.locator("#noise-generator-status")).toContainText("Audio unavailable");
  await expect(page.locator("[data-noise-play]")).toBeEnabled();
  expect(await readSources(page)).toHaveLength(0);

  await page.locator("[data-noise-play]").click();
  await expect(page.locator("#noise-generator-status")).toContainText("White noise");
  expect(await readSources(page)).toHaveLength(1);
});

test("Noise Generator BFCache teardown closes the old session and remounts fresh idle state", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openNoise(page);

  await page.locator('button[data-noise-kind="pink"]').click();
  await page.locator('button[data-noise-timer="5"]').click();
  await page.locator("[data-noise-play]").click();
  expect(await readWindowNumber(page, "__noiseAudioContextCount")).toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
  });
  await expect
    .poll(() => readWindowNumber(page, "__noiseClosedAudioContextCount"))
    .toBe(1);
  expect(await readWindowNumber(page, "__noisePendingLongTimers")).toBe(0);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await expect(page.locator("#noise-generator-status")).toContainText("Ready");
  await expect(page.locator('button[data-noise-kind="white"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('button[data-noise-timer="0"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("[data-noise-stop]")).toBeDisabled();

  await page.locator("[data-noise-play]").click();
  expect(await readWindowNumber(page, "__noiseAudioContextCount")).toBe(2);
});
