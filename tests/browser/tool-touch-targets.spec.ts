import { expect, test, type Page } from "@playwright/test";

const targetViewports = [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
] as const;

const touchTargetCases = [
  { path: "/tone-generator", selectors: [".tone-presets button"] },
  {
    path: "/bass-test",
    selectors: [".bass-mode-selector button", ".bass-presets button"],
  },
  {
    path: "/frequency-sweep",
    selectors: [
      "#frequency-sweep-duration",
      "[data-frequency-sweep] [data-frequency-number]",
      "[data-frequency-sweep] [data-frequency-slider]",
      "[data-frequency-sweep] .sweep-selector button",
    ],
  },
  { path: "/noise-generator", selectors: [".noise-selector button"] },
  { path: "/speaker-test", selectors: [".speaker-field input"] },
  {
    path: "/microphone-test",
    selectors: [".mic-input-field select", ".mic-details summary"],
  },
  {
    path: "/spectrum-analyzer",
    selectors: [".spectrum-field select", ".spectrum-view-switch button"],
  },
  { path: "/pitch-detector", selectors: [".pitch-field select"] },
  {
    path: "/decibel-meter",
    selectors: [
      ".db-field select",
      ".db-reference-input input",
      ".db-calibrate",
      ".db-details summary",
    ],
  },
] as const;

interface TargetMetric {
  minHeight: number;
  renderedHeight: number;
  visible: boolean;
}

async function readTargetMetrics(
  page: Page,
  selector: string,
): Promise<TargetMetric[]> {
  return page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const parsedMinHeight = Number.parseFloat(style.minHeight);
      return {
        minHeight: Number.isFinite(parsedMinHeight) ? parsedMinHeight : 0,
        renderedHeight: rect.height,
        visible:
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0,
      };
    }),
  );
}

test("tool-local controls keep a 44px touch target", async ({ page }) => {
  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport);

    for (const targetCase of touchTargetCases) {
      await page.goto(targetCase.path);

      for (const selector of targetCase.selectors) {
        const metrics = await readTargetMetrics(page, selector);
        expect(
          metrics.length,
          `${targetCase.path} ${selector} should exist`,
        ).toBeGreaterThan(0);

        for (const metric of metrics) {
          expect(
            metric.minHeight,
            `${targetCase.path} ${selector} should keep a 44px CSS floor`,
          ).toBeGreaterThanOrEqual(44);

          if (metric.visible) {
            expect(
              metric.renderedHeight,
              `${targetCase.path} ${selector} should render at least 44px tall`,
            ).toBeGreaterThanOrEqual(44);
          }
        }
      }
    }
  }
});

test("native microphone playback keeps a 44px outer height", async ({
  page,
}) => {
  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport);
    await page.goto("/microphone-test");

    const player = page.locator(".mic-recording audio[controls]");
    await player.evaluate((element) => element.removeAttribute("hidden"));

    const box = await player.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
});
