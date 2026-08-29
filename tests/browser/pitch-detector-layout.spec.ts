import { expect, test } from "@playwright/test";

const viewports = [
  { width: 1_440, height: 900 },
  { width: 1_366, height: 768 },
  { width: 1_024, height: 768 },
  { width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`Pitch Detector layout is intentional at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/pitch-detector");

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);

    const start = page.locator("[data-pitch-start]");
    const stop = page.locator("[data-pitch-stop]");
    const result = page.locator(".pitch-result");
    await expect(start).toBeVisible();
    await expect(stop).toBeVisible();
    await expect(result).toBeVisible();

    const startBox = await start.boundingBox();
    expect(startBox).not.toBeNull();
    expect((startBox?.y ?? viewport.height) + (startBox?.height ?? 0)).toBeLessThanOrEqual(
      viewport.height,
    );

    const resultBox = await result.boundingBox();
    expect(resultBox).not.toBeNull();
    expect((resultBox?.x ?? -1) + (resultBox?.width ?? viewport.width + 1)).toBeLessThanOrEqual(
      viewport.width,
    );
  });
}
