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

type GeneratedRoute =
  | "/tone-generator"
  | "/frequency-sweep"
  | "/bass-test"
  | "/noise-generator"
  | "/sound-test";

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

    class FakeAudioBuffer {
      readonly channel: Float32Array;
      constructor(
        readonly numberOfChannels: number,
        readonly length: number,
        readonly sampleRate: number,
      ) {
        this.channel = new Float32Array(length);
      }
      getChannelData() {
        return this.channel;
      }
    }

    class FakeBufferSource extends FakeNode {
      buffer: AudioBuffer | null = null;
      loop = false;
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
      createBuffer(
        numberOfChannels: number,
        length: number,
        sampleRate: number,
      ) {
        return new FakeAudioBuffer(numberOfChannels, length, sampleRate);
      }
      createBufferSource() {
        return new FakeBufferSource();
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

async function openActiveState(
  page: Page,
  route: GeneratedRoute,
): Promise<void> {
  await installGeneratedSignalAudioContext(page);
  await page.goto(route);

  switch (route) {
    case "/tone-generator":
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page.locator("#tone-status")).toContainText("Playing");
      return;
    case "/frequency-sweep":
      await page
        .getByRole("button", { name: "Play sweep", exact: true })
        .click();
      await expect(page.locator("#frequency-sweep-status")).toHaveAttribute(
        "data-state",
        "playing",
      );
      return;
    case "/bass-test":
      await page.locator('[data-bass-mode="sweep"]').click();
      await page.locator("[data-bass-sweep-play]").click();
      await expect(page.locator("#bass-status")).toContainText(
        "Slow bass sweep running",
      );
      return;
    case "/noise-generator":
      await page.locator("[data-noise-play]").click();
      await expect(page.locator("#noise-generator-status")).toContainText(
        "White noise",
      );
      return;
    case "/sound-test":
      await page.locator('[data-sound-channel="left"]').click();
      await expect(page.locator("#sound-status")).toContainText("Playing Left");
      return;
  }
}

async function expectDesktopSheetFits(
  page: Page,
  viewport: { width: number; height: number; bottomAir: number },
): Promise<void> {
  const sheet = page.locator("[data-sonic-instrument]");
  await expect(sheet).toBeVisible();
  const bounds = await sheet.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
    };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(
    viewport.height - viewport.bottomAir,
  );
  await expectNoHorizontalOverflow(page);
}

function fieldSelector(route: GeneratedRoute): string {
  switch (route) {
    case "/tone-generator":
      return ".tone-field";
    case "/frequency-sweep":
      return ".sweep-field";
    case "/bass-test":
      return ".bass-field";
    case "/noise-generator":
      return ".noise-field";
    case "/sound-test":
      return ".sound-field";
  }
}

function actionSelector(route: GeneratedRoute): string {
  switch (route) {
    case "/tone-generator":
      return "#tone-play-stop";
    case "/frequency-sweep":
      return "[data-sweep-stop]";
    case "/bass-test":
      return "[data-bass-sweep-play]";
    case "/noise-generator":
      return "[data-noise-play]";
    case "/sound-test":
      return '[data-sound-channel="left"]';
  }
}

const routes: GeneratedRoute[] = [
  "/tone-generator",
  "/frequency-sweep",
  "/bass-test",
  "/noise-generator",
  "/sound-test",
];

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

      const field = page.locator(fieldSelector(route));
      const action = page.locator(actionSelector(route));
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

test("Sound Test active channel styling keeps speaker anchors fixed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1_366, height: 768 });
  await installGeneratedSignalAudioContext(page);
  await page.goto("/sound-test");

  const before = await page.locator(".sound-node").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  );
  await page.locator('[data-sound-channel="left"]').click();
  await expect(page.locator("[data-sound-test]")).toHaveAttribute(
    "data-active-channel",
    "left",
  );
  const after = await page.locator(".sound-node").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  );
  expect(after).toEqual(before);
});
