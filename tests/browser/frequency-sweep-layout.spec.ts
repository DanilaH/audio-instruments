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

test("Frequency Sweep keeps its core interaction usable at every required viewport", async ({
  page,
}) => {
  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport);
    await page.goto("/frequency-sweep");

    const instrument = page.locator("[data-frequency-sweep]");
    await expect(instrument).toBeVisible();
    await expect(page.locator(".sweep-safety")).toBeVisible();
    await expect(page.locator("#frequency-sweep-low-number")).toBeVisible();
    await expect(page.locator("#frequency-sweep-high-number")).toBeVisible();
    await expect(page.locator("#frequency-sweep-duration")).toBeVisible();
    await expect(page.locator('[data-sweep-scale="logarithmic"]')).toBeVisible();
    await expect(page.locator('[data-sweep-direction="ascending"]')).toBeVisible();
    await expect(page.locator("[data-sweep-play]")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const playBox = await page.locator("[data-sweep-play]").boundingBox();
    const safetyBox = await page.locator(".sweep-safety").boundingBox();
    expect(playBox).not.toBeNull();
    expect(safetyBox).not.toBeNull();
    if (playBox && safetyBox) {
      expect(safetyBox.y).toBeGreaterThanOrEqual(0);
      expect(safetyBox.y + safetyBox.height).toBeLessThanOrEqual(viewport.height);
      expect(playBox.y).toBeGreaterThanOrEqual(0);
      expect(playBox.y + playBox.height).toBeLessThanOrEqual(viewport.height);
    }
  }
});
