import { expect, test, type Page } from "@playwright/test";

interface OscillatorRecord {
  frequencyEvents: Array<{
    kind: "set" | "linear" | "exponential";
    value: number;
    time: number;
  }>;
  startTimes: number[];
  stopTimes: number[];
}

async function installDeterministicAudioContext(
  page: Page,
  options: { sampleRate?: number; throwOnOscillatorCreateNumber?: number } = {},
): Promise<void> {
  await page.addInitScript(
    ({ configuredSampleRate, configuredThrowOnOscillatorCreateNumber }) => {
      const oscillators: OscillatorRecord[] = [];
      let oscillatorCreateCount = 0;

      const incrementCounter = (key: string) => {
        const current = Number(Reflect.get(window, key) ?? 0);
        Reflect.set(window, key, current + 1);
      };

      class FakeAudioParam {
        value = 1;
        readonly onEvent:
          | ((
              kind: "set" | "linear" | "exponential",
              value: number,
              time: number,
            ) => void)
          | undefined;

        constructor(
          onEvent?: (
            kind: "set" | "linear" | "exponential",
            value: number,
            time: number,
          ) => void,
        ) {
          this.onEvent = onEvent;
        }

        cancelAndHoldAtTime(time: number) {
          void time;
          return this;
        }

        cancelScheduledValues(time: number) {
          void time;
          return this;
        }

        setValueAtTime(value: number, time: number) {
          this.value = value;
          this.onEvent?.("set", value, time);
          return this;
        }

        linearRampToValueAtTime(value: number, time: number) {
          this.value = value;
          this.onEvent?.("linear", value, time);
          return this;
        }

        exponentialRampToValueAtTime(value: number, time: number) {
          this.value = value;
          this.onEvent?.("exponential", value, time);
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

      class FakeOscillatorNode extends FakeAudioNode {
        readonly record: OscillatorRecord;
        readonly frequency: FakeAudioParam;
        type = "sine";

        constructor(record: OscillatorRecord) {
          super();
          this.record = record;
          this.frequency = new FakeAudioParam((kind, value, time) => {
            record.frequencyEvents.push({ kind, value, time });
          });
        }

        start(time = 0) {
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
        sampleRate = configuredSampleRate;
        state = "suspended";
        destination = new FakeAudioNode();

        constructor() {
          incrementCounter("__frequencySweepAudioContextCount");
        }

        async resume() {
          this.state = "running";
        }

        async close() {
          this.state = "closed";
          incrementCounter("__frequencySweepClosedAudioContextCount");
        }

        createGain() {
          return new FakeGainNode();
        }

        createOscillator() {
          oscillatorCreateCount += 1;
          if (
            configuredThrowOnOscillatorCreateNumber > 0 &&
            oscillatorCreateCount === configuredThrowOnOscillatorCreateNumber
          ) {
            throw new Error("deterministic oscillator creation failure");
          }

          const record: OscillatorRecord = {
            frequencyEvents: [],
            startTimes: [],
            stopTimes: [],
          };
          oscillators.push(record);
          Reflect.set(window, "__frequencySweepOscillators", oscillators);
          return new FakeOscillatorNode(record);
        }

        createChannelMerger(numberOfInputs = 2) {
          void numberOfInputs;
          return new FakeAudioNode();
        }
      }

      Reflect.set(window, "__frequencySweepOscillators", oscillators);
      Reflect.set(window, "__frequencySweepAudioContextCount", 0);
      Reflect.set(window, "__frequencySweepClosedAudioContextCount", 0);
      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        writable: true,
        value: FakeAudioContext,
      });
    },
    {
      configuredSampleRate: options.sampleRate ?? 48_000,
      configuredThrowOnOscillatorCreateNumber:
        options.throwOnOscillatorCreateNumber ?? 0,
    },
  );
}

async function openSweep(page: Page): Promise<void> {
  await page.goto("/frequency-sweep");
}

async function readOscillators(page: Page): Promise<OscillatorRecord[]> {
  return page.evaluate(() =>
    structuredClone(
      (Reflect.get(window, "__frequencySweepOscillators") ?? []) as OscillatorRecord[],
    ),
  );
}

async function readWindowNumber(page: Page, key: string): Promise<number> {
  return page.evaluate(
    (property) => Number(Reflect.get(window, property) ?? 0),
    key,
  );
}

test("Frequency Sweep exposes its safe default contract without creating AudioContext", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openSweep(page);

  await expect(
    page.getByRole("heading", { name: "Frequency Sweep", level: 1 }),
  ).toBeVisible();
  await expect(page.locator("#frequency-sweep-status")).toContainText("Ready");
  await expect(page.locator("#frequency-sweep-low-number")).toHaveValue("20");
  await expect(page.locator("#frequency-sweep-high-number")).toHaveValue("20000");
  await expect(page.locator("#frequency-sweep-duration")).toHaveValue("15");
  await expect(page.locator("#frequency-sweep-level")).toHaveValue("-24");
  await expect(
    page.locator('button[data-sweep-scale="logarithmic"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator('button[data-sweep-direction="ascending"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText("Start with your device/headphone volume low."),
  ).toBeVisible();
  await expect(page.getByText("Low frequency", { exact: true })).toBeVisible();
  await expect(page.getByText("High frequency", { exact: true })).toBeVisible();
  await expect(page.locator('a[href="/noise-generator"]')).toHaveCount(0);
  expect(await readWindowNumber(page, "__frequencySweepAudioContextCount")).toBe(0);
});

test("default Frequency Sweep schedules one 20 Hz to 20 kHz logarithmic sweep and stops cleanly", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openSweep(page);

  await page.locator("[data-sweep-play]").click();
  await expect(page.locator("#frequency-sweep-status")).toContainText(
    "Frequency sweep running",
  );
  await expect(page.locator("[data-sweep-stop]")).toBeEnabled();
  await expect(page.locator("#frequency-sweep-low-number")).toBeDisabled();

  let oscillators = await readOscillators(page);
  expect(oscillators).toHaveLength(1);
  expect(oscillators[0]?.startTimes).toEqual([0]);
  expect(oscillators[0]?.stopTimes[0]).toBe(15);
  expect(oscillators[0]?.frequencyEvents.at(-1)).toEqual({
    kind: "exponential",
    value: 20_000,
    time: 15,
  });

  await page.locator("[data-sweep-stop]").click();
  await expect(page.locator("#frequency-sweep-status")).toContainText("Stopped");
  oscillators = await readOscillators(page);
  expect(oscillators[0]?.stopTimes.at(-1)).toBeCloseTo(0.05, 10);
  await expect(page.locator("#frequency-sweep-low-number")).toBeEnabled();
});

test("Frequency Sweep preserves custom linear descending semantics", async ({ page }) => {
  await installDeterministicAudioContext(page);
  await openSweep(page);

  await page.locator("#frequency-sweep-low-number").fill("100");
  await page.locator("#frequency-sweep-high-number").fill("8000");
  await page.locator("#frequency-sweep-duration").fill("32");
  await page.locator('button[data-sweep-scale="linear"]').click();
  await page.locator('button[data-sweep-direction="descending"]').click();

  await expect(page.locator("[data-sweep-from]")).toHaveText("8 kHz");
  await expect(page.locator("[data-sweep-to]")).toHaveText("100 Hz");
  await expect(page.locator("[data-sweep-scale-readout]")).toHaveText("Linear");

  await page.locator("[data-sweep-play]").click();
  const oscillators = await readOscillators(page);
  expect(oscillators).toHaveLength(1);
  expect(oscillators[0]?.frequencyEvents[0]).toEqual({
    kind: "set",
    value: 8_000,
    time: 0,
  });
  expect(oscillators[0]?.frequencyEvents.at(-1)).toEqual({
    kind: "linear",
    value: 100,
    time: 32,
  });
  expect(oscillators[0]?.stopTimes[0]).toBe(32);
});

test("Frequency Sweep keeps selector state truthful while endpoint order is invalid", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openSweep(page);

  await page.locator("#frequency-sweep-low-number").fill("5000");
  await page.locator("#frequency-sweep-high-number").fill("1000");
  await page.locator('button[data-sweep-scale="linear"]').click();
  await page.locator('button[data-sweep-direction="descending"]').click();

  await expect(page.locator("[data-sweep-error]")).toContainText(
    "Low frequency must be less than or equal to high frequency.",
  );
  await expect(page.locator("[data-sweep-play]")).toBeDisabled();
  await expect(page.locator("[data-sweep-from]")).toHaveText("—");
  await expect(page.locator("[data-sweep-to]")).toHaveText("—");
  await expect(page.locator('button[data-sweep-scale="linear"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.locator('button[data-sweep-direction="descending"]'),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await readWindowNumber(page, "__frequencySweepAudioContextCount")).toBe(0);
});

test("Frequency Sweep runtime cap clamps both shared frequency controls and resynchronizes their logarithmic sliders", async ({
  page,
}) => {
  await installDeterministicAudioContext(page, { sampleRate: 32_000 });
  await openSweep(page);

  await page.locator("#frequency-sweep-low-number").fill("10000");
  await page.locator("[data-sweep-play]").click();

  const lowControl = page.locator(
    "[data-sweep-low-control] [data-frequency-control]",
  );
  const highControl = page.locator(
    "[data-sweep-high-control] [data-frequency-control]",
  );
  await expect(lowControl).toHaveAttribute("data-max-hz", "15200");
  await expect(highControl).toHaveAttribute("data-max-hz", "15200");
  await expect(page.locator("#frequency-sweep-low-number")).toHaveAttribute(
    "max",
    "15200",
  );
  await expect(page.locator("#frequency-sweep-high-number")).toHaveValue("15200");
  await expect(page.locator("#frequency-sweep-cap")).toContainText("15200 Hz");

  const expectedLowSliderPosition =
    Math.log(10_000 / 20) / Math.log(15_200 / 20);
  expect(
    Number(await page.locator("#frequency-sweep-low-slider").inputValue()),
  ).toBeCloseTo(expectedLowSliderPosition, 3);
  expect(
    Number(await page.locator("#frequency-sweep-high-slider").inputValue()),
  ).toBeCloseTo(1, 3);

  const oscillators = await readOscillators(page);
  expect(oscillators[0]?.frequencyEvents.at(-1)).toEqual({
    kind: "exponential",
    value: 15_200,
    time: 15,
  });
});

test("Frequency Sweep cleans a failed start and allows an explicit retry", async ({
  page,
}) => {
  await installDeterministicAudioContext(page, {
    throwOnOscillatorCreateNumber: 1,
  });
  await openSweep(page);

  await page.locator("[data-sweep-play]").click();
  await expect(page.locator("#frequency-sweep-status")).toContainText(
    "Audio unavailable",
  );
  await expect(page.locator("[data-sweep-play]")).toBeEnabled();
  expect(await readOscillators(page)).toHaveLength(0);

  await page.locator("[data-sweep-play]").click();
  await expect(page.locator("#frequency-sweep-status")).toContainText(
    "Frequency sweep running",
  );
  expect(await readOscillators(page)).toHaveLength(1);
});

test("Frequency Sweep BFCache teardown closes the old session and remounts fresh defaults", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openSweep(page);

  await page.locator("#frequency-sweep-low-number").fill("400");
  await page.locator('button[data-sweep-direction="descending"]').click();
  await page.locator("[data-sweep-play]").click();
  expect(await readWindowNumber(page, "__frequencySweepAudioContextCount")).toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
  });
  await expect
    .poll(() => readWindowNumber(page, "__frequencySweepClosedAudioContextCount"))
    .toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await expect(page.locator("#frequency-sweep-status")).toContainText("Ready");
  await expect(page.locator("#frequency-sweep-low-number")).toHaveValue("20");
  await expect(page.locator("#frequency-sweep-high-number")).toHaveValue("20000");
  await expect(page.locator("#frequency-sweep-duration")).toHaveValue("15");
  await expect(
    page.locator('button[data-sweep-direction="ascending"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-sweep-stop]")).toBeDisabled();

  await page.locator("[data-sweep-play]").click();
  expect(await readWindowNumber(page, "__frequencySweepAudioContextCount")).toBe(2);
});
