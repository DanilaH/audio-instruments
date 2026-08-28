import { expect, test } from "@playwright/test";

const plannedRelatedRoutes = [
  "/frequency-sweep",
  "/bass-test",
  "/noise-generator",
  "/hearing-frequency-test",
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto("/tone-generator");
});

test("Tone Generator exposes the safe idle baseline", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Tone Generator", level: 1 }),
  ).toBeVisible();
  await expect(page.locator("#tone-status")).toContainText("Idle");
  await expect(page.locator("#tone-frequency-number")).toHaveValue("440");
  await expect(page.locator("#tone-level")).toHaveValue("-24");
  await expect(
    page.getByText("Start with your device/headphone volume low."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

  for (const route of plannedRelatedRoutes) {
    await expect(page.locator(`a[href="${route}"]`)).toHaveCount(0);
  }
});

test("Tone Generator supports live controls and explicit Stop", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  const playStop = page.locator("#tone-play-stop");
  await playStop.click();

  await expect(page.locator("#tone-status")).toContainText("Playing");
  await expect(playStop).toContainText("Stop");

  const frequency = page.locator("#tone-frequency-number");
  await frequency.fill("1000");
  await expect(frequency).toHaveValue("1000");
  await expect(page.locator("[data-tone-frequency-readout]")).toContainText(
    "Hz",
  );

  await page.getByLabel("Square").check();
  await expect(page.getByLabel("Square")).toBeChecked();

  await page.getByLabel("Left").check();
  await expect(page.getByLabel("Left")).toBeChecked();

  await playStop.click();
  await expect(page.locator("#tone-status")).toContainText("Idle");
  await expect(playStop).toContainText("Play");
  expect(pageErrors).toEqual([]);
});

test("Tone primary interaction remains reachable in the 1366x768 first viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/tone-generator");

  const instrument = page.locator(
    '[aria-label="Tone Generator controls and waveform"]',
  );
  const playStop = page.locator("#tone-play-stop");

  await expect(instrument).toBeVisible();
  await expect(playStop).toBeVisible();

  const playBox = await playStop.boundingBox();
  expect(playBox).not.toBeNull();
  expect((playBox?.y ?? 9999) + (playBox?.height ?? 0)).toBeLessThanOrEqual(
    768,
  );
});
