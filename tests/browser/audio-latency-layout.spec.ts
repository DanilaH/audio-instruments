import { expect, test } from "@playwright/test";

const viewports = [
  { width: 1_440, height: 900 },
  { width: 1_366, height: 768 },
  { width: 1_024, height: 768 },
  { width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`Audio Latency layout is intentional at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/audio-latency-test");

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);

    const start = page.locator("[data-latency-start]");
    const stop = page.locator("[data-latency-stop]");
    const pulse = page.locator("[data-latency-pulse]");
    const offset = page.locator("[data-latency-offset]");
    const level = page.locator("[data-latency-level]");

    await expect(start).toBeVisible();
    await expect(stop).toBeVisible();
    await expect(pulse).toBeVisible();
    await expect(offset).toBeVisible();
    await expect(level).toHaveText("-24 dB");

    const startBox = await start.boundingBox();
    expect(startBox).not.toBeNull();
    expect(
      (startBox?.y ?? viewport.height) + (startBox?.height ?? 0),
    ).toBeLessThanOrEqual(viewport.height);

    const offsetBox = await offset.boundingBox();
    expect(offsetBox).not.toBeNull();
    expect(offsetBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    const pulseBox = await pulse.boundingBox();
    expect(pulseBox).not.toBeNull();
    expect(pulseBox?.width ?? 0).toBeGreaterThanOrEqual(80);
    expect(
      (pulseBox?.x ?? -1) + (pulseBox?.width ?? viewport.width + 1),
    ).toBeLessThanOrEqual(viewport.width);
  });
}
