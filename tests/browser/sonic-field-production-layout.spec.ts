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

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  };
}

async function measureHeadphoneAnchors(page: Page) {
  return {
    left: await centerOf(page.locator('[data-headphone-anchor="left"]')),
    center: await centerOf(page.locator('[data-headphone-anchor="center"]')),
    right: await centerOf(page.locator('[data-headphone-anchor="right"]')),
    stage: await page.locator(".headphone-stage").boundingBox(),
  };
}

function expectAnchorSetStable(
  before: Awaited<ReturnType<typeof measureHeadphoneAnchors>>,
  after: Awaited<ReturnType<typeof measureHeadphoneAnchors>>,
): void {
  for (const key of ["left", "center", "right"] as const) {
    expect(Math.abs(after[key].x - before[key].x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after[key].y - before[key].y)).toBeLessThanOrEqual(0.5);
  }
  expect(before.stage).not.toBeNull();
  expect(after.stage).not.toBeNull();
  expect(
    Math.abs((after.stage?.x ?? 0) - (before.stage?.x ?? 0)),
  ).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs((after.stage?.y ?? 0) - (before.stage?.y ?? 0)),
  ).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs((after.stage?.width ?? 0) - (before.stage?.width ?? 0)),
  ).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs((after.stage?.height ?? 0) - (before.stage?.height ?? 0)),
  ).toBeLessThanOrEqual(0.5);
}

async function putSpectrumIntoLayoutChallengeState(page: Page): Promise<void> {
  await page.locator('[data-spectrum-view="spectrogram"]').click();
  await page.locator("[data-spectrum-input-field]").evaluate((element) => {
    const field = element as HTMLElement;
    field.hidden = false;
    const select = field.querySelector("select");
    if (select && select.options.length === 0) {
      select.append(new Option("Layout test microphone", "layout-test"));
    }
  });
  await page.locator("[data-spectrum-active-input]").evaluate((element) => {
    element.textContent = "Layout test microphone";
  });
  await page.locator("[data-spectrum-analyzer]").evaluate((element) => {
    (element as HTMLElement).dataset.spectrumState = "running";
  });
}

async function putHearingIntoAnswerLayoutState(page: Page): Promise<void> {
  await page.locator("[data-hearing-answer-panel]").evaluate((element) => {
    const panel = element as HTMLElement;
    panel.hidden = false;
    for (const button of panel.querySelectorAll<HTMLButtonElement>("button")) {
      button.disabled = false;
    }
  });
  await page.locator("[data-hearing-current-frequency]").evaluate((element) => {
    element.textContent = "14 kHz";
  });
  await page.locator("[data-hearing-progress]").evaluate((element) => {
    element.textContent = "Step 7 of 10";
  });
  await page.locator("[data-hearing-result]").evaluate((element) => {
    element.textContent = "12 kHz";
  });
  await page.locator("[data-hearing-frequency]").evaluate((element) => {
    (element as HTMLElement).dataset.hearingState = "awaiting-answer";
  });
}

test("Headphone spatial anchors stay fixed across advanced modes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1_366, height: 768 });
  await page.goto("/headphone-test");

  const baseline = await measureHeadphoneAnchors(page);
  for (const mode of ["phase", "sweep", "bass"] as const) {
    await page.locator(`[data-headphone-mode="${mode}"]`).click();
    const current = await measureHeadphoneAnchors(page);
    expectAnchorSetStable(baseline, current);
  }
});

test("Headphone advanced panels replace the channel hint", async ({ page }) => {
  await page.setViewportSize({ width: 1_366, height: 768 });
  await page.goto("/headphone-test");

  const channelHint = page.locator("[data-headphone-channel-hint]");
  await expect(channelHint).toBeVisible();

  for (const mode of ["phase", "sweep", "bass"] as const) {
    await page.locator(`[data-headphone-mode="${mode}"]`).click();
    await expect(channelHint).toBeHidden();
    await expect(
      page.locator(`[data-headphone-panel="${mode}"]`),
    ).toBeVisible();
  }
});

for (const viewport of [...primaryDesktopViewports, compactDesktopViewport]) {
  test(`Headphone Sweep challenge fits ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/headphone-test");
    await page.locator('[data-headphone-mode="sweep"]').click();
    await expect(page.locator("[data-headphone-panel='sweep']")).toBeVisible();
    await expectSheetFitsViewport(page, viewport);
  });

  test(`Spectrum Spectrogram challenge fits ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/spectrum-analyzer");
    await putSpectrumIntoLayoutChallengeState(page);
    await expect(page.locator("[data-spectrum-input-field]")).toBeVisible();
    await expectSheetFitsViewport(page, viewport);
  });

  test(`Hearing answer challenge fits ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/hearing-frequency-test");
    await putHearingIntoAnswerLayoutState(page);
    await expect(page.locator("[data-hearing-answer-panel]")).toBeVisible();
    await expectSheetFitsViewport(page, viewport);
  });
}

test("Hearing reserved decision band prevents answer-state reflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1_366, height: 768 });
  await page.goto("/hearing-frequency-test");

  const sheet = page.locator("[data-sonic-instrument]");
  const field = page.locator(".hearing-field");
  const beforeSheet = await sheet.boundingBox();
  const beforeField = await field.boundingBox();

  await putHearingIntoAnswerLayoutState(page);

  const afterSheet = await sheet.boundingBox();
  const afterField = await field.boundingBox();
  expect(beforeSheet).not.toBeNull();
  expect(afterSheet).not.toBeNull();
  expect(beforeField).not.toBeNull();
  expect(afterField).not.toBeNull();
  expect(
    Math.abs((afterSheet?.height ?? 0) - (beforeSheet?.height ?? 0)),
  ).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs((afterField?.height ?? 0) - (beforeField?.height ?? 0)),
  ).toBeLessThanOrEqual(0.5);
});

for (const viewport of mobileViewports) {
  for (const route of [
    "/headphone-test",
    "/spectrum-analyzer",
    "/hearing-frequency-test",
  ] as const) {
    test(`${route} has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);
      await expectNoHorizontalOverflow(page);
    });
  }
}

for (const route of [
  "/headphone-test",
  "/spectrum-analyzer",
  "/hearing-frequency-test",
] as const) {
  test(`${route} renders a concrete Stop transport shape`, async ({ page }) => {
    await page.setViewportSize({ width: 1_366, height: 768 });
    await page.goto(route);
    const shape = page.locator(".transport-stop-shape");
    await expect(shape).toBeVisible();
    const metrics = await shape.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        backgroundColor: style.backgroundColor,
      };
    });
    expect(metrics.width).toBeGreaterThanOrEqual(8);
    expect(metrics.height).toBeGreaterThanOrEqual(8);
    expect(metrics.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(metrics.backgroundColor).not.toBe("transparent");
  });
}
