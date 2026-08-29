import { describe, expect, it } from "vitest";

import {
  HEARING_GUIDED_FREQUENCIES_HZ,
  formatHearingFrequency,
  getHearingCapability,
  nextGuidedFrequency,
  recordHeardFrequency,
} from "../../src/tools/hearing-frequency/hearingTestModel";

describe("Hearing Frequency Test capability", () => {
  it("keeps the full nominal guided list at a 48 kHz analysis rate", () => {
    const capability = getHearingCapability(48_000);

    expect(capability.effectiveMaxHz).toBe(20_000);
    expect(capability.referenceAvailable).toBe(true);
    expect(capability.limited).toBe(false);
    expect(capability.guidedFrequenciesHz).toEqual(HEARING_GUIDED_FREQUENCIES_HZ);
  });

  it("removes guided steps above the shared Nyquist-safe cap", () => {
    const capability = getHearingCapability(32_000);

    expect(capability.effectiveMaxHz).toBe(15_200);
    expect(capability.limited).toBe(true);
    expect(capability.guidedFrequenciesHz).toEqual([
      2_000,
      4_000,
      6_000,
      8_000,
      10_000,
      12_000,
      14_000,
    ]);
  });

  it("marks the 1 kHz setup reference unavailable when the context cannot generate it safely", () => {
    const capability = getHearingCapability(2_000);

    expect(capability.effectiveMaxHz).toBe(950);
    expect(capability.referenceAvailable).toBe(false);
    expect(capability.guidedFrequenciesHz).toEqual([]);
  });
});

describe("Hearing Frequency Test guided session", () => {
  it("returns the current guided step without inventing frequencies", () => {
    expect(nextGuidedFrequency([2_000, 4_000, 6_000], 0)).toBe(2_000);
    expect(nextGuidedFrequency([2_000, 4_000, 6_000], 2)).toBe(6_000);
    expect(nextGuidedFrequency([2_000, 4_000, 6_000], 3)).toBeNull();
  });

  it("tracks only the highest frequency explicitly reported heard", () => {
    expect(recordHeardFrequency(null, 4_000)).toBe(4_000);
    expect(recordHeardFrequency(4_000, 2_000)).toBe(4_000);
    expect(recordHeardFrequency(4_000, 8_000)).toBe(8_000);
  });

  it("formats session observations without diagnostic language", () => {
    expect(formatHearingFrequency(2_000)).toBe("2 kHz");
    expect(formatHearingFrequency(12_000)).toBe("12 kHz");
    expect(formatHearingFrequency(750)).toBe("750 Hz");
  });
});
