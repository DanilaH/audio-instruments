import { expect, test, type Page } from "@playwright/test";

const plannedRelatedRoutes = [
  "/frequency-sweep",
  "/noise-generator",
  "/hearing-frequency-test",
] as const;

async function installDeterministicAudioContext(
  page: Page,
  sampleRate = 48_000,
): Promise<void> {
  await page.addInitScript(
    ({ configuredSampleRate }) => {
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
        gain = new FakeAudioParam();
      }

      class FakeOscillatorNode extends FakeAudioNode {
        frequency = new FakeAudioParam((value) => {
          Reflect.set(window, "__toneLastOscillatorFrequency", value);
        });
        type = "sine";

        start(time = 0) {
          void time;
        }

        stop(time = 0) {
          void time;
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
        currentTime = 0;
        sampleRate = configuredSampleRate;
        state = "suspended";
        destination = new FakeAudioNode();

        constructor() {
          incrementWindowCounter("__toneAudioContextCount");
        }

        async resume() {
          this.state = "running";
        }

        async close() {
          this.state = "closed";
          incrementWindowCounter("__toneClosedAudioContextCount");
        }

        createGain() {
          return new FakeGainNode();
        }

        createOscillator() {
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
    },
    { configuredSampleRate: sampleRate },
  );
}

async function installAnimationFrameProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let nextFrameId = 1;
    const pendingFrames = new Set<number>();

    const publishPendingCount = () => {
      Reflect.set(window, "__tonePendingAnimationFrames", pendingFrames.size);
    };

    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      void callback;
      const frameId = nextFrameId;
      nextFrameId += 1;
      pendingFrames.add(frameId);
      publishPendingCount();
      return frameId;
    };

    window.cancelAnimationFrame = (frameId: number) => {
      pendingFrames.delete(frameId);
      publishPendingCount();
    };

    publishPendingCount();
  });
}

async function openTone(page: Page): Promise<void> {
  await page.goto("/tone-generator");
}

async function readWindowNumber(page: Page, key: string): Promise<number> {
  return page.evaluate(
    (property) => Number(Reflect.get(window, property) ?? 0),
    key,
  );
}

test("Tone Generator exposes the safe idle baseline", async ({ page }) => {
  await openTone(page);

  await expect(
    page.getByRole("heading", { name: "Tone Generator", level: 1 }),
  ).toBeVisible();
  await expect(page.locator("#tone-status")).toContainText("Idle");
  await expect(page.locator("#tone-frequency-number")).toHaveValue("440");
  await expect(page.locator("#tone-level")).toHaveValue("-24");
  await expect(
    page.getByText("Start with your device/headphone volume low."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(page.locator("#tone-frequency-readout")).toHaveText("440 Hz");
  await expect(page.locator('a[href="/bass-test"]')).toHaveCount(1);

  for (const route of plannedRelatedRoutes) {
    await expect(page.locator(`a[href="${route}"]`)).toHaveCount(0);
  }
});

test("Tone numeric frequency supports transient keyboard editing before commit", async ({
  page,
}) => {
  await openTone(page);

  const frequency = page.locator("#tone-frequency-number");
  const readout = page.locator("#tone-frequency-readout");

  await frequency.click();
  await frequency.press("Control+A");
  await frequency.press("Backspace");
  await expect(frequency).toHaveValue("");
  await expect(readout).toHaveText("440 Hz");

  await frequency.pressSequentially("1000");
  await expect(frequency).toHaveValue("1000");
  await expect(readout).toHaveText("1,000 Hz");

  await frequency.press("Control+A");
  await frequency.press("Backspace");
  await expect(frequency).toHaveValue("");
  await frequency.blur();
  await expect(frequency).toHaveValue("1000");
  await expect(readout).toHaveText("1,000 Hz");
});

test("Tone Generator wires live controls and explicit Stop across browsers", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openTone(page);

  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  const playStop = page.locator("#tone-play-stop");
  await playStop.click();

  await expect(page.locator("#tone-status")).toContainText("Playing");
  await expect(playStop).toContainText("Stop");

  const frequency = page.locator("#tone-frequency-number");
  await frequency.fill("1000");
  await expect(frequency).toHaveValue("1000");
  await expect(page.locator("#tone-frequency-readout")).toHaveText("1,000 Hz");

  const squarePill = page.locator("label.mode-pill").filter({
    hasText: "Square",
  });
  await squarePill.click();
  await expect(page.getByLabel("Square")).toBeChecked();

  const leftPill = page.locator("label.mode-pill").filter({ hasText: "Left" });
  await leftPill.click();
  await expect(page.getByLabel("Left")).toBeChecked();

  await playStop.click();
  await expect(page.locator("#tone-status")).toContainText("Idle");
  await expect(playStop).toContainText("Play");
  expect(pageErrors).toEqual([]);
});

test("Tone Generator caps UI and oscillator scheduling to the runtime Nyquist limit", async ({
  page,
}) => {
  await installDeterministicAudioContext(page, 32_000);
  await openTone(page);

  const frequency = page.locator("#tone-frequency-number");
  await frequency.fill("20000");
  await page.locator("#tone-play-stop").click();

  await expect(page.locator("#tone-status")).toContainText("Playing");
  await expect(frequency).toHaveAttribute("max", "15200");
  await expect(frequency).toHaveValue("15200");
  await expect(page.locator("[data-frequency-control]")).toHaveAttribute(
    "data-max-hz",
    "15200",
  );
  await expect(page.locator("#tone-frequency-cap")).toBeVisible();
  await expect(page.locator("#tone-frequency-cap")).toContainText("15,200 Hz");
  expect(await readWindowNumber(page, "__toneLastOscillatorFrequency")).toBe(
    15_200,
  );
});

test("Tone Generator restores a fresh idle BFCache lifecycle without losing control state", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await openTone(page);

  const frequency = page.locator("#tone-frequency-number");
  const playStop = page.locator("#tone-play-stop");
  await frequency.fill("1000");
  await page.locator("label.mode-pill").filter({ hasText: "Square" }).click();
  await page.locator("label.mode-pill").filter({ hasText: "Left" }).click();
  await playStop.click();
  await expect(page.locator("#tone-status")).toContainText("Playing");
  expect(await readWindowNumber(page, "__toneAudioContextCount")).toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
  });
  await expect
    .poll(() => readWindowNumber(page, "__toneClosedAudioContextCount"))
    .toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });

  await expect(page.locator("#tone-status")).toContainText("Idle");
  await expect(playStop).toContainText("Play");
  await expect(frequency).toHaveValue("1000");
  await expect(page.getByLabel("Square")).toBeChecked();
  await expect(page.getByLabel("Left")).toBeChecked();
  expect(await readWindowNumber(page, "__toneAudioContextCount")).toBe(1);

  await playStop.click();
  await expect(page.locator("#tone-status")).toContainText("Playing");
  expect(await readWindowNumber(page, "__toneAudioContextCount")).toBe(2);
});

