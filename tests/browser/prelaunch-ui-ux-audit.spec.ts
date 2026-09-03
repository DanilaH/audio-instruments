import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const routes = [
  "/sound-test",
  "/speaker-test",
  "/headphone-test",
  "/stereo-test",
  "/phase-test",
  "/surround-sound-test",
  "/bass-test",
  "/tone-generator",
  "/frequency-sweep",
  "/noise-generator",
  "/microphone-test",
  "/spectrum-analyzer",
  "/pitch-detector",
  "/decibel-meter",
  "/audio-latency-test",
  "/hearing-frequency-test",
] as const;

const viewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "stress", width: 1280, height: 720 },
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile-narrow", width: 320, height: 844 },
] as const;

const interactionCases = [
  { route: "/speaker-test", selector: "button[data-speaker-mode]" },
  { route: "/headphone-test", selector: "button[data-headphone-mode]" },
  { route: "/bass-test", selector: ".bass-modes button" },
  { route: "/noise-generator", selector: ".noise-selector button" },
  { route: "/frequency-sweep", selector: ".sweep-selector button" },
  { route: "/spectrum-analyzer", selector: ".spectrum-view-switch button" },
  { route: "/tone-generator", selector: 'input[name="tone-waveform"]' },
  { route: "/tone-generator", selector: 'input[name="tone-channel"]' },
] as const;

interface LayoutSnapshot {
  route: string;
  viewport: string;
  state: string;
  instrument: { top: number; bottom: number; height: number } | null;
  field: { top: number; bottom: number; height: number } | null;
  rail: { top: number; bottom: number; height: number } | null;
  documentHeight: number;
  scrollWidth: number;
  clientWidth: number;
  instrumentBottomAir: number | null;
  visibleTextCharacters: number;
  visibleParagraphs: number;
  visibleControls: number;
  longestVisibleText: string[];
}

interface ShiftSnapshot {
  route: string;
  viewport: string;
  selector: string;
  index: number;
  label: string;
  instrumentHeightDelta: number | null;
  documentHeightDelta: number;
  fieldTopDelta: number | null;
  fieldHeightDelta: number | null;
  railTopDelta: number | null;
  railHeightDelta: number | null;
  overflow: boolean;
}

const artifactRoot = path.join(process.cwd(), "test-results", "ui-audit");

function safeName(value: string): string {
  return value.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "home";
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function captureLayout(
  page: Page,
  route: string,
  viewport: string,
  state: string,
): Promise<LayoutSnapshot> {
  return page.evaluate(
    ({ routeName, viewportName, stateName }) => {
      const rect = (element: Element | null) => {
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, height: box.height };
      };
      const visible = (element: Element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          box.width > 0 &&
          box.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      };
      const instrumentElement = document.querySelector("[data-sonic-instrument]");
      const fieldElement = instrumentElement?.querySelector(
        '[class$="-field"], [class*="-field "]',
      );
      const railElement = instrumentElement?.querySelector(
        '[class$="-rail"], [class*="-rail "]',
      );
      const instrumentRect = rect(instrumentElement);
      const textNodes = instrumentElement
        ? Array.from(instrumentElement.querySelectorAll("p, span, strong, small, label, legend"))
            .filter(visible)
            .map((element) => (element.textContent ?? "").replace(/\s+/g, " ").trim())
            .filter(Boolean)
        : [];
      const paragraphs = instrumentElement
        ? Array.from(instrumentElement.querySelectorAll("p")).filter(visible).length
        : 0;
      const controls = instrumentElement
        ? Array.from(instrumentElement.querySelectorAll("button, input, select, textarea"))
            .filter(visible).length
        : 0;
      return {
        route: routeName,
        viewport: viewportName,
        state: stateName,
        instrument: instrumentRect,
        field: rect(fieldElement ?? null),
        rail: rect(railElement ?? null),
        documentHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        instrumentBottomAir: instrumentRect
          ? window.innerHeight - instrumentRect.bottom
          : null,
        visibleTextCharacters: textNodes.join(" ").length,
        visibleParagraphs: paragraphs,
        visibleControls: controls,
        longestVisibleText: [...textNodes]
          .sort((left, right) => right.length - left.length)
          .slice(0, 8),
      };
    },
    { routeName: route, viewportName: viewport, stateName: state },
  );
}

function delta(
  after: number | undefined,
  before: number | undefined,
): number | null {
  if (after === undefined || before === undefined) return null;
  return Number((after - before).toFixed(2));
}

async function controlLabel(locator: Locator): Promise<string> {
  const label = await locator.evaluate((element) => {
    if (element instanceof HTMLInputElement) {
      return (
        element.closest("label")?.textContent ??
        element.getAttribute("aria-label") ??
        element.value
      );
    }
    return element.textContent ?? element.getAttribute("aria-label") ?? "control";
  });
  return label.replace(/\s+/g, " ").trim().slice(0, 80);
}

