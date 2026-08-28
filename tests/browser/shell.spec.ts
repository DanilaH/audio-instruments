import { expect, test } from "@playwright/test";

const plannedRoutes = [
  "/sound-test",
  "/speaker-test",
  "/headphone-test",
  "/stereo-test",
  "/phase-test",
  "/surround-sound-test",
  "/bass-test",
  "/tone-generator",
  "/frequency-sweep",
  "/noise-generator",
  "/microphone-test",
  "/spectrum-analyzer",
  "/pitch-detector",
  "/decibel-meter",
  "/audio-latency-test",
  "/hearing-frequency-test",
];

for (const path of ["/", "/privacy"]) {
  test(`${path} renders without page errors`, async ({ page }) => {
    const errors: Error[] = [];
    page.on("pageerror", (error) => errors.push(error));

    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();

    expect(errors).toEqual([]);
  });
}

test("homepage exposes no planned tool links", async ({ page }) => {
  await page.goto("/");

  for (const route of plannedRoutes) {
    await expect(page.locator(`a[href="${route}"]`)).toHaveCount(0);
  }
});

test("planned tool routes are not built", async ({ page }) => {
  for (const route of plannedRoutes) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(404);
  }
});

test("desktop shell has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");

  const hasOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );

  expect(hasOverflow).toBe(false);
});
