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
          incrementCounter("__bassAudioContextCount");
        }

        async resume() {
          this.state = "running";
        }

        async close() {
          this.state = "closed";
          incrementCounter("__bassClosedAudioContextCount");
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
          Reflect.set(window, "__bassOscillators", oscillators);
          return new FakeOscillatorNode(record);
        }

        createChannelMerger(numberOfInputs = 2) {
          void numberOfInputs;
          return new FakeAudioNode();
        }
      }

      Reflect.set(window, "__bassOscillators", oscillators);
      Reflect.set(window, "__bassAudioContextCount", 0);
      Reflect.set(window, "__bassClosedAudioContextCount", 0);
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

async function openBass(page: Page): Promise<void> {
  await page.goto("/bass-test");
}

async function readOscillators(page: Page): Promise<OscillatorRecord[]> {
  return page.evaluate(() =>
    structuredClone(
      (Reflect.get(window, "__bassOscillators") ?? []) as OscillatorRecord[],
    ),
  );
}

async function readWindowNumber(page: Page, key: string): Promise<number> {
  return page.evaluate(
    (property) => Number(Reflect.get(window, property) ?? 0),
    key,
  );
}

test("Bass Test exposes its safe idle contract without creating AudioContext", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openBass(page);

  await expect(
    page.getByRole("heading", { name: "Bass Test", level: 1 }),
  ).toBeVisible();
  await expect(page.locator("#bass-status")).toContainText("Ready");
  await expect(page.locator("#bass-frequency-number")).toHaveValue("60");
  await expect(page.locator("#bass-frequency-number")).toHaveAttribute(
    "min",
    "20",
  );
  await expect(page.locator("#bass-frequency-number")).toHaveAttribute(
    "max",
    "200",
  );
  await expect(page.locator("#bass-level")).toHaveValue("-24");
  await expect(
    page.getByText("Keep playback volume moderate."),
  ).toBeVisible();
  await expect(page.locator('[data-bass-preset="20"]')).toBeVisible();
  await expect(page.locator('[data-bass-preset="100"]')).toBeVisible();
  await expect(page.locator('a[href="/frequency-sweep"]')).toHaveCount(0);
  expect(await readWindowNumber(page, "__bassAudioContextCount")).toBe(0);
});

test("Bass single tone is continuous until Stop and supports live preset changes", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openBass(page);

  await page.locator("[data-bass-tone-play]").click();
  await expect(page.locator("#bass-status")).toContainText("Playing 60 Hz");
  await expect(page.locator("[data-bass-stop]")).toBeEnabled();

  let oscillators = await readOscillators(page);
  expect(oscillators).toHaveLength(1);
  expect(oscillators[0]?.startTimes).toEqual([0]);
  expect(oscillators[0]?.stopTimes).toEqual([]);
  expect(oscillators[0]?.frequencyEvents[0]).toEqual({
    kind: "set",
    value: 60,
    time: 0,
  });

  await page.locator('[data-bass-preset="80"]').click();
  await expect(page.locator("#bass-status")).toContainText("Playing 80 Hz");
  await expect(page.locator("[data-bass-frequency-readout]")).toHaveText("80");

  oscillators = await readOscillators(page);
  expect(oscillators[0]?.frequencyEvents.at(-1)).toEqual({
    kind: "set",
    value: 80,
    time: 0,
  });

  await page.locator("[data-bass-stop]").click();
  await expect(page.locator("#bass-status")).toContainText("Stopped");
  oscillators = await readOscillators(page);
  expect(oscillators[0]?.stopTimes.at(-1)).toBeCloseTo(0.05, 10);
});

test("Bass slow sweep uses the shared 20 to 120 Hz logarithmic 12 second primitive", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openBass(page);

  await page.locator('[data-bass-mode="sweep"]').click();
  await page.locator("[data-bass-sweep-play]").click();
  await expect(page.locator("#bass-status")).toContainText("Slow bass sweep running");

  const oscillators = await readOscillators(page);
  expect(oscillators).toHaveLength(1);
  expect(oscillators[0]?.startTimes).toEqual([0]);
  expect(oscillators[0]?.stopTimes[0]).toBe(12);
  expect(oscillators[0]?.frequencyEvents.at(-1)).toEqual({
    kind: "exponential",
    value: 120,
    time: 12,
  });
  await expect(page.locator("[data-bass-frequency-readout]")).toHaveText(
    "20–120",
  );
});

