import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectInsideViewport(
  locator: Locator,
  height: number,
): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? height) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

test("Headphone keeps all six mode actions accessible without horizontal overflow at 390x844", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/headphone-test");

  for (const name of [
    "Left",
    "Right",
    "Both",
    "Phase",
    "Sweep",
    "Bass / rattle",
  ]) {
    await expectInsideViewport(
      page.getByRole("button", { name, exact: true }),
      844,
    );
  }
  await expectNoHorizontalOverflow(page);
});

for (const scenario of [
  { mode: "Phase", action: "In phase" },
  { mode: "Sweep", action: "Run headphone sweep" },
  { mode: "Bass / rattle", action: "Run bass / rattle sweep" },
] as const) {
  test(`Headphone keeps ${scenario.mode} action and Stop inside 1366x768`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/headphone-test");
    await page
      .getByRole("button", { name: scenario.mode, exact: true })
      .click();

    await expectInsideViewport(
      page.getByRole("button", { name: scenario.action }),
      768,
    );
    await expectInsideViewport(page.getByRole("button", { name: "Stop" }), 768);
    await expectNoHorizontalOverflow(page);
  });
}
