import { expect, test, type Page } from "@playwright/test";

const plannedRelatedRoutes = [
  "/frequency-sweep",
  "/bass-test",
  "/noise-generator",
  "/hearing-frequency-test",
] as const;

async function installDeterministicAudioContext(page: Page): Promise<void> {
  await page.addInitScript(() => {
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

      disconnect() {}
    }

    class FakeGainNode extends FakeAudioNode {
      gain = new FakeAudioParam();
    }

    class FakeOscillatorNode extends FakeAudioNode {
      frequency = new FakeAudioParam();
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
      sampleRate = 48_000;
      state = "suspended";
      destination = new FakeAudioNode();

      async resume() {
        this.state = "running";
      }

      async close() {
        this.state = "closed";
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
  });
}

async function openTone(page: Page): Promise<void> {
  await page.goto("/tone-generator");
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

  for (const route of plannedRelatedRoutes) {
    await expect(page.locator(`a[href="${route}"]`)).toHaveCount(0);
  }
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
  await expect(page.locator("[data-tone-frequency-readout]")).toContainText(
    "1,000 Hz",
  );

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

test("Tone primary interaction remains reachable in the 1366x768 first viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
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
    768,
  );
  expect((safetyBox?.y ?? 9999) + (safetyBox?.height ?? 0)).toBeLessThanOrEqual(
    768,
  );
});