test("Bass preset sequence schedules the exact seven tones with 800 ms bursts and 300 ms gaps", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openBass(page);

  await page.locator('[data-bass-mode="sequence"]').click();
  await page.locator("[data-bass-sequence-play]").click();
  await expect(page.locator("#bass-status")).toContainText(
    "Bass preset sequence running",
  );

  const oscillators = await readOscillators(page);
  expect(oscillators).toHaveLength(7);
  expect(
    oscillators.map((oscillator) => oscillator.frequencyEvents[0]?.value),
  ).toEqual([20, 30, 40, 50, 60, 80, 100]);

  oscillators.forEach((oscillator, index) => {
    const expectedStart = index * 1.1;
    expect(oscillator.startTimes[0]).toBeCloseTo(expectedStart, 10);
    expect(oscillator.stopTimes[0]).toBeCloseTo(expectedStart + 0.8, 10);
  });

  await page.locator("[data-bass-stop]").click();
  const stopped = await readOscillators(page);
  for (const oscillator of stopped) {
    expect(oscillator.stopTimes.at(-1)).toBeCloseTo(0.05, 10);
  }
});

test("Bass runtime cap updates the shared frequency slider, clamps the sweep and disables an inexact sequence", async ({
  page,
}) => {
  await installDeterministicAudioContext(page, { sampleRate: 160 });
  await openBass(page);

  await page.locator("[data-bass-tone-play]").click();
  await page.locator("[data-bass-stop]").click();

  const frequency = page.locator("#bass-frequency-number");
  await expect(frequency).toHaveAttribute("max", "76");
  await expect(page.locator("[data-frequency-control]")).toHaveAttribute(
    "data-max-hz",
    "76",
  );
  await expect(page.locator("#bass-frequency-cap")).toContainText("76 Hz");
  await expect(page.locator('[data-bass-preset="80"]')).toBeDisabled();
  await expect(page.locator('[data-bass-preset="100"]')).toBeDisabled();

  const slider = page.locator("#bass-frequency-slider");
  const expectedSliderPosition = Math.log(60 / 20) / Math.log(76 / 20);
  expect(Number(await slider.inputValue())).toBeCloseTo(expectedSliderPosition, 3);

  await slider.fill("1");
  await expect(frequency).toHaveValue("76");

  await page.locator('[data-bass-mode="sequence"]').click();
  await expect(page.locator("[data-bass-sequence-play]")).toBeDisabled();

  await page.locator('[data-bass-mode="sweep"]').click();
  await expect(page.locator("[data-bass-sweep-range]")).toHaveText("20 → 76 Hz");
  await page.locator("[data-bass-sweep-play]").click();

  const oscillators = await readOscillators(page);
  expect(oscillators.at(-1)?.frequencyEvents.at(-1)).toEqual({
    kind: "exponential",
    value: 76,
    time: 12,
  });
});

test("Bass cleans a partially-created preset sequence and allows retry", async ({
  page,
}) => {
  await installDeterministicAudioContext(page, {
    throwOnOscillatorCreateNumber: 4,
  });
  await openBass(page);

  await page.locator('[data-bass-mode="sequence"]').click();
  await page.locator("[data-bass-sequence-play]").click();
  await expect(page.locator("#bass-status")).toContainText("Audio unavailable");
  await expect(page.locator("[data-bass-sequence-play]")).toBeEnabled();

  const failedRecords = await readOscillators(page);
  expect(failedRecords).toHaveLength(3);
  for (const oscillator of failedRecords) {
    expect(oscillator.stopTimes.at(-1)).toBeCloseTo(0.05, 10);
  }

  await page.locator("[data-bass-sequence-play]").click();
  await expect(page.locator("#bass-status")).toContainText(
    "Bass preset sequence running",
  );
  expect(await readOscillators(page)).toHaveLength(10);
});

test("Bass BFCache teardown closes the old session and remounts fresh idle state", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openBass(page);

  await page.locator('[data-bass-preset="80"]').click();
  await page.locator("[data-bass-tone-play]").click();
  expect(await readWindowNumber(page, "__bassAudioContextCount")).toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
  });
  await expect
    .poll(() => readWindowNumber(page, "__bassClosedAudioContextCount"))
    .toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await expect(page.locator("#bass-status")).toContainText("Ready");
  await expect(page.locator("#bass-frequency-number")).toHaveValue("60");
  await expect(page.locator("[data-bass-stop]")).toBeDisabled();

  await page.locator("[data-bass-tone-play]").click();
  expect(await readWindowNumber(page, "__bassAudioContextCount")).toBe(2);
}