import { expect, test } from "@playwright/test";

const viewports = [
  { width: 1_440, height: 900 },
  { width: 1_366, height: 768 },
  { width: 1_024, height: 768 },
  { width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`Hearing Frequency layout is intentional at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/hearing-frequency-test");

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);

    const reference = page.locator("[data-hearing-reference]");
    const stop = page.locator("[data-hearing-stop]");
    const field = page.locator(".hearing-field");
    const readout = page.locator(".hearing-current");
    const result = page.locator(".hearing-observation");
    const decisionSlot = page.locator(".hearing-decision-slot");

    await expect(reference).toBeVisible();
    await expect(stop).toBeVisible();
    await expect(field).toBeVisible();
    await expect(readout).toBeVisible();
    await expect(result).toBeVisible();
    await expect(decisionSlot).toBeVisible();

    const referenceBox = await reference.boundingBox();
    expect(referenceBox).not.toBeNull();
    if (viewport.width >= 768) {
      expect(
        (referenceBox?.y ?? viewport.height) + (referenceBox?.height ?? 0),
      ).toBeLessThanOrEqual(viewport.height);
    }

    const readoutBox = await readout.boundingBox();
    expect(readoutBox).not.toBeNull();
    expect(
      (readoutBox?.x ?? -1) + (readoutBox?.width ?? viewport.width + 1),
    ).toBeLessThanOrEqual(viewport.width);
  });
}
