import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const artifactRoot = path.join(process.cwd(), "test-results", "ui-audit");

interface Box {
  top: number;
  height: number;
}

interface StateMetric {
  route: string;
  viewport: string;
  control: string;
  state: string;
  instrumentHeightDelta: number | null;
  documentHeightDelta: number;
  fieldTopDelta: number | null;
  fieldHeightDelta: number | null;
  railTopDelta: number | null;
  railHeightDelta: number | null;
  overflow: boolean;
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const box = (element: Element | null): Box | null => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { top: rect.top, height: rect.height };
    };
    const instrument = document.querySelector("[data-sonic-instrument]");
    const field = instrument?.querySelector('[class$="-field"], [class*="-field "]') ?? null;
    const rail = instrument?.querySelector('[class$="-rail"], [class*="-rail "]') ?? null;
    return {
      instrument: box(instrument),
      field: box(field),
      rail: box(rail),
      documentHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
}

function delta(after: number | undefined, before: number | undefined): number | null {
  if (after === undefined || before === undefined) return null;
  return Number((after - before).toFixed(2));
}

async function labelText(locator: Locator): Promise<string> {
  return ((await locator.textContent()) ?? "control").replace(/\s+/g, " ").trim();
}

async function recordLabelStates(
  page: Page,
  route: string,
  viewportName: string,
  selector: string,
  controlName: string,
  metrics: StateMetric[],
): Promise<void> {
  await page.goto(route);
  await settle(page);
  const count = await page.locator(selector).count();

  for (let index = 0; index < count; index += 1) {
    await page.goto(route);
    await settle(page);
    const control = page.locator(selector).nth(index);
    if (!(await control.isVisible())) continue;
    const before = await measure(page);
    const state = await labelText(control);
    await control.click();
    await settle(page);
    const after = await measure(page);

    metrics.push({
      route,
      viewport: viewportName,
      control: controlName,
      state,
      instrumentHeightDelta: delta(after.instrument?.height, before.instrument?.height),
      documentHeightDelta: Number((after.documentHeight - before.documentHeight).toFixed(2)),
      fieldTopDelta: delta(after.field?.top, before.field?.top),
      fieldHeightDelta: delta(after.field?.height, before.field?.height),
      railTopDelta: delta(after.rail?.top, before.rail?.top),
      railHeightDelta: delta(after.rail?.height, before.rail?.height),
      overflow: after.scrollWidth > after.clientWidth + 1,
    });

    const directory = path.join(
      artifactRoot,
      "states-extra",
      viewportName,
      route.replace(/^\//, ""),
    );
    fs.mkdirSync(directory, { recursive: true });
    await page.screenshot({
      path: path.join(directory, `${controlName}-${index}.png`),
      fullPage: true,
    });
  }
}

test("prelaunch UI UX extra state capture", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Audit capture runs once in Chromium.");
  test.setTimeout(120_000);
  fs.mkdirSync(artifactRoot, { recursive: true });
  const metrics: StateMetric[] = [];

  for (const viewport of [
    { name: "desktop", width: 1366, height: 768 },
    { name: "mobile-narrow", width: 320, height: 844 },
  ] as const) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await recordLabelStates(
      page,
      "/tone-generator",
      viewport.name,
      'label:has(input[name="tone-waveform"])',
      "waveform",
      metrics,
    );
    await recordLabelStates(
      page,
      "/tone-generator",
      viewport.name,
      'label:has(input[name="tone-channel"])',
      "channel",
      metrics,
    );
    await recordLabelStates(
      page,
      "/hearing-frequency-test",
      viewport.name,
      'label:has(input[name="hearing-mode"])',
      "hearing-mode",
      metrics,
    );

    for (const fft of ["1024", "2048", "4096", "8192"]) {
      await page.goto("/spectrum-analyzer");
      await settle(page);
      const before = await measure(page);
      await page.locator("[data-spectrum-fft]").selectOption(fft);
      await settle(page);
      const after = await measure(page);
      metrics.push({
        route: "/spectrum-analyzer",
        viewport: viewport.name,
        control: "fft-size",
        state: fft,
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

  fs.writeFileSync(
    path.join(artifactRoot, "extra-state-metrics.json"),
    `${JSON.stringify(metrics, null, 2)}\n`,
    "utf8",
  );

  expect(metrics.length).toBeGreaterThan(0);
});
