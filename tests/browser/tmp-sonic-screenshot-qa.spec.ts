import { test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const viewports = [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "390x844", width: 390, height: 844 },
] as const;

async function putSpectrumIntoChallengeState(page: import("@playwright/test").Page) {
  await page.locator('[data-spectrum-view="spectrogram"]').click();
  await page.locator("[data-spectrum-input-field]").evaluate((element) => {
    const field = element as HTMLElement;
    field.hidden = false;
    const select = field.querySelector("select");
    if (select && select.options.length === 0) {
      select.append(new Option("Screenshot QA microphone", "screenshot-qa"));
    }
  });
  await page.locator("[data-spectrum-active-input]").evaluate((element) => {
    element.textContent = "Screenshot QA microphone";
  });
  await page.locator("[data-spectrum-analyzer]").evaluate((element) => {
    (element as HTMLElement).dataset.spectrumState = "running";
  });
}

async function putHearingIntoAnswerState(page: import("@playwright/test").Page) {
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

test("capture Sonic Field stress-trio runtime screenshots", async ({ page }) => {
  await mkdir("artifacts/sonic-field-screenshots", { recursive: true });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto("/headphone-test");
    await page.locator('[data-headphone-mode="sweep"]').click();
    await page.screenshot({
      path: `artifacts/sonic-field-screenshots/headphone-sweep-${viewport.name}.png`,
      fullPage: false,
    });

    await page.goto("/spectrum-analyzer");
    await putSpectrumIntoChallengeState(page);
    await page.screenshot({
      path: `artifacts/sonic-field-screenshots/spectrum-spectrogram-${viewport.name}.png`,
      fullPage: false,
    });

    await page.goto("/hearing-frequency-test");
    await putHearingIntoAnswerState(page);
    await page.screenshot({
      path: `artifacts/sonic-field-screenshots/hearing-answer-${viewport.name}.png`,
      fullPage: false,
    });
  }
});
