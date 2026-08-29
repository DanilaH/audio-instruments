import { expect, test } from "@playwright/test";

const viewports = [
  { width: 1_440, height: 900 },
  { width: 1_366, height: 768 },
  { width: 1_024, height: 768 },
  { width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`Decibel Meter layout is intentional at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/decibel-meter");

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);

    const start = page.locator("[data-db-start]");
    const stop = page.locator("[data-db-stop]");
    const primaryReadout = page.locator(".db-primary-readout");
    await expect(start).toBeVisible();
    await expect(stop).toBeVisible();
    await expect(primaryReadout).toBeVisible();

    const startBox = await start.boundingBox();
    expect(startBox).not.toBeNull();
    expect(
      (startBox?.y ?? viewport.height) + (startBox?.height ?? 0),
    ).toBeLessThanOrEqual(viewport.height);

    const readoutBox = await primaryReadout.boundingBox();
    expect(readoutBox).not.toBeNull();
    expect(
      (readoutBox?.x ?? -1) + (readoutBox?.width ?? viewport.width + 1),
    ).toBeLessThanOrEqual(viewport.width);
  });
}
