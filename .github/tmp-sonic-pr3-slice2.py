from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)


controller = Path("src/tools/bass-test/BassTestController.ts")
text = controller.read_text()
text = replace_once(
    text,
    'import { clamp, getEffectiveMaxFrequency } from "../../utils/audio";',
    '''import {
  clamp,
  getEffectiveMaxFrequency,
  getSweepFrequencyAtElapsed,
  type SweepDefinition,
} from "../../utils/audio";''',
    "Bass audio utility import",
)
text = replace_once(
    text,
    "  #runToken = 0;\n",
    "  #runToken = 0;\n  #sweepFrameId: number | null = null;\n",
    "Bass sweep frame field",
)
text = replace_once(
    text,
    "    this.#clearTimers();\n    this.#playbacks = [];\n",
    "    this.#clearTimers();\n    this.#clearSweepFrame();\n    this.#playbacks = [];\n",
    "Bass dispose sweep cleanup",
)
old_sweep_state = '''      this.#starting = false;
      this.#setControlsActive(true);
      this.#frequencyReadout.textContent = `${definition.lowHz}–${definition.highHz}`;
      this.#setVisual("sweep", `${definition.lowHz} → ${definition.highHz} Hz`);
      this.#setStatus("playing", "Slow bass sweep running");
      this.#schedule('''
new_sweep_state = '''      this.#starting = false;
      this.#setControlsActive(true);
      this.#frequencyReadout.textContent = String(Math.round(definition.lowHz));
      this.#setVisual("sweep", `${Math.round(definition.lowHz)} Hz · sweep`);
      this.#setStatus("playing", "Slow bass sweep running");
      this.#startSweepReadout(context, definition, startTime, token);
      this.#schedule('''
text = replace_once(text, old_sweep_state, new_sweep_state, "Bass sweep live readout start")
text = replace_once(
    text,
    '''    this.#starting = false;
    this.#playbacks = [];
    this.#clearTimers();
    this.#setControlsActive(false);''',
    '''    this.#starting = false;
    this.#playbacks = [];
    this.#clearTimers();
    this.#clearSweepFrame();
    this.#setControlsActive(false);''',
    "Bass start-error sweep cleanup",
)
text = replace_once(
    text,
    '''    this.#starting = false;
    this.#clearTimers();
    for (const playback of this.#playbacks) playback.stop();''',
    '''    this.#starting = false;
    this.#clearTimers();
    this.#clearSweepFrame();
    for (const playback of this.#playbacks) playback.stop();''',
    "Bass stop sweep cleanup",
)
text = replace_once(
    text,
    '''  #finishRun(): void {
    this.#clearTimers();
    this.#starting = false;''',
    '''  #finishRun(): void {
    this.#clearTimers();
    this.#clearSweepFrame();
    this.#starting = false;''',
    "Bass finish sweep cleanup",
)
text = replace_once(
    text,
    '''  #schedule(delayMs: number, token: number, action: () => void): void {
    const timer = window.setTimeout(() => {''',
    '''  #startSweepReadout(
    context: AudioContext,
    definition: SweepDefinition,
    startTime: number,
    token: number,
  ): void {
    this.#clearSweepFrame();
    let lastRoundedHz = -1;

    const update = () => {
      if (!this.#isCurrentRun(token) || this.#mode !== "sweep") {
        this.#sweepFrameId = null;
        return;
      }

      const elapsedSeconds = Math.max(0, context.currentTime - startTime);
      const currentHz = Math.round(
        getSweepFrequencyAtElapsed(definition, elapsedSeconds),
      );
      if (currentHz !== lastRoundedHz) {
        lastRoundedHz = currentHz;
        this.#frequencyReadout.textContent = String(currentHz);
        this.#setVisual("sweep", `${currentHz} Hz · sweep`);
      }

      if (elapsedSeconds < definition.durationSeconds) {
        this.#sweepFrameId = window.requestAnimationFrame(update);
      } else {
        this.#sweepFrameId = null;
      }
    };

    update();
  }

  #clearSweepFrame(): void {
    if (this.#sweepFrameId === null) return;
    window.cancelAnimationFrame(this.#sweepFrameId);
    this.#sweepFrameId = null;
  }

  #schedule(delayMs: number, token: number, action: () => void): void {
    const timer = window.setTimeout(() => {''',
    "Bass sweep readout methods",
)
text = replace_once(
    text,
    '''  #resetIdleUi(): void {
    this.#effectiveMaxHz = BASS_SWEEP_MAX_HZ;''',
    '''  #resetIdleUi(): void {
    this.#clearSweepFrame();
    this.#effectiveMaxHz = BASS_SWEEP_MAX_HZ;''',
    "Bass reset sweep cleanup",
)
controller.write_text(text)


spec = Path("tests/browser/bass-test.spec.ts")
text = spec.read_text()
text = replace_once(
    text,
    '''        constructor() {
          incrementCounter("__bassAudioContextCount");
        }''',
    '''        constructor() {
          incrementCounter("__bassAudioContextCount");
          Reflect.set(window, "__bassAudioContext", this);
        }''',
    "Bass deterministic context exposure",
)
text = replace_once(
    text,
    'test("Bass slow sweep uses the shared 20 to 120 Hz logarithmic 12 second primitive", async ({',
    'test("Bass slow sweep uses the shared logarithmic primitive and reports its current scheduled frequency", async ({',
    "Bass live readout test title",
)
old_expectation = '''  await expect(page.locator("[data-bass-frequency-readout]")).toHaveText(
    "20–120",
  );
});'''
new_expectation = '''  const readout = page.locator("[data-bass-frequency-readout]");
  await expect(readout).toHaveText("20");

  await page.evaluate(() => {
    const context = Reflect.get(window, "__bassAudioContext") as
      | { currentTime: number }
      | undefined;
    if (!context) throw new Error("Bass deterministic AudioContext is missing");
    context.currentTime = 6;
  });
  await expect(readout).toHaveText("49");

  await page.evaluate(() => {
    const context = Reflect.get(window, "__bassAudioContext") as
      | { currentTime: number }
      | undefined;
    if (!context) throw new Error("Bass deterministic AudioContext is missing");
    context.currentTime = 12;
  });
  await expect(readout).toHaveText("120");

  await page.locator("[data-bass-stop]").click();
  await expect(readout).toHaveText("60");
});'''
text = replace_once(text, old_expectation, new_expectation, "Bass live sweep expectation")
spec.write_text(text)
