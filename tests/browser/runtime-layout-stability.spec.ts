import { expect, test, type Page } from "@playwright/test";

const mobileViewport = { width: 320, height: 844 } as const;

const modeCases = [
  { route: "/speaker-test", selector: "[data-speaker-mode]" },
  { route: "/headphone-test", selector: "[data-headphone-mode]" },
  { route: "/bass-test", selector: ".bass-modes button" },
  { route: "/noise-generator", selector: ".noise-selector button" },
  { route: "/frequency-sweep", selector: ".sweep-selector button" },
  { route: "/spectrum-analyzer", selector: ".spectrum-view-switch button" },
] as const;

async function nextLayout(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function layoutMetrics(page: Page) {
  return page.evaluate(() => {
    const surface = document
      .querySelector(".instrument-surface, [data-sonic-instrument]")
      ?.getBoundingClientRect();
    return {
      surfaceHeight: surface?.height ?? null,
      documentHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
}

for (const modeCase of modeCases) {
  test(`${modeCase.route} keeps its mobile instrument footprint stable across modes`, async ({
    page,
  }) => {
    await page.setViewportSize(mobileViewport);
    await page.goto(modeCase.route);
    const count = await page.locator(modeCase.selector).count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      await page.goto(modeCase.route);
      const button = page.locator(modeCase.selector).nth(index);
      if (!(await button.isVisible()) || (await button.isDisabled())) continue;

      const before = await layoutMetrics(page);
      await button.click();
      await nextLayout(page);
      const after = await layoutMetrics(page);

      expect(after.scrollWidth).toBeLessThanOrEqual(after.clientWidth);
      expect(before.surfaceHeight).not.toBeNull();
      expect(after.surfaceHeight).not.toBeNull();
      expect(
        Math.abs((after.surfaceHeight ?? 0) - (before.surfaceHeight ?? 0)),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(after.documentHeight - before.documentHeight),
      ).toBeLessThanOrEqual(1);

      const buttonMetrics = await button.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          viewportWidth: document.documentElement.clientWidth,
        };
      });
      expect(buttonMetrics.left).toBeGreaterThanOrEqual(0);
      expect(buttonMetrics.right).toBeLessThanOrEqual(
        buttonMetrics.viewportWidth,
      );
      expect(buttonMetrics.scrollWidth).toBeLessThanOrEqual(
        buttonMetrics.clientWidth + 1,
      );
    }
  });
}

test("Audio Latency offset extremes do not reflow the 320px instrument", async ({
  page,
}) => {
  await page.setViewportSize(mobileViewport);
  await page.goto("/audio-latency-test");

  const before = await layoutMetrics(page);
  await page.locator("[data-latency-offset]").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "-300";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await nextLayout(page);
  const after = await layoutMetrics(page);

  await expect(page.locator("[data-latency-offset-value]")).toHaveText([
    "−300 ms",
    "−300 ms",
  ]);
  expect(after.scrollWidth).toBeLessThanOrEqual(after.clientWidth);
  expect(before.surfaceHeight).not.toBeNull();
  expect(after.surfaceHeight).not.toBeNull();
  expect(
    Math.abs((after.surfaceHeight ?? 0) - (before.surfaceHeight ?? 0)),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(after.documentHeight - before.documentHeight),
  ).toBeLessThanOrEqual(1);
});
