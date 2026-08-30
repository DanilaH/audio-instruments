import { expect, test } from "@playwright/test";

import { getPublicTools } from "../../src/registry/tools";

const indexedHtmlRoutes = [
  "/",
  "/privacy",
  ...getPublicTools().map((tool) => tool.route),
] as const;

for (const route of indexedHtmlRoutes) {
  test(`${route} stays noindex without a production indexing release`, async ({
    page,
  }) => {
    await page.goto(route);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex,nofollow",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });
}

test("default preview robots policy allows crawling without advertising a sitemap", async ({
  request,
}) => {
  const robotsResponse = await request.get("/robots.txt");

  expect(robotsResponse.status()).toBe(200);
  expect(robotsResponse.headers()["content-type"]).toContain("text/plain");
  expect(await robotsResponse.text()).toBe("User-agent: *\nAllow: /\n");

  const sitemapResponse = await request.get("/sitemap-index.xml");
  expect(sitemapResponse.status()).toBe(404);
});
