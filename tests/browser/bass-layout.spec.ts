import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectInsideViewport(locator: Locator, height: number): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? height) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

test("Bass keeps its modes and primary single-tone action inside 390x844", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/bass-test");

  for (const name of ["Single tone", "Slow sweep", "Preset sequence"]) {
    await expectInsideViewport(page.getByRole("button", { name, exact: true }), 844);
  }
  await expectInsideViewport(
    page.getByRole("button", { name: "Play selected tone" }),
    844,
  );
  await expectNoHorizontalOverflow(page);
});

for (const scenario of [
  { mode: "Single tone", action: "Play selected tone" },
  { mode: "Slow sweep", action: "Run slow sweep" },
  { mode: "Preset sequence", action: "Run preset sequence" },
] as const) {
  test(`Bass keeps ${scenario.mode} action and Stop inside 1366x768`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/bass-test");
    await page.getByRole("button", { name: scenario.mode, exact: true }).click();

    await expectInsideViewport(page.getByRole("button", { name: scenario.action }), 768);
    await expectInsideViewport(page.getByRole("button", { name: "Stop" }), 768);
    await expectNoHorizontalOverflow(page);
  });
}
