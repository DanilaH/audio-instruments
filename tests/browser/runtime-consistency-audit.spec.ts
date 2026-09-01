import { appendFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { getPublicTools } from "../../src/registry/tools";

const publicRoutes = getPublicTools().map((tool) => tool.route);
const auditDir = join(process.cwd(), "audit-output");
const reportPath = join(auditDir, "runtime-consistency.jsonl");
const screenshotDir = join(auditDir, "screenshots");

const staticViewports = [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
] as const;

const dynamicViewports = [
  { width: 390, height: 844 },
  { width: 1366, height: 768 },
] as const;

type Rect = { x: number; y: number; width: number; height: number } | null;

type GeometrySnapshot = {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  shell: Rect;
  instrument: Rect;
  header: Rect;
  clippedControls: Array<{ tag: string; text: string; width: number; height: number }>;
  unlabeledControls: Array<{ tag: string; id: string; type: string }>;
  namelessButtons: Array<{ html: string }>;
  tallButtons: Array<{ text: string; height: number; width: number }>;
  invalidOutputTokens: string[];
};

function writeRecord(record: unknown): void {
  appendFileSync(reportPath, `${JSON.stringify(record)}\n`, "utf8");
}

function rectDelta(a: Rect, b: Rect) {
  if (!a || !b) return null;
  return {
    x: Number((b.x - a.x).toFixed(2)),
    y: Number((b.y - a.y).toFixed(2)),
    width: Number((b.width - a.width).toFixed(2)),
    height: Number((b.height - a.height).toFixed(2)),
  };
}

async function snapshot(page: Page): Promise<GeometrySnapshot> {
  return page.evaluate(() => {
    const toRect = (element: Element | null) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    };

    const isVisible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number.parseFloat(style.opacity || "1") > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const clippedControls = Array.from(
      document.querySelectorAll<HTMLElement>("button, a, label, output"),
    )
      .filter(isVisible)
      .filter(
        (element) =>
          element.scrollWidth > element.clientWidth + 1 ||
          element.scrollHeight > element.clientHeight + 1,
      )
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: (element.innerText || element.textContent || "").trim().slice(0, 100),
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      }));

    const unlabeledControls = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]), select, textarea',
      ),
    )
      .filter(isVisible)
      .filter((element) => {
        const labels = "labels" in element ? element.labels : null;
        return !(
          (labels && labels.length > 0) ||
          element.getAttribute("aria-label") ||
          element.getAttribute("aria-labelledby") ||
          element.getAttribute("title")
        );
      })
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        id: element.id,
        type: element instanceof HTMLInputElement ? element.type : "",
      }));

    const namelessButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .filter(isVisible)
      .filter(
        (button) =>
          !(button.innerText || "").trim() &&
          !button.getAttribute("aria-label") &&
          !button.getAttribute("title"),
      )
      .map((button) => ({ html: button.outerHTML.slice(0, 180) }));

    const tallButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .filter(isVisible)
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          text: (button.innerText || button.getAttribute("aria-label") || "").trim().slice(0, 100),
          height: rect.height,
          width: rect.width,
        };
      })
      .filter((button) => button.height > 64);

    const outputText = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="status"], output, [class*="metric"], [class*="readout"], [class*="value"]',
      ),
    )
      .filter(isVisible)
      .map((element) => element.textContent || "")
      .join(" ");
    const invalidOutputTokens = ["NaN", "undefined", "Infinity"]
      .filter((token) => outputText.includes(token));

    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      shell: toRect(document.querySelector(".tool-shell")),
      instrument: toRect(document.querySelector(".instrument-surface")),
      header: toRect(document.querySelector(".tool-shell__header")),
      clippedControls,
      unlabeledControls,
      namelessButtons,
      tallButtons,
      invalidOutputTokens,
    };
  });
}

