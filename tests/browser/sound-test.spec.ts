import { expect, test, type Page } from "@playwright/test";

async function installDeterministicAudioContext(
  page: Page,
  failOscillatorAt: number | null = null,
): Promise<void> {
  await page.addInitScript(
    ({ configuredFailureIndex }) => {
      type OscillatorRecord = {
        frequency: number;
        starts: number[];
        stops: number[];
      };

      const oscillatorRecords: OscillatorRecord[] = [];
      const gainValues: number[] = [];
      let oscillatorCreateCount = 0;
      Reflect.set(window, "__soundOscillators", oscillatorRecords);
      Reflect.set(window, "__soundGainValues", gainValues);
      Reflect.set(window, "__soundAudioContextCount", 0);
      Reflect.set(window, "__soundClosedAudioContextCount", 0);

      const incrementWindowCounter = (key: string) => {
        const current = Number(Reflect.get(window, key) ?? 0);
        Reflect.set(window, key, current + 1);
      };

      class FakeAudioParam {
        value = 1;
        readonly onSet: ((value: number) => void) | undefined;

        constructor(onSet?: (value: number) => void) {
          this.onSet = onSet;
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
          void time;
          this.value = value;
          this.onSet?.(value);
          return this;
        }

        linearRampToValueAtTime(value: number, time: number) {
          void time;
          this.value = value;
          this.onSet?.(value);
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
          // The deterministic browser double owns no native resources.
        }
      }

      class FakeGainNode extends FakeAudioNode {
        readonly gain: FakeAudioParam;

        constructor(index: number) {
          super();
          this.gain = new FakeAudioParam((value) => {
            gainValues[index] = value;
          });
        }
      }

      class FakeOscillatorNode extends FakeAudioNode {
        readonly frequency: FakeAudioParam;
        type: OscillatorType = "sine";
        readonly record: OscillatorRecord;

        constructor() {
          super();
          this.record = { frequency: 0, starts: [], stops: [] };
          oscillatorRecords.push(this.record);
          this.frequency = new FakeAudioParam((value) => {
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
          options?: boolean | AddEventListenerOptions,
        ) {
          void type;
          void listener;
          void options;
        }
      }

      class FakeAudioContext {
        currentTime = 10;
        sampleRate = 48_000;
        state = "suspended";
        destination = new FakeAudioNode();
        gainIndex = 0;

        constructor() {
          incrementWindowCounter("__soundAudioContextCount");
        }

        async resume() {
          this.state = "running";
        }

        async close() {
          this.state = "closed";
          incrementWindowCounter("__soundClosedAudioContextCount");
        }

        createGain() {
          const node = new FakeGainNode(this.gainIndex);
          gainValues[this.gainIndex] = node.gain.value;
          this.gainIndex += 1;
          return node;
        }

        createOscillator() {
          oscillatorCreateCount += 1;
          if (configuredFailureIndex === oscillatorCreateCount) {
            throw new Error("Injected oscillator creation failure");
          }
          return new FakeOscillatorNode();
        }

        createChannelMerger(numberOfInputs = 2) {
          void numberOfInputs;
          return new FakeAudioNode();
        }
      }

      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        writable: true,
        value: FakeAudioContext,
      });
      Reflect.set(window, "__soundFakeAudioContextInstalled", true);
    },
    { configuredFailureIndex: failOscillatorAt },
  );
}

async function readWindowNumber(page: Page, key: string): Promise<number> {
  return page.evaluate(
    (property) => Number(Reflect.get(window, property) ?? 0),
    key,
  );
}

async function readOscillators(page: Page) {
  return page.evaluate(() =>
    structuredClone(Reflect.get(window, "__soundOscillators") ?? []),
  );
}

