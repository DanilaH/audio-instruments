import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 900, name: "large desktop" },
  { width: 1366, height: 768, name: "desktop" },
  { width: 1024, height: 768, name: "compact desktop" },
  { width: 390, height: 844, name: "mobile" },
]) {
  test(`${viewport.name} keeps Start reachable and avoids horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/spectrum-analyzer");

    const start = page.locator("[data-spectrum-start]");
    await expect(start).toBeVisible();

    const box = await start.boundingBox();
    expect(box).not.toBeNull();
    expect(
      (box?.y ?? viewport.height) + (box?.height ?? 0),
    ).toBeLessThanOrEqual(viewport.height);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