async function waitForLayout(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

test.beforeAll(() => {
  rmSync(auditDir, { recursive: true, force: true });
  mkdirSync(screenshotDir, { recursive: true });
});

for (const route of ["/", "/privacy", ...publicRoutes]) {
  for (const viewport of staticViewports) {
    test(`geometry ${route} ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.setViewportSize(viewport);
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await waitForLayout(page);

      const current = await snapshot(page);
      writeRecord({
        kind: "static",
        route,
        viewport,
        pageErrors,
        snapshot: current,
      });

      expect(pageErrors).toEqual([]);
      expect(current.scrollWidth).toBeLessThanOrEqual(current.clientWidth);
      expect(current.clippedControls).toEqual([]);
      expect(current.unlabeledControls).toEqual([]);
      expect(current.namelessButtons).toEqual([]);
      expect(current.invalidOutputTokens).toEqual([]);

      if (current.tallButtons.length > 0) {
        await page.screenshot({
          path: join(
            screenshotDir,
            `${route.replaceAll("/", "_") || "home"}-${viewport.width}-tall-buttons.png`,
          ),
          fullPage: true,
        });
      }
    });
  }
}

for (const route of publicRoutes) {
  for (const viewport of dynamicViewports) {
    test(`input stability ${route} ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);
      await waitForLayout(page);

      const controls = page.locator(
        '.instrument-surface input[type="range"], .instrument-surface input[type="number"], .instrument-surface select',
      );
      const count = await controls.count();
      const changes: unknown[] = [];

      for (let index = 0; index < count; index += 1) {
        const control = controls.nth(index);
        if (!(await control.isVisible()) || (await control.isDisabled())) continue;

        const before = await snapshot(page);
        const identity = await control.evaluate((element) => ({
          tag: element.tagName.toLowerCase(),
          id: (element as HTMLElement).id,
          type: element instanceof HTMLInputElement ? element.type : "select",
          value:
            element instanceof HTMLInputElement || element instanceof HTMLSelectElement
              ? element.value
              : "",
        }));

        await control.evaluate((element) => {
          if (element instanceof HTMLSelectElement) {
            const enabled = Array.from(element.options).filter((option) => !option.disabled);
            const current = enabled.findIndex((option) => option.value === element.value);
            const next = enabled[(current + 1) % enabled.length];
            if (next) element.value = next.value;
          } else if (element instanceof HTMLInputElement) {
            const min = Number.isFinite(Number(element.min)) ? Number(element.min) : 0;
            const max = Number.isFinite(Number(element.max)) ? Number(element.max) : min + 10;
            const current = Number(element.value);
            const target = Math.abs(current - min) < Math.abs(current - max) ? max : min;
            element.value = String(target);
          }
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await waitForLayout(page);

        const after = await snapshot(page);
        const surfaceDelta = rectDelta(before.instrument, after.instrument);
        const shellDelta = rectDelta(before.shell, after.shell);
        const documentHeightDelta = after.scrollHeight - before.scrollHeight;
        const record = {
          identity,
          surfaceDelta,
          shellDelta,
          documentHeightDelta,
          afterInvalidOutputTokens: after.invalidOutputTokens,
          afterOverflow: after.scrollWidth - after.clientWidth,
          afterClippedControls: after.clippedControls,
        };
        changes.push(record);

        expect(after.scrollWidth).toBeLessThanOrEqual(after.clientWidth);
        expect(after.invalidOutputTokens).toEqual([]);
        expect(after.clippedControls).toEqual([]);
        if (surfaceDelta) {
          expect(Math.abs(surfaceDelta.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(surfaceDelta.width)).toBeLessThanOrEqual(1);
          expect(Math.abs(surfaceDelta.y)).toBeLessThanOrEqual(1);
          expect(Math.abs(surfaceDelta.height)).toBeLessThanOrEqual(4);
        }
        expect(Math.abs(documentHeightDelta)).toBeLessThanOrEqual(4);
      }

      writeRecord({ kind: "input-stability", route, viewport, changes });
    });

    test(`mode stability ${route} ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);
      await waitForLayout(page);

      const modeButtons = page.locator(
        '.instrument-surface button[aria-pressed], .instrument-surface button[data-speaker-mode], .instrument-surface button[data-spectrum-view], .instrument-surface button[data-noise-type], .instrument-surface button[data-headphone-mode]',
      );
      const count = await modeButtons.count();
      const changes: unknown[] = [];

      for (let index = 0; index < count; index += 1) {
        const button = modeButtons.nth(index);
        if (!(await button.isVisible()) || (await button.isDisabled())) continue;

        const before = await snapshot(page);
        const identity = (await button.innerText()).trim() || (await button.getAttribute("aria-label")) || "";
        await button.click();
        await waitForLayout(page);
        const after = await snapshot(page);
        const surfaceDelta = rectDelta(before.instrument, after.instrument);
        const documentHeightDelta = after.scrollHeight - before.scrollHeight;
        changes.push({
          identity,
          surfaceDelta,
          documentHeightDelta,
          afterOverflow: after.scrollWidth - after.clientWidth,
          afterClippedControls: after.clippedControls,
          afterInvalidOutputTokens: after.invalidOutputTokens,
        });

        expect(after.scrollWidth).toBeLessThanOrEqual(after.clientWidth);
        expect(after.clippedControls).toEqual([]);
        expect(after.invalidOutputTokens).toEqual([]);
        if (surfaceDelta) {
          expect(Math.abs(surfaceDelta.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(surfaceDelta.width)).toBeLessThanOrEqual(1);
          expect(Math.abs(surfaceDelta.y)).toBeLessThanOrEqual(1);
          expect(Math.abs(surfaceDelta.height)).toBeLessThanOrEqual(12);
        }
        expect(Math.abs(documentHeightDelta)).toBeLessThanOrEqual(12);
      }

      writeRecord({ kind: "mode-stability", route, viewport, changes });
    });
  }
}
