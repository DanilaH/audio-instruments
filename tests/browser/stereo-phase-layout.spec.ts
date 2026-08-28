import { expect, test, type Locator } from "@playwright/test";

async function expectInsideViewport(locator: Locator, height: number): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? height) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

for (const route of ["/stereo-test", "/phase-test"] as const) {
  test(`${route} has no horizontal overflow at 390x844`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    await expectNoHorizontalOverflow(page);
  });
}

test("Stereo keeps primary static actions inside the 390x844 viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/stereo-test");

  await expectInsideViewport(page.getByRole("button", { name: "Left" }), 844);
  await expectInsideViewport(page.getByRole("button", { name: "Center" }), 844);
  await expectInsideViewport(page.getByRole("button", { name: "Right" }), 844);
});

test("Stereo keeps a pan action and Stop inside the 1366x768 viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/stereo-test");

  await expectInsideViewport(page.getByRole("button", { name: "L → R" }), 768);
  await expectInsideViewport(page.getByRole("button", { name: "Stop" }), 768);
});

test("Phase keeps mode controls inside the 390x844 viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/phase-test");

  await expectInsideViewport(page.getByRole("button", { name: "In phase" }), 844);
  await expectInsideViewport(page.getByRole("button", { name: "Inverted" }), 844);
});

test("Phase keeps A/B and Stop inside the 1366x768 viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/phase-test");

  await expectInsideViewport(page.getByRole("button", { name: "A/B toggle" }), 768);
  await expectInsideViewport(page.getByRole("button", { name: "Stop" }), 768);
});