test("Sound Test exposes a safe lazy idle baseline", async ({ page }) => {
  await installDeterministicAudioContext(page);
  await page.goto("/sound-test");

  expect(
    await page.evaluate(
      () => Reflect.get(window, "__soundFakeAudioContextInstalled") === true,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Sound Test", level: 1 }),
  ).toBeVisible();
  await expect(page.locator("#sound-status")).toContainText("Ready");
  await expect(page.locator("[data-active-channel-label]")).toHaveText("None");
  await expect(
    page.getByText("Start with your device/headphone volume low."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Left" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Both" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Right" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Run sequence" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Stop" })).toBeDisabled();
  expect(await readWindowNumber(page, "__soundAudioContextCount")).toBe(0);
});

test("Sound Test plays an exact finite hard-routed channel burst", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await page.goto("/sound-test");

  await page.getByRole("button", { name: "Left" }).click();
  await expect(page.locator("#sound-status")).toContainText("Playing Left");
  await expect(page.locator("[data-sound-test]")).toHaveAttribute(
    "data-active-channel",
    "left",
  );
  await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();

  const oscillators = await readOscillators(page);
  expect(oscillators).toHaveLength(1);
  expect(oscillators[0]).toMatchObject({
    frequency: 500,
    starts: [10],
    stops: [10.7],
  });

  const routedGains = await page.evaluate(() =>
    structuredClone(Reflect.get(window, "__soundGainValues") ?? []),
  );
  expect(routedGains[2]).toBe(1);
  expect(routedGains[3]).toBe(0);

  await expect(page.locator("#sound-status")).toContainText(
    "Ready for another check",
    { timeout: 1_200 },
  );
  await expect(page.getByRole("button", { name: "Stop" })).toBeDisabled();
});

test("Sound Test schedules the canonical guided sequence and exposes Stop", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await page.goto("/sound-test");

  await page.getByRole("button", { name: "Run sequence" }).click();
  await expect(page.locator("#sound-status")).toContainText("Sequence running");
  await expect(page.locator("[data-active-channel-label]")).toHaveText("Left");

  const oscillators = await readOscillators(page);
  expect(oscillators).toHaveLength(3);
  expect(oscillators.map((record: { frequency: number }) => record.frequency)).toEqual([
    500, 500, 500,
  ]);
  expect(oscillators.map((record: { starts: number[] }) => record.starts[0])).toEqual([
    10, 11, 12,
  ]);
  expect(oscillators.map((record: { stops: number[] }) => record.stops[0])).toEqual([
    10.7, 11.7, 12.7,
  ]);

  await expect(page.locator("[data-active-channel-label]")).toHaveText("Both", {
    timeout: 1_400,
  });
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.locator("#sound-status")).toContainText("Stopped");
  await expect(page.locator("[data-active-channel-label]")).toHaveText("None");
  await expect(page.getByRole("button", { name: "Run sequence" })).toBeEnabled();
});

test("Sound Test cleans a partial sequence start failure and remains retryable", async ({
  page,
}) => {
  await installDeterministicAudioContext(page, 2);
  await page.goto("/sound-test");

  await page.getByRole("button", { name: "Run sequence" }).click();
  await expect(page.locator("#sound-status")).toContainText("Audio unavailable");
  await expect(page.locator("[data-active-channel-label]")).toHaveText("None");
  await expect(page.getByRole("button", { name: "Stop" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Run sequence" })).toBeEnabled();

  const failedRunOscillators = await readOscillators(page);
  expect(failedRunOscillators).toHaveLength(1);
  expect(failedRunOscillators[0].stops).toContain(10.05);

  await page.getByRole("button", { name: "Left" }).click();
  await expect(page.locator("#sound-status")).toContainText("Playing Left");
});

test("Sound Test closes its tool-local AudioContext on pagehide", async ({ page }) => {
  await installDeterministicAudioContext(page);
  await page.goto("/sound-test");
  await page.getByRole("button", { name: "Both" }).click();
  expect(await readWindowNumber(page, "__soundAudioContextCount")).toBe(1);

  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect
    .poll(() => readWindowNumber(page, "__soundClosedAudioContextCount"))
    .toBe(1);
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
] as const) {
  test(`Sound Test primary channel controls are visible at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/sound-test");

    const left = page.getByRole("button", { name: "Left" });
    await expect(left).toBeVisible();
    const box = await left.boundingBox();
    expect(box).not.toBeNull();
    expect(
      (box?.y ?? viewport.height) + (box?.height ?? 0),
    ).toBeLessThanOrEqual(viewport.height);
  });
}
