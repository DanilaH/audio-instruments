import { expect, test, type Locator, type Page } from "@playwright/test";

const primaryDesktopViewports = [
  { width: 1_366, height: 768, bottomAir: 24 },
  { width: 1_440, height: 900, bottomAir: 24 },
] as const;

const compactDesktopViewport = {
  width: 1_280,
  height: 720,
  bottomAir: 16,
} as const;

const mobileViewports = [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
] as const;

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
}

async function expectSheetFitsViewport(
  page: Page,
  viewport: { width: number; height: number; bottomAir: number },
): Promise<void> {
  const sheet = page.locator("[data-sonic-instrument]");
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? viewport.height) + (box?.height ?? 0)).toBeLessThanOrEqual(
    viewport.height - viewport.bottomAir,
  );
  await expectNoHorizontalOverflow(page);
}

async function setOffset(page: Page, value: number): Promise<void> {
  await page.locator("[data-latency-offset]").evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function putLatencyIntoChallengeState(page: Page): Promise<void> {
  await setOffset(page, 300);
  await page.locator("[data-audio-latency]").evaluate((element) => {
    const root = element as HTMLElement;
    root.dataset.latencyState = "playing";
    root.querySelector<HTMLButtonElement>("[data-latency-start]")!.disabled =
      true;
    root.querySelector<HTMLButtonElement>("[data-latency-stop]")!.disabled =
      false;
    root.querySelector<HTMLElement>("[data-latency-pulse]")!.dataset.active =
      "true";
  });
}

async function centerX(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return (box?.x ?? 0) + (box?.width ?? 0) / 2;
}

for (const viewport of [...primaryDesktopViewports, compactDesktopViewport]) {
  test(`Audio Latency active challenge fits ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/audio-latency-test");
    await putLatencyIntoChallengeState(page);

    await expect(page.locator("[data-latency-offset-value]")).toHaveText([
      "+300 ms",
      "+300 ms",
    ]);
    await expect(page.locator("[data-latency-offset-marker]")).toHaveAttribute(
      "data-offset-relation",
      "after",
    );
    await expectSheetFitsViewport(page, viewport);
  });
}

for (const viewport of mobileViewports) {
  test(`Audio Latency keeps field and primary controls proximate at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/audio-latency-test");
    await putLatencyIntoChallengeState(page);
    await expectNoHorizontalOverflow(page);

    const field = page.locator(".latency-field");
    const start = page.locator("[data-latency-start]");
    const offset = page.locator("[data-latency-offset]");
    await expect(field).toBeVisible();
    await expect(start).toBeVisible();
    await expect(offset).toBeVisible();

    const fieldBox = await field.boundingBox();
    const startBox = await start.boundingBox();
    const offsetBox = await offset.boundingBox();
    expect(fieldBox).not.toBeNull();
    expect(startBox).not.toBeNull();
    expect(offsetBox).not.toBeNull();

    if (fieldBox && startBox && offsetBox) {
      const fieldBottom = fieldBox.y + fieldBox.height;
      expect(startBox.y).toBeGreaterThanOrEqual(fieldBottom - 1);
      expect(startBox.y - fieldBottom).toBeLessThanOrEqual(140);
      expect(offsetBox.y).toBeGreaterThanOrEqual(startBox.y);
      expect(offsetBox.y - fieldBottom).toBeLessThanOrEqual(300);
    }
  });
}

test("Audio Latency offset marker follows manual sign convention without reflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1_366, height: 768 });
  await page.goto("/audio-latency-test");

  const sheet = page.locator("[data-sonic-instrument]");
  const field = page.locator(".latency-field");
  const pulse = page.locator("[data-latency-pulse]");
  const marker = page.locator("[data-latency-offset-marker]");

  const initialSheet = await sheet.boundingBox();
  const initialField = await field.boundingBox();
  const visualX = await centerX(pulse);
  const alignedX = await centerX(marker);
  expect(Math.abs(alignedX - visualX)).toBeLessThanOrEqual(1);
  await expect(marker).toHaveAttribute("data-offset-relation", "aligned");

  await setOffset(page, -300);
  const beforeX = await centerX(marker);
  await expect(marker).toHaveAttribute("data-offset-relation", "before");
  expect(beforeX).toBeLessThan(visualX - 20);

  await setOffset(page, 300);
  const afterX = await centerX(marker);
  await expect(marker).toHaveAttribute("data-offset-relation", "after");
  expect(afterX).toBeGreaterThan(visualX + 20);

  const finalSheet = await sheet.boundingBox();
  const finalField = await field.boundingBox();
  expect(initialSheet).not.toBeNull();
  expect(finalSheet).not.toBeNull();
  expect(initialField).not.toBeNull();
  expect(finalField).not.toBeNull();
  expect(
    Math.abs((finalSheet?.height ?? 0) - (initialSheet?.height ?? 0)),
  ).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs((finalField?.height ?? 0) - (initialField?.height ?? 0)),
  ).toBeLessThanOrEqual(0.5);
  expect(Math.abs((await centerX(pulse)) - visualX)).toBeLessThanOrEqual(0.5);
});

test("Audio Latency keeps browser metadata secondary and exposes a real Stop shape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1_366, height: 768 });
  await page.goto("/audio-latency-test");

  const details = page.locator(".latency-reported");
  const summary = details.locator("summary");
  const baseLatency = page.locator("[data-latency-base]");
  expect(await details.getAttribute("open")).toBeNull();
  await expect(summary).toBeVisible();
  await expect(baseLatency).toBeHidden();

  await summary.click();
  await expect(baseLatency).toBeVisible();

  const stopShape = page.locator(".latency-stop .transport-stop-shape");
  await expect(stopShape).toBeVisible();
  const shapeBox = await stopShape.boundingBox();
  expect(shapeBox).not.toBeNull();
  expect(shapeBox?.width ?? 0).toBeGreaterThanOrEqual(8);
  expect(shapeBox?.height ?? 0).toBeGreaterThanOrEqual(8);
});
