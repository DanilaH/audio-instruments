import { expect, test } from "@playwright/test";

test("default preview stays crawlable while pages remain noindex", async ({
  page,
  request,
}) => {
  await page.goto("/");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);

  const robotsResponse = await request.get("/robots.txt");
  expect(robotsResponse.status()).toBe(200);
  expect(robotsResponse.headers()["content-type"]).toContain("text/plain");
  expect(await robotsResponse.text()).toBe("User-agent: *\nAllow: /\n");
});
