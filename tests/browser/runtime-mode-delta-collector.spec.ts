import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { test, type Page } from "@playwright/test";

const auditDir = join(process.cwd(), "audit-output");
const reportPath = join(auditDir, "mode-deltas.jsonl");

const cases = [
  { route: "/speaker-test", selector: "[data-speaker-mode]", root: "[data-speaker-test]" },
  { route: "/headphone-test", selector: "[data-headphone-mode]", root: "[data-headphone-test]" },
  { route: "/bass-test", selector: ".bass-mode-selector button", root: "[data-bass-test]" },
  { route: "/noise-generator", selector: ".noise-selector button", root: "[data-noise-generator]" },
  { route: "/frequency-sweep", selector: ".sweep-selector button", root: "[data-frequency-sweep]" },
  { route: "/spectrum-analyzer", selector: ".spectrum-view-switch button", root: "[data-spectrum-analyzer]" },
] as const;

const viewports = [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 1366, height: 768 },
] as const;

async function dimensions(page: Page, rootSelector: string) {
  return page.evaluate((rootSelector) => {
    const surface = document.querySelector(".instrument-surface")?.getBoundingClientRect();
    const root = document.querySelector<HTMLElement>(rootSelector);
    const visiblePanels = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-speaker-panel], [data-headphone-panel], [data-bass-panel], .noise-long-reminder, [data-spectrum-panel]",
      ),
    )
      .filter((element) => !element.hidden && getComputedStyle(element).display !== "none")
      .map((element) => ({
        speaker: element.dataset.speakerPanel ?? null,
        headphone: element.dataset.headphonePanel ?? null,
        bass: element.dataset.bassPanel ?? null,
        className: element.className,
        height: element.getBoundingClientRect().height,
      }));
    return {
      surfaceHeight: surface?.height ?? null,
      documentHeight: document.documentElement.scrollHeight,
      rootDataset: root ? { ...root.dataset } : {},
      visiblePanels,
    };
  }, rootSelector);
}

test.beforeAll(() => {
  mkdirSync(auditDir, { recursive: true });
});

for (const auditCase of cases) {
  for (const viewport of viewports) {
    test(`${auditCase.route} mode deltas ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(auditCase.route);
      const count = await page.locator(auditCase.selector).count();

      for (let index = 0; index < count; index += 1) {
        await page.goto(auditCase.route);
        const button = page.locator(auditCase.selector).nth(index);
        if (!(await button.isVisible()) || (await button.isDisabled())) continue;
        const identity = {
          text: (await button.innerText()).trim(),
          ariaPressed: await button.getAttribute("aria-pressed"),
          data: await button.evaluate((element) => ({ ...(element as HTMLElement).dataset })),
        };
        const before = await dimensions(page, auditCase.root);
        await button.click();
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const after = await dimensions(page, auditCase.root);
        appendFileSync(
          reportPath,
          `${JSON.stringify({ route: auditCase.route, viewport, identity, before, after, surfaceDelta: after.surfaceHeight !== null && before.surfaceHeight !== null ? Number((after.surfaceHeight - before.surfaceHeight).toFixed(2)) : null, documentDelta: after.documentHeight - before.documentHeight })}\n`,
          "utf8",
        );
      }
    });
  }
}
