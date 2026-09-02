import { expect, test, type Page } from "@playwright/test";

const desktopViewports = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
] as const;

const mobileViewports = [{ width: 390, height: 844 }] as const;

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function expectPrimaryNoiseControls(page: Page): Promise<void> {
  await expect(page.locator("[data-noise-generator]")).toBeVisible();
  await expect(page.locator(".noise-safety")).toBeVisible();
  await expect(page.locator('button[data-noise-kind="white"]')).toBeVisible();
  await expect(page.locator('button[data-noise-kind="pink"]')).toBeVisible();
  await expect(page.locator('button[data-noise-kind="brown"]')).toBeVisible();
  await expect(page.locator('button[data-noise-timer="0"]')).toBeVisible();
  await expect(page.locator('button[data-noise-timer="10"]')).toBeVisible();
  await expect(page.locator("[data-noise-play]")).toBeVisible();
}

for (const viewport of desktopViewports) {
  test(`Noise Generator keeps safety and primary controls in the ${viewport.width}x${viewport.height} desktop viewport`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/noise-generator");

    await expectPrimaryNoiseControls(page);
    await expectNoHorizontalOverflow(page);

    const safetyBox = await page.locator(".noise-safety").boundingBox();
    const playBox = await page.locator("[data-noise-play]").boundingBox();
    expect(safetyBox).not.toBeNull();
    expect(playBox).not.toBeNull();
    if (safetyBox && playBox) {
      expect(safetyBox.y).toBeGreaterThanOrEqual(0);
      expect(safetyBox.y + safetyBox.height).toBeLessThanOrEqual(
        viewport.height,
      );
      expect(playBox.y).toBeGreaterThanOrEqual(0);
      expect(playBox.y + playBox.height).toBeLessThanOrEqual(viewport.height);
    }
  });
}

for (const viewport of mobileViewports) {
  test(`Noise Generator keeps the mobile field and primary workflow ahead of secondary safety content at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/noise-generator");

    await expectPrimaryNoiseControls(page);
    await expectNoHorizontalOverflow(page);

    const fieldBox = await page.locator(".noise-field").boundingBox();
    const playBox = await page.locator("[data-noise-play]").boundingBox();
    const safetyBox = await page.locator(".noise-safety").boundingBox();
    expect(fieldBox).not.toBeNull();
    expect(playBox).not.toBeNull();
    expect(safetyBox).not.toBeNull();
    if (fieldBox && playBox && safetyBox) {
      expect(fieldBox.y).toBeGreaterThanOrEqual(0);
      expect(fieldBox.y).toBeLessThan(viewport.height);
      expect(playBox.y).toBeGreaterThan(fieldBox.y);
      expect(safetyBox.y).toBeGreaterThan(playBox.y);
    }
  });
}
