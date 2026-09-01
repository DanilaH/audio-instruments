from pathlib import Path

p = Path("tests/browser/audio-latency.spec.ts")
text = p.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"replacement target count={count}: {old[:80]!r}")
    text = text.replace(old, new, 1)


replace_once(
    '''async function contextCurrentTime(page: Page): Promise<number> {
  return page.evaluate(() => {
    const currentTime = Reflect.get(
      window,
      "__latencyCurrentTime",
    ) as () => number;
    return currentTime();
  });
}

async function setOffset(page: Page, value: number): Promise<void> {
  await page.locator("[data-latency-offset]").evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}
''',
    '''interface OffsetChangeSnapshot {
  readonly oscillatorCount: number;
  readonly contextTime: number;
}

async function setOffset(
  page: Page,
  value: number,
): Promise<OffsetChangeSnapshot> {
  return page
    .locator("[data-latency-offset]")
    .evaluate((element, nextValue) => {
      const state = Reflect.get(
        window,
        "__latencyHarness",
      ) as LatencyHarnessState;
      const currentTime = Reflect.get(
        window,
        "__latencyCurrentTime",
      ) as () => number;
      const snapshot: OffsetChangeSnapshot = {
        oscillatorCount: state.oscillators.length,
        contextTime: currentTime(),
      };

      const input = element as HTMLInputElement;
      input.value = String(nextValue);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return snapshot;
    }, value);
}
''',
)

replace_once(
    '''  const beforePositiveState = await harnessState(page);
  const oldCount = beforePositiveState.oscillators.length;
  const beforePositiveTime = await contextCurrentTime(page);
  await setOffset(page, 50);
''',
    '''  const positiveChange = await setOffset(page, 50);
''',
)
replace_once(
    ".toBeGreaterThan(oldCount);",
    ".toBeGreaterThan(positiveChange.oscillatorCount);",
)
replace_once(
    "  const firstPositiveStart = positiveState.oscillators[oldCount]?.startTime;",
    "  const firstPositiveStart =\n    positiveState.oscillators[positiveChange.oscillatorCount]?.startTime;",
)
replace_once(
    "  expect((firstPositiveStart ?? 0) - beforePositiveTime).toBeGreaterThan(0.5);",
    "  expect(\n    (firstPositiveStart ?? 0) - positiveChange.contextTime,\n  ).toBeGreaterThan(0.5);",
)
replace_once(
    "  expect((firstPositiveStart ?? 0) - beforePositiveTime).toBeLessThan(0.65);",
    "  expect(\n    (firstPositiveStart ?? 0) - positiveChange.contextTime,\n  ).toBeLessThan(0.65);",
)
replace_once(
    "  for (const oscillator of positiveState.oscillators.slice(0, oldCount)) {",
    "  for (const oscillator of positiveState.oscillators.slice(\n    0,\n    positiveChange.oscillatorCount,\n  )) {",
)

replace_once(
    '''  const beforeNegativeCount = positiveState.oscillators.length;
  const beforeNegativeTime = await contextCurrentTime(page);
  await setOffset(page, -50);
''',
    '''  const negativeChange = await setOffset(page, -50);
''',
)
replace_once(
    ".toBeGreaterThan(beforeNegativeCount);",
    ".toBeGreaterThan(negativeChange.oscillatorCount);",
)
replace_once(
    "    negativeState.oscillators[beforeNegativeCount]?.startTime;",
    "    negativeState.oscillators[negativeChange.oscillatorCount]?.startTime;",
)
replace_once(
    "  expect((firstNegativeStart ?? 0) - beforeNegativeTime).toBeGreaterThan(0.38);",
    "  expect(\n    (firstNegativeStart ?? 0) - negativeChange.contextTime,\n  ).toBeGreaterThan(0.38);",
)
replace_once(
    "  expect((firstNegativeStart ?? 0) - beforeNegativeTime).toBeLessThan(0.55);",
    "  expect(\n    (firstNegativeStart ?? 0) - negativeChange.contextTime,\n  ).toBeLessThan(0.55);",
)

p.write_text(text)