test("prelaunch UI UX audit capture", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Audit capture runs once in Chromium.");
  test.setTimeout(300_000);
  fs.mkdirSync(artifactRoot, { recursive: true });

  const layouts: LayoutSnapshot[] = [];
  const shifts: ShiftSnapshot[] = [];
  const runtimeErrors: Array<{ route: string; message: string }> = [];
  let activeRoute = "bootstrap";

  page.on("console", (message) => {
    if (message.type() === "error") {
      runtimeErrors.push({ route: activeRoute, message: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    runtimeErrors.push({ route: activeRoute, message: error.message });
  });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of routes) {
      activeRoute = route;
      await page.goto(route);
      await settle(page);
      const snapshot = await captureLayout(page, route, viewport.name, "default");
      layouts.push(snapshot);
      expect(snapshot.instrument, `${route} must render an instrument`).not.toBeNull();

      if (viewport.name === "desktop" || viewport.name === "mobile-narrow") {
        const screenshotDirectory = path.join(artifactRoot, viewport.name);
        fs.mkdirSync(screenshotDirectory, { recursive: true });
        await page.screenshot({
          path: path.join(screenshotDirectory, `${safeName(route)}.png`),
          fullPage: true,
        });
      }
    }
  }

  for (const viewport of [viewports[0], viewports[3]]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const interactionCase of interactionCases) {
      activeRoute = interactionCase.route;
      await page.goto(interactionCase.route);
      await settle(page);
      const count = await page.locator(interactionCase.selector).count();

      for (let index = 0; index < count; index += 1) {
        await page.goto(interactionCase.route);
        await settle(page);
        const control = page.locator(interactionCase.selector).nth(index);
        if (!(await control.isVisible()) || (await control.isDisabled())) continue;

        const before = await captureLayout(
          page,
          interactionCase.route,
          viewport.name,
          "before",
        );
        const label = await controlLabel(control);
        await control.click();
        await settle(page);
        const after = await captureLayout(
          page,
          interactionCase.route,
          viewport.name,
          `after:${label}`,
        );
        const shift: ShiftSnapshot = {
          route: interactionCase.route,
          viewport: viewport.name,
          selector: interactionCase.selector,
          index,
          label,
          instrumentHeightDelta: delta(after.instrument?.height, before.instrument?.height),
          documentHeightDelta: Number((after.documentHeight - before.documentHeight).toFixed(2)),
          fieldTopDelta: delta(after.field?.top, before.field?.top),
          fieldHeightDelta: delta(after.field?.height, before.field?.height),
          railTopDelta: delta(after.rail?.top, before.rail?.top),
          railHeightDelta: delta(after.rail?.height, before.rail?.height),
          overflow: after.scrollWidth > after.clientWidth + 1,
        };
        shifts.push(shift);

        const stateDirectory = path.join(
          artifactRoot,
          "states",
          viewport.name,
          safeName(interactionCase.route),
        );
        fs.mkdirSync(stateDirectory, { recursive: true });
        await page.screenshot({
          path: path.join(stateDirectory, `${index}-${safeName(label)}.png`),
          fullPage: true,
        });
      }
    }
  }

  for (const viewport of [viewports[0], viewports[3]]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    activeRoute = "/audio-latency-test";
    for (const value of ["-300", "300"] as const) {
      await page.goto(activeRoute);
      await settle(page);
      const before = await captureLayout(page, activeRoute, viewport.name, "before-offset");
      await page.locator("[data-latency-offset]").evaluate((element, nextValue) => {
        const input = element as HTMLInputElement;
        input.value = nextValue;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }, value);
      await settle(page);
      const after = await captureLayout(
        page,
        activeRoute,
        viewport.name,
        `offset:${value}`,
      );
      shifts.push({
        route: activeRoute,
        viewport: viewport.name,
        selector: "[data-latency-offset]",
        index: value === "-300" ? 0 : 1,
        label: `${value} ms`,
        instrumentHeightDelta: delta(after.instrument?.height, before.instrument?.height),
        documentHeightDelta: Number((after.documentHeight - before.documentHeight).toFixed(2)),
        fieldTopDelta: delta(after.field?.top, before.field?.top),
        fieldHeightDelta: delta(after.field?.height, before.field?.height),
        railTopDelta: delta(after.rail?.top, before.rail?.top),
        railHeightDelta: delta(after.rail?.height, before.rail?.height),
        overflow: after.scrollWidth > after.clientWidth + 1,
      });
    }
  }

  const report = {
    auditedCommit: "504c1722169943f2d806666427f2a965aadc20eb",
    generatedAt: new Date().toISOString(),
    layouts,
    shifts,
    runtimeErrors,
  };
  fs.writeFileSync(
    path.join(artifactRoot, "metrics.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  expect(
    runtimeErrors,
    "AUDIT_CAPTURE_COMPLETE: runtime errors were captured; inspect ui-audit/metrics.json",
  ).toEqual([]);
  expect(
    false,
    "AUDIT_CAPTURE_COMPLETE_INTENTIONAL_FAILURE: upload ui-audit screenshots and metrics for independent review",
  ).toBe(true);
});
