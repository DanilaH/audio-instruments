import { expect, test } from "@playwright/test";

interface OscillatorRecord {
  frequencyHz: number | null;
  startTime: number | null;
  readonly stopTimes: number[];
}

test("Stop cancels an unsounded high-frequency tone before its scheduled start", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const oscillators: OscillatorRecord[] = [];

    class FakeAudioParam {
      value = 1;

      constructor(private readonly onValue?: (value: number) => void) {}

      setValueAtTime(value: number, _time: number) {
        this.value = value;
        this.onValue?.(value);
        return this;
      }

      linearRampToValueAtTime(value: number, _time: number) {
        this.value = value;
        this.onValue?.(value);
        return this;
      }

      cancelScheduledValues(_time: number) {
        return this;
      }

      cancelAndHoldAtTime(_time: number) {
        return this;
      }
    }

    class FakeNode {
      readonly connections: unknown[] = [];

      constructor(readonly context: BaseAudioContext) {}

      connect(destination: unknown) {
        this.connections.push(destination);
        return destination;
      }

      disconnect(destination?: unknown) {
        if (destination !== undefined) {
          const index = this.connections.indexOf(destination);
          if (index >= 0) this.connections.splice(index, 1);
          return;
        }
        this.connections.length = 0;
      }
    }

    class FakeGainNode extends FakeNode {
      readonly gain = new FakeAudioParam();
    }

    class FakeOscillatorNode extends EventTarget {
      readonly frequency: FakeAudioParam;
      type: OscillatorType = "sine";
      readonly _record: OscillatorRecord;

      constructor(readonly context: BaseAudioContext) {
        super();
        this._record = {
          frequencyHz: null,
          startTime: null,
          stopTimes: [],
        };
        oscillators.push(this._record);
        this.frequency = new FakeAudioParam((value) => {
          this._record.frequencyHz = value;
        });
      }

      connect(destination: unknown) {
        return destination;
      }

      disconnect() {}

      start(when = 0) {
        this._record.startTime = when;
      }

      stop(when = 0) {
        this._record.stopTimes.push(when);
      }
    }

    class FakeAudioContext {
      readonly sampleRate = 48_000;
      readonly destination: FakeNode;
      state: AudioContextState = "suspended";

      constructor(_options?: AudioContextOptions) {
        this.destination = new FakeNode(this as unknown as BaseAudioContext);
      }

      get currentTime(): number {
        return 0;
      }

      async resume() {
        this.state = "running";
      }

      async close() {
        this.state = "closed";
      }

      createGain() {
        return new FakeGainNode(
          this as unknown as BaseAudioContext,
        ) as unknown as GainNode;
      }

      createOscillator() {
        return new FakeOscillatorNode(
          this as unknown as BaseAudioContext,
        ) as unknown as OscillatorNode;
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
    Reflect.set(window, "__hearingBoundaryOscillators", oscillators);
  });

  await page.goto("/hearing-frequency-test");
  await page.locator("[data-hearing-reference]").click();
  await expect(
    page.locator("#hearing-frequency-status [data-status-label]"),
  ).toHaveText("Setup reference complete", { timeout: 2_000 });
  await page.locator("[data-hearing-setup-confirm]").check();
  await page.locator('input[name="hearing-mode"][value="manual"]').check();

  await page.locator("[data-hearing-manual-play]").click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            Reflect.get(
              window,
              "__hearingBoundaryOscillators",
            ) as OscillatorRecord[]
          ).length,
      ),
    )
    .toBe(2);

  await page.locator("[data-hearing-stop]").click();

  const manual = await page.evaluate(() => {
    const records = Reflect.get(
      window,
      "__hearingBoundaryOscillators",
    ) as OscillatorRecord[];
    return structuredClone(records[1]);
  });

  expect(manual?.frequencyHz).toBe(2_000);
  expect(manual?.startTime).toBe(0.05);
  expect(manual?.stopTimes.length).toBeGreaterThanOrEqual(2);
  expect(Math.min(...(manual?.stopTimes ?? []))).toBeLessThan(
    manual?.startTime ?? 0,
  );
  await expect(
    page.locator("#hearing-frequency-status [data-status-label]"),
  ).toHaveText("Stopped");
});
