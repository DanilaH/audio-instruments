import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 390, height: 844, name: "mobile" },
  { width: 1366, height: 768, name: "desktop" },
]) {
  test(`${viewport.name} keeps the primary microphone action reachable without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/microphone-test");

    const start = page.locator("[data-mic-start]");
    await expect(start).toBeVisible();

    const startBox = await start.boundingBox();
    expect(startBox).not.toBeNull();
    expect(startBox!.y + startBox!.height).toBeLessThanOrEqual(viewport.height);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
