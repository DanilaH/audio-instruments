import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
] as const) {
  test(`Speaker Bass review state ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/speaker-test");
    await page.getByRole("button", { name: "Bass / rattle", exact: true }).click();
    for (const name of ["Left", "Both", "Right"] as const) {
      await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
    }
    await page.screenshot({
      path: `artifacts/pr2-review/speaker-bass-${viewport.width}x${viewport.height}.png`,
    });
  });

  test(`Stereo idle review state ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/stereo-test");
    await expect(page.locator('[data-stereo-action][aria-pressed="true"]')).toHaveCount(0);
    await page.screenshot({
      path: `artifacts/pr2-review/stereo-idle-${viewport.width}x${viewport.height}.png`,
    });
  });
}
