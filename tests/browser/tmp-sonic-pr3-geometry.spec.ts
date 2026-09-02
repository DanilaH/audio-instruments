import { test } from "@playwright/test";

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
] as const) {
  test(`Tone geometry probe ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/tone-generator");

    const metrics = await page.evaluate(() => {
      const allSonic = [
        ...document.querySelectorAll<HTMLElement>("[data-sonic-instrument]"),
      ];
      const tone = document.querySelector<HTMLElement>(
        '[aria-label="Tone Generator controls and waveform"]',
      );
      const play = document.querySelector<HTMLElement>("#tone-play-stop");
      const safety = document.querySelector<HTMLElement>(".tone-safety");
      const bar = document.querySelector<HTMLElement>(".tone-sheet__bar");
      const field = document.querySelector<HTMLElement>(".tone-field");
      const rail = document.querySelector<HTMLElement>(".tone-rail");
      const railChildren = rail ? ([...rail.children] as HTMLElement[]) : [];
      const rect = (element: HTMLElement | null) => {
        if (!element) return null;
        const value = element.getBoundingClientRect();
        return {
          x: value.x,
          y: value.y,
          width: value.width,
          height: value.height,
          bottom: value.bottom,
        };
      };
      return {
        sonicCount: allSonic.length,
        sonic: allSonic.map((element) => ({
          label: element.getAttribute("aria-label"),
          rect: rect(element),
        })),
        tone: rect(tone),
        bar: rect(bar),
        field: rect(field),
        rail: rect(rail),
        railChildren: railChildren.map((element) => ({
          className: element.className,
          rect: rect(element),
          scrollHeight: element.scrollHeight,
        })),
        play: rect(play),
        safety: rect(safety),
        playInsideTone: Boolean(play && tone && tone.contains(play)),
        safetyInsideTone: Boolean(safety && tone && tone.contains(safety)),
        documentHeight: document.documentElement.scrollHeight,
      };
    });

    console.log(
      `PR3_TONE_GEOMETRY ${viewport.width}x${viewport.height}`,
      JSON.stringify(metrics),
    );
  });
}
