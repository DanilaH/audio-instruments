import { expect, test, type Locator } from "@playwright/test";

async function expectInsideViewport(
  locator: Locator,
  height: number,
): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? height) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
}

async function expectNoHorizontalOverflow(
  page: import("@playwright/test").Page,
) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
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

test("Stereo keeps primary static actions inside the 390x844 viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/stereo-test");

  await expectInsideViewport(page.getByRole("button", { name: "Left" }), 844);
  await expectInsideViewport(page.getByRole("button", { name: "Center" }), 844);
  await expectInsideViewport(page.getByRole("button", { name: "Right" }), 844);
});

test("Stereo keeps a pan action and Stop inside the 1366x768 viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/stereo-test");

  await expectInsideViewport(page.getByRole("button", { name: "L → R" }), 768);
  await expectInsideViewport(page.getByRole("button", { name: "Stop" }), 768);
});

test("Stereo motion uses a delayed trailing echo and removes it for reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/stereo-test");
  await page.locator("[data-stereo-test]").evaluate((element) => {
    element.setAttribute("data-stereo-visual", "left-to-right");
  });

  const trailOne = page.locator(".stereo-track__trail--one");
  const trailTwo = page.locator(".stereo-track__trail--two");
  await expect(trailOne).toHaveCSS("animation-delay", "0.08s");
  await expect(trailTwo).toHaveCSS("animation-delay", "0.16s");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(trailOne).toHaveCSS("display", "none");
  await expect(page.locator(".stereo-track__signal")).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("Phase keeps mode controls inside the 390x844 viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/phase-test");

  await expectInsideViewport(
    page.getByRole("button", { name: "In phase" }),
    844,
  );
  await expectInsideViewport(
    page.getByRole("button", { name: "Inverted" }),
    844,
  );
});

test("Phase keeps A/B and Stop inside the 1366x768 viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/phase-test");

  await expectInsideViewport(
    page.getByRole("button", { name: "A/B toggle" }),
    768,
  );
  await expectInsideViewport(page.getByRole("button", { name: "Stop" }), 768);
});
