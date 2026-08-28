import { expect, test } from "@playwright/test";

import { getPublicTools, toolRegistry } from "../../src/registry/tools";

const plannedRoutes = toolRegistry
  .filter((tool) => tool.status === "planned")
  .map((tool) => tool.route);
const publicRoutes = getPublicTools().map((tool) => tool.route);

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
    await expect(
      page.locator(`.tool-grid--featured a[href="${route}"]`),
    ).toHaveCount(1);
    await expect(page.locator(`#tools a[href="${route}"]`)).toHaveCount(1);
  }

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
