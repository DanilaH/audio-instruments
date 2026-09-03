import { expect, test, type Page } from "@playwright/test";
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
  { name: "desktop", width: 1366, height: 768, screenshot: true },
  { name: "stress", width: 1280, height: 720, screenshot: false },
  { name: "mobile", width: 390, height: 844, screenshot: false },
  { name: "mobile-narrow", width: 320, height: 844, screenshot: true },
] as const;

const buttonGroups = [
  ["/speaker-test", "button[data-speaker-mode]"],
  ["/headphone-test", "button[data-headphone-mode]"],
  ["/bass-test", ".bass-modes button"],
  ["/noise-generator", ".noise-selector button"],
  ["/frequency-sweep", ".sweep-selector button"],
  ["/spectrum-analyzer", ".spectrum-view-switch button"],
] as const;

const radioGroups = [
  ["/tone-generator", 'input[name="tone-waveform"]'],
  ["/tone-generator", 'input[name="tone-channel"]'],
  ["/hearing-frequency-test", 'input[name="hearing-mode"]'],
] as const;

const artifactRoot = path.join(process.cwd(), "test-results", "ui-audit");
const reportPath = path.join(artifactRoot, "metrics.json");

type Rect = { top: number; bottom: number; height: number } | null;
type Layout = {
  route: string;
  viewport: string;
  state: string;
  instrument: Rect;
  field: Rect;
  rail: Rect;
  documentHeight: number;
  scrollWidth: number;
  clientWidth: number;
  horizontalOverflow: boolean;
  visibleTextCharacters: number;
  visibleParagraphs: number;
  visibleControls: number;
  longestVisibleText: string[];
};
type Shift = {
  route: string;
  viewport: string;
  state: string;
  instrumentHeightDelta: number | null;
  documentHeightDelta: number;
  fieldTopDelta: number | null;
  fieldHeightDelta: number | null;
  railTopDelta: number | null;
  railHeightDelta: number | null;
  horizontalOverflow: boolean;
};

const report: {
  auditedCommit: string;
  generatedAt: string;
  layouts: Layout[];
  shifts: Shift[];
  runtimeErrors: Array<{ route: string; message: string }>;
} = {
  auditedCommit: "504c1722169943f2d806666427f2a965aadc20eb",
  generatedAt: new Date().toISOString(),
  layouts: [],
  shifts: [],
  runtimeErrors: [],
};

