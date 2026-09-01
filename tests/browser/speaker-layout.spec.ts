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

test("Speaker keeps mode navigation and Channel controls inside the 390x844 primary viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/speaker-test");

  for (const name of ["Channel", "Phase", "Sweep", "Bass / rattle"]) {
    await expectInsideViewport(
      page.getByRole("button", { name, exact: true }),
      844,
    );
  }
  await expectInsideViewport(
    page.getByRole("button", { name: "Left", exact: true }),
    844,
  );
  await expectInsideViewport(
    page.getByRole("button", { name: "Both", exact: true }),
    844,
  );
  await expectInsideViewport(
    page.getByRole("button", { name: "Right", exact: true }),
    844,
  );
  await expectNoHorizontalOverflow(page);
});

for (const scenario of [
  { mode: "Channel", action: "Run Left → Both → Right" },
  { mode: "Phase", action: "In phase" },
  { mode: "Sweep", action: "Run speaker sweep" },
  { mode: "Bass / rattle", action: "Run bass / rattle sweep" },
] as const) {
  test(`Speaker keeps ${scenario.mode} primary action and Stop inside 1366x768`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/speaker-test");
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

test("Speaker spatial anchors stay fixed across mode changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/speaker-test");
  const anchors = page.locator("[data-speaker-anchor]");
  const before = await anchors.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }),
  );
  for (const name of ["Phase", "Sweep", "Bass / rattle", "Channel"]) {
    await page.getByRole("button", { name, exact: true }).click();
    const after = await anchors.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      }),
    );
    expect(after).toEqual(before);
  }
});
