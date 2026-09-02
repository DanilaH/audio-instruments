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

type GeneratedRoute = "/tone-generator" | "/frequency-sweep";

async function installGeneratedSignalAudioContext(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class FakeParam {
      value = 1;
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
      exponentialRampToValueAtTime(value: number) {
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

    class FakeOscillator extends FakeNode {
      frequency = new FakeParam();
      type = "sine";
      start() {}
      stop() {}
      addEventListener() {}
    }

    class FakeAudioContext {
      currentTime = 10;
      sampleRate = 48_000;
      state = "suspended";
      destination = new FakeNode();
      async resume() {
        this.state = "running";
      }
      async close() {
        this.state = "closed";
      }
      createGain() {
        return new FakeGain();
      }
      createOscillator() {
        return new FakeOscillator();
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

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
}

async function openActiveState(page: Page, route: GeneratedRoute): Promise<void> {
  await installGeneratedSignalAudioContext(page);
  await page.goto(route);

  if (route === "/tone-generator") {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.locator("#tone-status")).toContainText("Playing");
    return;
  }

  await page.getByRole("button", { name: "Play sweep", exact: true }).click();
  await expect(page.locator("#frequency-sweep-status")).toContainText("Playing");
  await expect(page.locator("[data-frequency-sweep]")).toHaveAttribute(
    "data-sweep-visual",
    "playing",
  );
}

async function expectDesktopSheetFits(
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

const routes: GeneratedRoute[] = ["/tone-generator", "/frequency-sweep"];

for (const viewport of [...primaryDesktopViewports, compactDesktopViewport]) {
  for (const route of routes) {
    test(`${route} active state fits ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openActiveState(page, route);
      await expectDesktopSheetFits(page, viewport);
    });
  }
}

for (const viewport of mobileViewports) {
  for (const route of routes) {
    test(`${route} active state has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openActiveState(page, route);
      await expectNoHorizontalOverflow(page);

      const field = page.locator(
        route === "/tone-generator" ? ".tone-field" : ".sweep-field",
      );
      const action = page.locator(
        route === "/tone-generator" ? "#tone-play-stop" : "[data-sweep-stop]",
      );
      const fieldBox = await field.boundingBox();
      const actionBox = await action.boundingBox();
      expect(fieldBox).not.toBeNull();
      expect(actionBox).not.toBeNull();
      if (fieldBox && actionBox) {
        expect(actionBox.y).toBeGreaterThan(fieldBox.y);
      }
    });
  }
}
