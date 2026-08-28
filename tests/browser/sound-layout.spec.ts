import { expect, test, type Locator } from "@playwright/test";

async function expectInsideViewport(
  locator: Locator,
  viewportHeight: number,
): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(
    (box?.y ?? viewportHeight) + (box?.height ?? 0),
  ).toBeLessThanOrEqual(viewportHeight);
}

test("Sound Test keeps channel controls inside the 390x844 primary viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sound-test");

  await expectInsideViewport(page.getByRole("button", { name: "Left" }), 844);
  await expectInsideViewport(page.getByRole("button", { name: "Both" }), 844);
  await expectInsideViewport(page.getByRole("button", { name: "Right" }), 844);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("Sound Test keeps guided Run and Stop actions inside the 1366x768 primary viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/sound-test");

  await expectInsideViewport(page.getByRole("button", { name: "Run sequence" }), 768);
  await expectInsideViewport(page.getByRole("button", { name: "Stop" }), 768);
});