test("Tone waveform keeps one loop across live updates and tears it down", async ({
  page,
}) => {
  await installDeterministicAudioContext(page);
  await installAnimationFrameProbe(page);
  await openTone(page);

  const baselinePendingFrames = await readWindowNumber(
    page,
    "__tonePendingAnimationFrames",
  );
  const playStop = page.locator("#tone-play-stop");

  await playStop.click();
  await expect(page.locator("#tone-status")).toContainText("Playing");
  await expect
    .poll(() => readWindowNumber(page, "__tonePendingAnimationFrames"))
    .toBe(baselinePendingFrames + 1);

  await page.locator("#tone-frequency-number").fill("1000");
  await page.locator("label.mode-pill").filter({ hasText: "Square" }).click();
  expect(await readWindowNumber(page, "__tonePendingAnimationFrames")).toBe(
    baselinePendingFrames + 1,
  );

  await playStop.click();
  await expect
    .poll(() => readWindowNumber(page, "__tonePendingAnimationFrames"))
    .toBe(baselinePendingFrames);

  await playStop.click();
  await expect
    .poll(() => readWindowNumber(page, "__tonePendingAnimationFrames"))
    .toBe(baselinePendingFrames + 1);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
  });
  await expect
    .poll(() => readWindowNumber(page, "__tonePendingAnimationFrames"))
    .toBe(baselinePendingFrames);
});

test("Tone waveform stays static when reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installDeterministicAudioContext(page);
  await installAnimationFrameProbe(page);
  await openTone(page);

  const baselinePendingFrames = await readWindowNumber(
    page,
    "__tonePendingAnimationFrames",
  );

  await page.locator("#tone-play-stop").click();
  await expect(page.locator("#tone-status")).toContainText("Playing");
  expect(await readWindowNumber(page, "__tonePendingAnimationFrames")).toBe(
    baselinePendingFrames,
  );
});

test("Tone Generator unlocks a real AudioContext in Chromium", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Headless Firefox/WebKit audio backends are not a reliable real-output oracle.",
  );

  await openTone(page);
  const playStop = page.locator("#tone-play-stop");
  await playStop.click();

  await expect(page.locator("#tone-status")).toContainText("Playing", {
    timeout: 10_000,
  });
  await expect(playStop).toContainText("Stop");

  await playStop.click();
  await expect(page.locator("#tone-status")).toContainText("Idle");
});

const primaryViewportTargets = [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
] as const;

for (const viewport of primaryViewportTargets) {
  test(`Tone safety and primary action are visible at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openTone(page);

    const instrument = page.locator(
      '[aria-label="Tone Generator controls and waveform"]',
    );
    const playStop = page.locator("#tone-play-stop");
    const safety = page.locator(".tone-safety");

    await expect(instrument).toBeVisible();
    await expect(playStop).toBeVisible();
    await expect(safety).toBeVisible();

    const playBox = await playStop.boundingBox();
    const safetyBox = await safety.boundingBox();
    expect(playBox).not.toBeNull();
    expect(safetyBox).not.toBeNull();
    expect((playBox?.y ?? 9999) + (playBox?.height ?? 0)).toBeLessThanOrEqual(
      viewport.height,
    );
    expect(
      (safetyBox?.y ?? 9999) + (safetyBox?.height ?? 0),
    ).toBeLessThanOrEqual(viewport.height);
  });
}

test.describe("Tone waveform high-DPR rendering", () => {
  test.use({ deviceScaleFactor: 3 });

  test("caps backing-store DPR at 2", async ({ page }) => {
    await openTone(page);

    const metrics = await page
      .locator("[data-tone-waveform]")
      .evaluate((canvas: HTMLCanvasElement) => ({
        cssWidth: canvas.getBoundingClientRect().width,
        pixelWidth: canvas.width,
      }));

    expect(metrics.pixelWidth).toBeLessThanOrEqual(
      Math.ceil(metrics.cssWidth * 2) + 1,
    );
    expect(metrics.pixelWidth).toBeGreaterThanOrEqual(
      Math.floor(metrics.cssWidth * 1.9),
    );
  });
});
