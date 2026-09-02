import { expect, test } from "@playwright/test";

const viewports = [
  { width: 1_440, height: 900 },
  { width: 1_366, height: 768 },
  { width: 1_280, height: 720 },
  { width: 1_024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`Audio Latency keeps its temporal workflow coherent at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/audio-latency-test");

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);

    const field = page.locator(".latency-field");
    const timeline = page.locator(".latency-timeline");
    const pulse = page.locator("[data-latency-pulse]");
    const marker = page.locator("[data-latency-offset-marker]");
    const start = page.locator("[data-latency-start]");
    const stop = page.locator("[data-latency-stop]");
    const offset = page.locator("[data-latency-offset]");
    const level = page.locator("[data-latency-level]");
    const detailsSummary = page.locator(".latency-reported summary");

    await expect(field).toBeVisible();
    await expect(timeline).toBeVisible();
    await expect(pulse).toBeVisible();
    await expect(marker).toBeVisible();
    await expect(start).toBeVisible();
    await expect(stop).toBeVisible();
    await expect(offset).toBeVisible();
    await expect(level).toHaveText("-24 dB");
    await expect(detailsSummary).toBeVisible();

    const offsetBox = await offset.boundingBox();
    expect(offsetBox).not.toBeNull();
    expect(offsetBox?.height ?? 0).toBeGreaterThanOrEqual(44 - 0.01);

    const timelineBox = await timeline.boundingBox();
    const pulseBox = await pulse.boundingBox();
    const markerBox = await marker.boundingBox();
    expect(timelineBox).not.toBeNull();
    expect(pulseBox).not.toBeNull();
    expect(markerBox).not.toBeNull();

    if (timelineBox && pulseBox && markerBox) {
      expect(pulseBox.x).toBeGreaterThanOrEqual(timelineBox.x);
      expect(pulseBox.x + pulseBox.width).toBeLessThanOrEqual(
        timelineBox.x + timelineBox.width,
      );
      expect(markerBox.x).toBeGreaterThanOrEqual(timelineBox.x);
      expect(markerBox.x + markerBox.width).toBeLessThanOrEqual(
        timelineBox.x + timelineBox.width,
      );
    }

    if (viewport.width <= 390) {
      const fieldBox = await field.boundingBox();
      const startBox = await start.boundingBox();
      expect(fieldBox).not.toBeNull();
      expect(startBox).not.toBeNull();
      if (fieldBox && startBox) {
        expect(startBox.y).toBeGreaterThanOrEqual(fieldBox.y);
        expect(startBox.y - (fieldBox.y + fieldBox.height)).toBeLessThanOrEqual(
          160,
        );
      }
    }
  });
}
