import { expect, test, type Page } from "@playwright/test";

const primaryDesktopViewports = [
  { width: 1_366, height: 768, bottomAir: 24 },
  { width: 1_440, height: 900, bottomAir: 24 },
] as const;

const compactDesktopViewport = {
  width: 1_280,
  height: 720,
  bottomAir: 16,
} as const;

const mobileViewports = [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
] as const;

type SpatialRoute =
  | "/speaker-test"
  | "/stereo-test"
  | "/surround-sound-test"
  | "/phase-test";

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
}

async function expectSheetFitsViewport(
  page: Page,
  viewport: { width: number; height: number; bottomAir: number },
): Promise<void> {
  const sheet = page.locator("[data-sonic-instrument]");
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? viewport.height) + (box?.height ?? 0)).toBeLessThanOrEqual(
    viewport.height - viewport.bottomAir,
  );
  await expectNoHorizontalOverflow(page);
}

async function installExactFiveOneContext(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class FakeParam {
      value = 0;
      cancelAndHoldAtTime() {
        return this;
      }
      cancelScheduledValues() {
        return this;
      }
      setValueAtTime(value: number) {
        this.value = value;
        return this;
      }
      linearRampToValueAtTime(value: number) {
        this.value = value;
        return this;
      }
    }

    class FakeNode {
      connect(destination: unknown) {
        return destination;
      }
      disconnect() {}
    }

    class FakeGain extends FakeNode {
      gain = new FakeParam();
    }

    class FakeDestination extends FakeNode {
      maxChannelCount = 6;
      channelCount = 2;
      channelCountMode: ChannelCountMode = "max";
      channelInterpretation: ChannelInterpretation = "speakers";
    }

    class FakeAudioContext {
      currentTime = 10;
      sampleRate = 48_000;
      state = "suspended";
      destination = new FakeDestination();
      async resume() {
        this.state = "running";
      }
      async close() {
        this.state = "closed";
      }
      createGain() {
        return new FakeGain();
      }
      createChannelMerger() {
        return new FakeNode();
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: FakeAudioContext,
    });
  });
}

async function openChallengeState(page: Page, route: SpatialRoute): Promise<void> {
  if (route === "/surround-sound-test") {
    await installExactFiveOneContext(page);
  }

  await page.goto(route);

  if (route === "/speaker-test") {
    await page.getByRole("button", { name: "Bass / rattle", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Run bass / rattle sweep" }),
    ).toBeVisible();
    return;
  }

  if (route === "/stereo-test") {
    await page.locator("[data-stereo-test]").evaluate((element) => {
      element.setAttribute("data-stereo-visual", "return-from-right");
    });
    return;
  }

  if (route === "/surround-sound-test") {
    await page.getByRole("button", { name: "Check surround support" }).click();
    await expect(page.getByRole("button", { name: "Front Left" })).toBeVisible();
    return;
  }

  await page.locator("[data-phase-test]").evaluate((element) => {
    element.setAttribute("data-phase-mode", "inverted");
  });
}

const routes: SpatialRoute[] = [
  "/speaker-test",
  "/stereo-test",
  "/surround-sound-test",
  "/phase-test",
];

for (const viewport of [...primaryDesktopViewports, compactDesktopViewport]) {
  for (const route of routes) {
    test(`${route} challenge state fits ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openChallengeState(page, route);
      await expectSheetFitsViewport(page, viewport);
    });
  }
}

for (const viewport of mobileViewports) {
  for (const route of routes) {
    test(`${route} challenge state has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openChallengeState(page, route);
      await expectNoHorizontalOverflow(page);
    });
  }
}