function persist(): void {
  fs.mkdirSync(artifactRoot, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function safe(value: string): string {
  return value.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "home";
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function layout(page: Page, route: string, viewport: string, state: string): Promise<Layout> {
  return page.evaluate(({ routeName, viewportName, stateName }) => {
    const visible = (el: Element) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const rect = (el: Element | null) => {
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, height: box.height };
    };
    const instrument = document.querySelector("[data-sonic-instrument]");
    const field = instrument?.querySelector('[class$="-field"], [class*="-field "]') ?? null;
    const rail = instrument?.querySelector('[class$="-rail"], [class*="-rail "]') ?? null;
    const text = instrument
      ? Array.from(instrument.querySelectorAll("p, span, strong, small, label, legend, dt, dd"))
          .filter(visible)
          .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
      : [];
    return {
      route: routeName,
      viewport: viewportName,
      state: stateName,
      instrument: rect(instrument),
      field: rect(field),
      rail: rect(rail),
      documentHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      visibleTextCharacters: text.join(" ").length,
      visibleParagraphs: instrument ? Array.from(instrument.querySelectorAll("p")).filter(visible).length : 0,
      visibleControls: instrument ? Array.from(instrument.querySelectorAll("button, input, select, textarea")).filter(visible).length : 0,
      longestVisibleText: [...text].sort((a, b) => b.length - a.length).slice(0, 10),
    };
  }, { routeName: route, viewportName: viewport, stateName: state });
}

function d(after: number | undefined, before: number | undefined): number | null {
  if (after === undefined || before === undefined) return null;
  return Number((after - before).toFixed(2));
}

function recordShift(before: Layout, after: Layout): Shift {
  return {
    route: after.route,
    viewport: after.viewport,
    state: after.state,
    instrumentHeightDelta: d(after.instrument?.height, before.instrument?.height),
    documentHeightDelta: Number((after.documentHeight - before.documentHeight).toFixed(2)),
    fieldTopDelta: d(after.field?.top, before.field?.top),
    fieldHeightDelta: d(after.field?.height, before.field?.height),
    railTopDelta: d(after.rail?.top, before.rail?.top),
    railHeightDelta: d(after.rail?.height, before.rail?.height),
    horizontalOverflow: after.horizontalOverflow,
  };
}

async function screenshotFinding(page: Page, shift: Shift): Promise<void> {
  const values = [shift.instrumentHeightDelta, shift.documentHeightDelta, shift.fieldTopDelta, shift.fieldHeightDelta, shift.railTopDelta, shift.railHeightDelta].filter((v): v is number => v !== null);
  if (!shift.horizontalOverflow && values.every((value) => Math.abs(value) <= 2)) return;
  const dir = path.join(artifactRoot, "shift-findings", shift.viewport);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${safe(shift.route)}-${safe(shift.state)}.png`), fullPage: true });
}

test("focused prelaunch UI UX evidence capture", async ({ page }) => {
  test.setTimeout(240_000);
  persist();
  let activeRoute = "bootstrap";
  page.on("console", (message) => {
    if (message.type() === "error") {
      report.runtimeErrors.push({ route: activeRoute, message: message.text() });
      persist();
    }
  });
  page.on("pageerror", (error) => {
    report.runtimeErrors.push({ route: activeRoute, message: error.message });
    persist();
  });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of routes) {
      activeRoute = route;
      await page.goto(route);
      await settle(page);
      const current = await layout(page, route, viewport.name, "default");
      report.layouts.push(current);
      persist();
      expect(current.instrument, `${route} must render an instrument`).not.toBeNull();
      if (viewport.screenshot) {
        const dir = path.join(artifactRoot, viewport.name);
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, `${safe(route)}.png`), fullPage: true });
      }
    }
  }

  for (const viewport of [viewports[0], viewports[3]]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const [route, selector] of buttonGroups) {
      activeRoute = route;
      await page.goto(route);
      const count = await page.locator(selector).count();
      for (let index = 0; index < count; index += 1) {
        await page.goto(route);
        await settle(page);
        const control = page.locator(selector).nth(index);
        if (!(await control.isVisible()) || (await control.isDisabled())) continue;
        const before = await layout(page, route, viewport.name, "before");
        const label = ((await control.textContent()) ?? `button-${index}`).replace(/\s+/g, " ").trim();
        await control.click();
        await settle(page);
        const after = await layout(page, route, viewport.name, `button:${label}`);
        const shift = recordShift(before, after);
        report.shifts.push(shift);
        persist();
        await screenshotFinding(page, shift);
      }
    }

    for (const [route, selector] of radioGroups) {
      activeRoute = route;
      await page.goto(route);
      const count = await page.locator(selector).count();
      for (let index = 0; index < count; index += 1) {
        await page.goto(route);
        await settle(page);
        const control = page.locator(selector).nth(index);
        if (await control.isDisabled()) continue;
        const before = await layout(page, route, viewport.name, "before");
        const value = (await control.getAttribute("value")) ?? `radio-${index}`;
        await control.evaluate((element) => {
          const input = element as HTMLInputElement;
          input.checked = true;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await settle(page);
        const after = await layout(page, route, viewport.name, `radio:${value}`);
        const shift = recordShift(before, after);
        report.shifts.push(shift);
        persist();
        await screenshotFinding(page, shift);
      }
    }

    activeRoute = "/spectrum-analyzer";
    for (const value of ["1024", "8192"]) {
      await page.goto(activeRoute);
      await settle(page);
      const before = await layout(page, activeRoute, viewport.name, "before");
      await page.locator("[data-spectrum-fft]").selectOption(value);
      await settle(page);
      const after = await layout(page, activeRoute, viewport.name, `fft:${value}`);
      const shift = recordShift(before, after);
      report.shifts.push(shift);
      persist();
      await screenshotFinding(page, shift);
    }

    activeRoute = "/audio-latency-test";
    for (const value of ["-300", "300"]) {
      await page.goto(activeRoute);
      await settle(page);
      const before = await layout(page, activeRoute, viewport.name, "before");
      await page.locator("[data-latency-offset]").evaluate((element, nextValue) => {
        const input = element as HTMLInputElement;
        input.value = nextValue;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }, value);
      await settle(page);
      const after = await layout(page, activeRoute, viewport.name, `offset:${value}`);
      const shift = recordShift(before, after);
      report.shifts.push(shift);
      persist();
      await screenshotFinding(page, shift);
    }
  }

  persist();
});
