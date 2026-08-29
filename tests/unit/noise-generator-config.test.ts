import { describe, expect, it } from "vitest";

import {
  NOISE_GENERATOR_KINDS,
  NOISE_GENERATOR_TIMER_MINUTES,
  getNoiseTimerDurationMs,
  isNoiseTimerMinutes,
} from "../../src/tools/noise-generator/config";

describe("Noise Generator control contract", () => {
  it("exposes only the documented noise kinds and timer choices", () => {
    expect(NOISE_GENERATOR_KINDS).toEqual(["white", "pink", "brown"]);
    expect(NOISE_GENERATOR_TIMER_MINUTES).toEqual([0, 1, 5, 10]);
  });

  it("maps documented timer choices to exact playback durations", () => {
    expect(getNoiseTimerDurationMs(0)).toBeNull();
    expect(getNoiseTimerDurationMs(1)).toBe(60_000);
    expect(getNoiseTimerDurationMs(5)).toBe(300_000);
    expect(getNoiseTimerDurationMs(10)).toBe(600_000);
  });

  it("rejects timer values outside the documented set", () => {
    expect(isNoiseTimerMinutes(0)).toBe(true);
    expect(isNoiseTimerMinutes(10)).toBe(true);
    expect(isNoiseTimerMinutes(2)).toBe(false);
    expect(isNoiseTimerMinutes(Number.NaN)).toBe(false);
  });
});
