import { expect, test } from "@playwright/test";

import {
  getPublicTools,
  toolRegistry,
  type ToolDefinition,
} from "../../src/registry/tools";

const plannedTools = toolRegistry.filter((tool) => tool.status === "planned");
const plannedRoutes = plannedTools.map((tool) => tool.route);
const publicTools = getPublicTools();
const publicRoutes = publicTools.map((tool) => tool.route);
const toneGenerator = publicTools.find((tool) => tool.id === "tone-generator");
const featuredTargetIds = [
  "tone-generator",
  "speaker-test",
  "microphone-test",
  "headphone-test",
] as const;
const featuredTools = featuredTargetIds
  .map((id) => toolRegistry.find((tool) => tool.id === id))
  .filter((tool): tool is ToolDefinition => tool !== undefined);
const featuredRoutes = featuredTools
  .filter((tool) => tool.status === "live")
  .map((tool) => tool.route);
const plannedFeaturedTools = featuredTools.filter(
  (tool) => tool.status === "planned",
);

const targetViewports = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
] as const;

for (const path of ["/", "/privacy", ...publicRoutes]) {
  test(`${path} renders without page errors`, async ({ page }) => {
    const errors: Error[] = [];
    page.on("pageerror", (error) => errors.push(error));

    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).toBeVisible();

    expect(errors).toEqual([]);
  });

  for (const viewport of targetViewports) {
    test(`${path} has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);

      const hasOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );

      expect(hasOverflow).toBe(false);
    });
  }
}

test("homepage exposes live tools while keeping planned tools invisible", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator('a[href="/#tools"]')).toHaveCount(
    publicRoutes.length > 0 ? 1 : 0,
  );

  for (const route of publicRoutes) {
    await expect(page.locator(`#tools a[href="${route}"]`)).toHaveCount(1);
  }

  for (const route of featuredRoutes) {
    await expect(
      page.locator(`.tool-grid--featured a[href="${route}"]`),
    ).toHaveCount(1);
  }

  for (const route of publicRoutes.filter(
    (route) => !featuredRoutes.includes(route),
  )) {
    await expect(
      page.locator(`.tool-grid--featured a[href="${route}"]`),
    ).toHaveCount(0);
  }

  for (const tool of plannedFeaturedTools) {
    await expect(
      page.locator(".tool-grid--featured").getByText(tool.title, {
        exact: true,
      }),
    ).toHaveCount(0);
  }

  for (const route of plannedRoutes) {
    await expect(page.locator(`a[href="${route}"]`)).toHaveCount(0);
  }
});

test("homepage applies the Tone visual system without turning the directory into duplicate cards", async ({
  page,
}) => {
  test.skip(!toneGenerator, "Tone Generator is not live yet");
  if (!toneGenerator) return;

  await page.goto("/");

  const heroAction = page.getByRole("link", { name: "Open Tone Generator" });
  await expect(heroAction).toHaveAttribute("href", toneGenerator.route);
  await expect(
    page.getByRole("img", {
      name: "Stylized 440 hertz sine-wave reference signal",
    }),
  ).toBeVisible();

  const featuredTone = page.locator(
    `.featured-card--tone[href="${toneGenerator.route}"]`,
  );
  await expect(featuredTone).toHaveCount(1);
  await expect(featuredTone).toContainText("440");
  await expect(featuredTone).toContainText("Sine · Both");

  await expect(
    page.locator(`#tools .tool-link[href="${toneGenerator.route}"]`),
  ).toHaveCount(1);
  await expect(page.locator("#tools .featured-card--tone")).toHaveCount(0);
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
] as const) {
  test(`homepage Tone primary action stays in the first viewport at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    test.skip(!toneGenerator, "Tone Generator is not live yet");
    if (!toneGenerator) return;

    await page.setViewportSize(viewport);
    await page.goto("/");

    const heroAction = page.getByRole("link", { name: "Open Tone Generator" });
    await expect(heroAction).toBeVisible();

    const box = await heroAction.boundingBox();
    expect(box).not.toBeNull();
    expect(
      (box?.y ?? viewport.height) + (box?.height ?? 0),
    ).toBeLessThanOrEqual(viewport.height);
  });
}

test("homepage hero typography stays continuous around the 520px viewport boundary", async ({
  page,
}) => {
  const readHeadingFontSize = async (width: number) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    return page
      .locator(".hero h1")
      .evaluate((heading) =>
        Number.parseFloat(window.getComputedStyle(heading).fontSize),
      );
  };

  const fontSizeAt520 = await readHeadingFontSize(520);
  const fontSizeAt521 = await readHeadingFontSize(521);

  expect(Math.abs(fontSizeAt520 - fontSizeAt521)).toBeLessThanOrEqual(2);
});

test("planned tool routes are not built", async ({ page }) => {
  for (const route of plannedRoutes) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(404);
  }
});
