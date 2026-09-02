import { expect, test } from "@playwright/test";

const viewport = { width: 390, height: 844 } as const;

test("records Noise Generator mobile geometry for PR3 remediation", async ({
  page,
}) => {
  await page.setViewportSize(viewport);
  await page.goto("/noise-generator");

  const field = page.locator(".noise-field");
  const play = page.locator("[data-noise-play]");
  const safety = page.locator(".noise-safety");

  await expect(field).toBeVisible();
  await expect(play).toBeVisible();
  await expect(safety).toBeVisible();

  const [fieldBox, playBox, safetyBox, documentMetrics] = await Promise.all([
    field.boundingBox(),
    play.boundingBox(),
    safety.boundingBox(),
    page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    })),
  ]);

  expect(fieldBox).not.toBeNull();
  expect(playBox).not.toBeNull();
  expect(safetyBox).not.toBeNull();
  expect(documentMetrics.scrollWidth).toBeLessThanOrEqual(
    documentMetrics.clientWidth,
  );

  console.log(
    `PR3_NOISE_MOBILE_GEOMETRY ${JSON.stringify({
      viewport,
      fieldBox,
      playBox,
      safetyBox,
      documentMetrics,
    })}`,
  );
});
