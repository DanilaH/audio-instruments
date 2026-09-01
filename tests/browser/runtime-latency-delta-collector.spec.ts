import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { test } from "@playwright/test";

const outputPath = join(process.cwd(), "audit-output", "latency-delta.json");

async function snapshot(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const selectors = [
      ".instrument-surface",
      ".latency-instrument",
      ".latency-stage",
      ".latency-controls",
      ".latency-stage__header",
      ".latency-offset-summary",
      ".latency-result",
      ".latency-actions-row",
      ".latency-offset-control",
      ".latency-field-header",
      ".latency-reported",
    ] as const;

    const boxes = Object.fromEntries(
      selectors.map((selector) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return [selector, null];
        const rect = element.getBoundingClientRect();
        return [
          selector,
          {
            x: rect.x + window.scrollX,
            y: rect.y + window.scrollY,
            width: rect.width,
            height: rect.height,
            scrollWidth: element.scrollWidth,
            scrollHeight: element.scrollHeight,
            text: element.innerText.trim(),
          },
        ];
      }),
    );

    return {
      documentHeight: document.documentElement.scrollHeight,
      scrollY: window.scrollY,
      boxes,
      offsetValues: Array.from(
        document.querySelectorAll<HTMLElement>("[data-latency-offset-value]"),
      ).map((element) => ({
        text: element.innerText,
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      })),
    };
  });
}

test("collect Audio Latency 320 offset layout delta", async ({ page }) => {
  mkdirSync(join(process.cwd(), "audit-output"), { recursive: true });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/audio-latency-test");

  const before = await snapshot(page);
  await page.locator("#audio-latency-offset").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = input.min;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const after = await snapshot(page);

  writeFileSync(outputPath, JSON.stringify({ before, after }, null, 2), "utf8");
});
