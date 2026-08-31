import { expect, test } from "@playwright/test";

import {
  getPublicTools,
  getPublicToolsByCategory,
  type NavigationCategory,
} from "../../src/registry/tools";

const featuredIds = [
  "tone-generator",
  "speaker-test",
  "microphone-test",
  "headphone-test",
] as const;

const categoryIds: readonly NavigationCategory[] = [
  "output",
  "signal-frequency",
  "input-analysis",
  "timing-specialist",
];

const targetViewports = [
  { width: 1_440, height: 900 },
  { width: 1_366, height: 768 },
  { width: 1_024, height: 768 },
  { width: 390, height: 844 },
] as const;

test("final homepage exposes the canonical featured four in order with distinct visuals", async ({
  page,
}) => {
  await page.goto("/");

  const featured = page.locator("[data-featured-tool]");
  await expect(featured).toHaveCount(4);

  const ids = await featured.evaluateAll((cards) =>
    cards.map((card) => card.getAttribute("data-featured-tool")),
  );
  expect(ids).toEqual(featuredIds);

  const visuals = await featured.evaluateAll((cards) =>
    cards.map((card) =>
      card
        .querySelector("[data-featured-visual]")
        ?.getAttribute("data-featured-visual"),
    ),
  );
  expect(visuals).toEqual([
    "tone-waveform",
    "speaker-cones",
    "microphone-waveform",
    "headphone-earcups",
  ]);
  expect(new Set(visuals).size).toBe(4);
});

test("final directory renders every live route once in the canonical registry category", async ({
  page,
}) => {
  await page.goto("/");

  const publicTools = getPublicTools();
  const directoryLinks = page.locator("#tools .tool-link");
  await expect(directoryLinks).toHaveCount(publicTools.length);

  const renderedIds = await directoryLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute("data-tool-id")),
  );
  expect(renderedIds).toHaveLength(new Set(renderedIds).size);
  expect(new Set(renderedIds)).toEqual(
    new Set(publicTools.map((tool) => tool.id)),
  );

  const categories = page.locator("[data-tool-category]");
  await expect(categories).toHaveCount(4);

  for (const categoryId of categoryIds) {
    const expectedTools = getPublicToolsByCategory(categoryId);
    expect(expectedTools.length).toBeGreaterThan(0);

    const category = page.locator(`[data-tool-category="${categoryId}"]`);
    await expect(category).toHaveCount(1);
    await expect(category).toHaveAttribute(
      "data-tool-count",
      String(expectedTools.length),
    );

    const actualIds = await category
      .locator("[data-tool-id]")
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute("data-tool-id")),
      );
    expect(actualIds).toEqual(expectedTools.map((tool) => tool.id));
  }
});

for (const viewport of targetViewports) {
  test(`final homepage composition stays bounded at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const bounds = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth);

    await expect(page.locator("[data-featured-tool]")).toHaveCount(4);
    await expect(page.locator("[data-tool-category]")).toHaveCount(4);

    const featuredColumns = await page
      .locator(".tool-grid--featured")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
    const categoryColumns = await page
      .locator(".tool-categories")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );

    if (viewport.width <= 820) {
      expect(featuredColumns).toBe(1);
      expect(categoryColumns).toBe(1);
    } else {
      expect(featuredColumns).toBe(2);
      expect(categoryColumns).toBe(2);
    }

    const lastFeatured = page.locator('[data-featured-tool="headphone-test"]');
    const lastFeaturedBox = await lastFeatured.boundingBox();
    expect(lastFeaturedBox).not.toBeNull();
    expect(
      (lastFeaturedBox?.x ?? viewport.width) + (lastFeaturedBox?.width ?? 0),
    ).toBeLessThanOrEqual(viewport.width);

    if (viewport.width <= 520) {
      const rightEarcupBox = await page
        .locator(".featured-headphone__ear--right")
        .boundingBox();
      const headphoneLabelBox = await page
        .locator(".featured-headphone small")
        .boundingBox();

      expect(rightEarcupBox).not.toBeNull();
      expect(headphoneLabelBox).not.toBeNull();
      expect(
        (rightEarcupBox?.y ?? Number.POSITIVE_INFINITY) +
          (rightEarcupBox?.height ?? 0),
      ).toBeLessThanOrEqual(headphoneLabelBox?.y ?? 0);
    }
  });
}

test("desktop category composition gives dense groups more space without stretching the specialist panel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1_366, height: 768 });
  await page.goto("/");

  const inputBox = await page
    .locator('[data-tool-category="input-analysis"]')
    .boundingBox();
  const timingBox = await page
    .locator('[data-tool-category="timing-specialist"]')
    .boundingBox();

  expect(inputBox).not.toBeNull();
  expect(timingBox).not.toBeNull();
  expect(inputBox?.width ?? 0).toBeGreaterThan(timingBox?.width ?? 0);
  expect(timingBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(
    inputBox?.height ?? 0,
  );
});

test("reduced motion disables decorative homepage transitions", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  for (const selector of [
    ".hero__primary-action",
    ".featured-card",
    ".tool-link",
  ]) {
    const durations = await page
      .locator(selector)
      .first()
      .evaluate((element) =>
        getComputedStyle(element).transitionDuration.split(", "),
      );

    expect(durations.every((duration) => duration === "0s")).toBe(true);
  }
});
