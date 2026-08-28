import { describe, expect, it } from "vitest";

import {
  dbToGain,
  getEffectiveMaxFrequency,
  getSweepFrequencyAtElapsed,
  getWorstCaseSummingCoefficient,
  type SweepDefinition,
} from "../../src/utils/audio";
import {
  frequencyToSliderPosition,
  sliderPositionToFrequency,
} from "../../src/components/controls/controlMath";

const logarithmicSweep: SweepDefinition = {
  lowHz: 20,
  highHz: 20_000,
  durationSeconds: 10,
  direction: "ascending",
  scale: "logarithmic",
};

describe("shared audio math", () => {
  it("converts dB relative to unity into linear gain", () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-20)).toBeCloseTo(0.1, 8);
    expect(dbToGain(-6)).toBeCloseTo(0.501187, 6);
  });

  it("uses the 95% Nyquist-safe generated-frequency cap", () => {
    expect(getEffectiveMaxFrequency(48_000, 20_000)).toBe(20_000);
    expect(getEffectiveMaxFrequency(32_000, 20_000)).toBe(15_200);
  });

  it("preserves worst-case headroom for same-channel sums", () => {
    expect(getWorstCaseSummingCoefficient(1)).toBe(1);
    expect(getWorstCaseSummingCoefficient(2)).toBe(0.5);
    expect(getWorstCaseSummingCoefficient(4)).toBe(0.25);
  });

  it("computes canonical logarithmic sweep frequencies", () => {
    expect(getSweepFrequencyAtElapsed(logarithmicSweep, 0)).toBe(20);
    expect(getSweepFrequencyAtElapsed(logarithmicSweep, 5)).toBeCloseTo(
      Math.sqrt(20 * 20_000),
      8,
    );
    expect(getSweepFrequencyAtElapsed(logarithmicSweep, 10)).toBe(20_000);
  });

  it("reverses endpoints for descending sweeps", () => {
    const descending: SweepDefinition = {
      ...logarithmicSweep,
      direction: "descending",
      scale: "linear",
    };

    expect(getSweepFrequencyAtElapsed(descending, 0)).toBe(20_000);
    expect(getSweepFrequencyAtElapsed(descending, 10)).toBe(20);
  });

  it("round-trips logarithmic frequency slider positions", () => {
    const frequency = 440;
    const position = frequencyToSliderPosition(frequency, 20, 20_000);
    expect(sliderPositionToFrequency(position, 20, 20_000)).toBeCloseTo(
      frequency,
      8,
    );
  });
});
