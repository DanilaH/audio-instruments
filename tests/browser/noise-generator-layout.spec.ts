import { expect, test, type Page } from "@playwright/test";

const targetViewports = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
] as const;

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

test("Noise Generator keeps safety and its primary controls in the natural first-use viewport", async ({
  page,
}) => {
  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport);
    await page.goto("/noise-generator");

    await expect(page.locator("[data-noise-generator]")).toBeVisible();
    await expect(page.locator(".noise-safety")).toBeVisible();
    await expect(page.locator('[data-noise-kind="white"]')).toBeVisible();
    await expect(page.locator('[data-noise-kind="pink"]')).toBeVisible();
    await expect(page.locator('[data-noise-kind="brown"]')).toBeVisible();
    await expect(page.locator('[data-noise-timer="0"]')).toBeVisible();
    await expect(page.locator('[data-noise-timer="10"]')).toBeVisible();
    await expect(page.locator("[data-noise-play]")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const safetyBox = await page.locator(".noise-safety").boundingBox();
    const playBox = await page.locator("[data-noise-play]").boundingBox();
    expect(safetyBox).not.toBeNull();
    expect(playBox).not.toBeNull();
    if (safetyBox && playBox) {
      expect(safetyBox.y).toBeGreaterThanOrEqual(0);
      expect(safetyBox.y + safetyBox.height).toBeLessThanOrEqual(viewport.height);
      expect(playBox.y).toBeGreaterThanOrEqual(0);
      expect(playBox.y + playBox.height).toBeLessThanOrEqual(viewport.height);
    }
  }
});
