import { expect, test } from "@playwright/test";

test("reference calibration controls are secondary until the user opens them", async ({
  page,
}) => {
  await page.goto("/decibel-meter");

  const disclosure = page.locator("[data-db-calibration-disclosure]");
  const reference = page.locator("[data-db-reference]");
  const weighting = page.locator("[data-db-weighting-confirm]");
  const calibrate = page.locator("[data-db-calibrate]");

  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(reference).not.toBeVisible();
  await expect(weighting).not.toBeVisible();
  await expect(calibrate).not.toBeVisible();

  await disclosure.locator("summary").click();

  await expect(reference).toBeVisible();
  await expect(weighting).toBeVisible();
  await expect(calibrate).toBeVisible();
});
