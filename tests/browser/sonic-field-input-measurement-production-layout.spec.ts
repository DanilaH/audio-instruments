import { expect, test, type Page } from "@playwright/test";

const desktopViewports = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
] as const;

const mobileViewports = [
  { width: 390, height: 844 },
  { width: 320, height: 844 },
] as const;

const tools = [
  {
    path: "/microphone-test",
    root: "[data-microphone-test]",
    field: ".mic-field",
    primary: "[data-mic-start]",
    stop: "[data-mic-stop]",
  },
  {
    path: "/decibel-meter",
    root: "[data-decibel-meter]",
    field: ".db-field",
    primary: "[data-db-start]",
    stop: "[data-db-stop]",
  },
  {
    path: "/pitch-detector",
    root: "[data-pitch-detector]",
    field: ".pitch-field",
    primary: "[data-pitch-start]",
    stop: "[data-pitch-stop]",
  },
] as const;

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

for (const tool of tools) {
  for (const viewport of desktopViewports) {
    test(`${tool.path} keeps the default Sonic Field workflow in ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(tool.path);

      const root = page.locator(tool.root);
      const sheet = root.locator("[data-sonic-instrument]");
      const field = root.locator(tool.field);
      const primary = root.locator(tool.primary);
      const stop = root.locator(tool.stop);

      await expect(sheet).toBeVisible();
      await expect(field).toBeVisible();
      await expect(primary).toBeVisible();
      await expect(stop).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const sheetBox = await sheet.boundingBox();
      const fieldBox = await field.boundingBox();
      const primaryBox = await primary.boundingBox();
      expect(sheetBox).not.toBeNull();
      expect(fieldBox).not.toBeNull();
      expect(primaryBox).not.toBeNull();

      if (sheetBox && fieldBox && primaryBox) {
        expect(fieldBox.y).toBeGreaterThanOrEqual(sheetBox.y);
        expect(primaryBox.y).toBeGreaterThan(fieldBox.y);
        expect(primaryBox.y + primaryBox.height).toBeLessThanOrEqual(
          viewport.height,
        );
      }
    });
  }

  for (const viewport of mobileViewports) {
    test(`${tool.path} keeps field-first mobile flow without horizontal overflow at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(tool.path);

      const root = page.locator(tool.root);
      const field = root.locator(tool.field);
      const primary = root.locator(tool.primary);
      await expect(field).toBeVisible();
      await expect(primary).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const fieldBox = await field.boundingBox();
      const primaryBox = await primary.boundingBox();
      expect(fieldBox).not.toBeNull();
      expect(primaryBox).not.toBeNull();
      if (fieldBox && primaryBox) {
        expect(fieldBox.y).toBeLessThan(viewport.height);
        expect(primaryBox.y).toBeGreaterThan(fieldBox.y);
      }
    });
  }
}

test("Microphone playback appears inside a reserved native-audio slot", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/microphone-test");

  const slot = page.locator(".mic-recording__playback-slot");
  const player = page.locator("[data-mic-playback]");
  const before = await slot.boundingBox();
  expect(before).not.toBeNull();

  await player.evaluate((element) => element.removeAttribute("hidden"));
  await expect(player).toBeVisible();
  const after = await slot.boundingBox();
  expect(after).not.toBeNull();

  if (before && after) {
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(2);
  }
});

test("Decibel calibration is optional and collapsed by default", async ({
  page,
}) => {
  await page.goto("/decibel-meter");
  const disclosure = page.locator("[data-db-calibration-disclosure]");
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(page.locator("[data-db-reference]")).not.toBeVisible();
  await disclosure.locator("summary").click();
  await expect(page.locator("[data-db-reference]")).toBeVisible();
});

for (const tool of tools) {
  test(`${tool.path} renders a CSS Stop shape instead of an icon-font stop glyph`, async ({
    page,
  }) => {
    await page.goto(tool.path);
    const stop = page.locator(tool.stop);
    await expect(stop.locator(".transport-stop-shape")).toBeVisible();
    await expect(stop.locator(".ph-stop")).toHaveCount(0);
  });
}
