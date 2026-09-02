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

test("Stereo exposes direct field targets and a deterministic natural return animation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/stereo-test");
  await expect(page.locator("[data-sonic-instrument]")).toHaveCount(1);
  await expect(page.locator("[data-stereo-action]")).toHaveCount(5);
  await page.locator("[data-stereo-test]").evaluate((element) => {
    element.setAttribute("data-stereo-visual", "return-from-right");
  });
  await expect(page.locator(".stereo-track__signal")).toHaveCSS(
    "animation-name",
    "stereo-return-right",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".stereo-track__signal")).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("Phase visual polarity states keep one stable Sonic Field relationship stage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/phase-test");
  await expect(page.locator("[data-sonic-instrument]")).toHaveCount(1);
  const stage = page.locator("[data-phase-stage]");
  const before = await stage.boundingBox();
  expect(before).not.toBeNull();

  const phaseRoot = page.locator("[data-phase-test]");
  await phaseRoot.evaluate((element) => {
    element.setAttribute("data-phase-mode", "in-phase");
  });
  const inPhase = await stage.boundingBox();
  await phaseRoot.evaluate((element) => {
    element.setAttribute("data-phase-mode", "inverted");
  });
  const inverted = await stage.boundingBox();

  expect(inPhase).toEqual(before);
  expect(inverted).toEqual(before);
  await expect(
    page.getByText(
      "Relationship cue only — not a measured waveform or a physical wiring diagnosis.",
    ),
  ).toBeVisible();
});

test("Stereo neutral center is not exposed as an active playback selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/stereo-test");

  await expect(
    page.locator('[data-stereo-action][aria-pressed="true"]'),
  ).toHaveCount(0);
  await expect(page.locator("[data-stereo-position-label]")).toHaveText("None");
  await expect(page.locator("[data-stereo-test]")).toHaveAttribute(
    "data-stereo-visual",
    "center",
  );
});
