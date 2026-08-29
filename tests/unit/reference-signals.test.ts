import { describe, expect, it } from "vitest";

import {
  BASS_PRESET_FREQUENCIES_HZ,
  BASS_PRESET_SEQUENCE_GAP_SECONDS,
  BASS_PRESET_SEQUENCE_MAX_HZ,
  BASS_PRESET_SEQUENCE_STEP_SECONDS,
  BASS_PRESET_SEQUENCE_TOTAL_SECONDS,
  BASS_PRESET_TONE_DURATION_SECONDS,
  BASS_SINGLE_TONE_DEFAULT_HZ,
  BASS_SWEEP_DEFAULT_DURATION_SECONDS,
  BASS_SWEEP_DEFAULT_HIGH_HZ,
  BASS_SWEEP_DEFAULT_LOW_HZ,
  BASS_SWEEP_MAX_HZ,
  BASS_SWEEP_MIN_HZ,
  CHANNEL_SEQUENCE_GAP_SECONDS,
  CHANNEL_SEQUENCE_STEP_SECONDS,
  CHANNEL_SEQUENCE_TOTAL_SECONDS,
  CHANNEL_TEST_DURATION_SECONDS,
  CHANNEL_TEST_FREQUENCY_HZ,
  FREQUENCY_SWEEP_DEFAULT_DIRECTION,
  FREQUENCY_SWEEP_DEFAULT_DURATION_SECONDS,
  FREQUENCY_SWEEP_DEFAULT_HIGH_HZ,
  FREQUENCY_SWEEP_DEFAULT_LOW_HZ,
  FREQUENCY_SWEEP_DEFAULT_SCALE,
  FREQUENCY_SWEEP_MAX_DURATION_SECONDS,
  FREQUENCY_SWEEP_MAX_HZ,
  FREQUENCY_SWEEP_MIN_DURATION_SECONDS,
  FREQUENCY_SWEEP_MIN_HZ,
  createBassSweepDefinition,
  createFrequencySweepDefinition,
} from "../../src/browser/audio-output/referenceSignals";

describe("shared output reference signals", () => {
  it("keeps the canonical channel burst and sequence timing", () => {
    expect(CHANNEL_TEST_FREQUENCY_HZ).toBe(500);
    expect(CHANNEL_TEST_DURATION_SECONDS).toBe(0.7);
    expect(CHANNEL_SEQUENCE_GAP_SECONDS).toBe(0.3);
    expect(CHANNEL_SEQUENCE_STEP_SECONDS).toBe(1);
    expect(CHANNEL_SEQUENCE_TOTAL_SECONDS).toBe(2.7);
  });

  it("builds Bass sweeps through the reusable shared primitive", () => {
    expect(createBassSweepDefinition(40, 120)).toEqual({
      lowHz: 40,
      highHz: 120,
      durationSeconds: BASS_SWEEP_DEFAULT_DURATION_SECONDS,
      direction: "ascending",
      scale: "logarithmic",
    });
    expect(
      createBassSweepDefinition(
        BASS_SWEEP_DEFAULT_LOW_HZ,
        BASS_SWEEP_DEFAULT_HIGH_HZ,
      ),
    ).toEqual({
      lowHz: 20,
      highHz: 120,
      durationSeconds: 12,
      direction: "ascending",
      scale: "logarithmic",
    });
    expect(BASS_SWEEP_MIN_HZ).toBe(20);
    expect(BASS_SWEEP_MAX_HZ).toBe(200);
  });

  it("keeps the exact Bass single-tone and preset sequence references", () => {
    expect(BASS_SINGLE_TONE_DEFAULT_HZ).toBe(60);
    expect(BASS_PRESET_FREQUENCIES_HZ).toContain(BASS_SINGLE_TONE_DEFAULT_HZ);
    expect(BASS_PRESET_FREQUENCIES_HZ).toEqual([
      20, 30, 40, 50, 60, 80, 100,
    ]);
    expect(BASS_PRESET_SEQUENCE_MAX_HZ).toBe(100);
    expect(BASS_PRESET_TONE_DURATION_SECONDS).toBe(0.8);
    expect(BASS_PRESET_SEQUENCE_GAP_SECONDS).toBe(0.3);
    expect(BASS_PRESET_SEQUENCE_STEP_SECONDS).toBe(1.1);
    expect(BASS_PRESET_SEQUENCE_TOTAL_SECONDS).toBeCloseTo(7.4, 10);
  });

  it("rejects bass sweeps outside the v1 20–200 Hz contract", () => {
    expect(() => createBassSweepDefinition(19, 120)).toThrow("Bass sweep");
    expect(() => createBassSweepDefinition(40, 201)).toThrow("Bass sweep");
    expect(() => createBassSweepDefinition(120, 40)).toThrow("lowHz");
  });

  it("keeps the standalone Frequency Sweep defaults and bounds", () => {
    expect(FREQUENCY_SWEEP_MIN_HZ).toBe(20);
    expect(FREQUENCY_SWEEP_MAX_HZ).toBe(20_000);
    expect(FREQUENCY_SWEEP_DEFAULT_LOW_HZ).toBe(20);
    expect(FREQUENCY_SWEEP_DEFAULT_HIGH_HZ).toBe(20_000);
    expect(FREQUENCY_SWEEP_MIN_DURATION_SECONDS).toBe(5);
    expect(FREQUENCY_SWEEP_MAX_DURATION_SECONDS).toBe(60);
    expect(FREQUENCY_SWEEP_DEFAULT_DURATION_SECONDS).toBe(15);
    expect(FREQUENCY_SWEEP_DEFAULT_SCALE).toBe("logarithmic");
    expect(FREQUENCY_SWEEP_DEFAULT_DIRECTION).toBe("ascending");

    expect(
      createFrequencySweepDefinition(
        FREQUENCY_SWEEP_DEFAULT_LOW_HZ,
        FREQUENCY_SWEEP_DEFAULT_HIGH_HZ,
        FREQUENCY_SWEEP_DEFAULT_DURATION_SECONDS,
        FREQUENCY_SWEEP_DEFAULT_SCALE,
        FREQUENCY_SWEEP_DEFAULT_DIRECTION,
      ),
    ).toEqual({
      lowHz: 20,
      highHz: 20_000,
      durationSeconds: 15,
      scale: "logarithmic",
      direction: "ascending",
    });
  });

  it("preserves custom Frequency Sweep scale and direction without duplicating sweep math", () => {
    expect(
      createFrequencySweepDefinition(100, 8_000, 32, "linear", "descending"),
    ).toEqual({
      lowHz: 100,
      highHz: 8_000,
      durationSeconds: 32,
      scale: "linear",
      direction: "descending",
    });
  });

  it("rejects Frequency Sweep bounds, duration and endpoint order outside the v1 contract", () => {
    expect(() =>
      createFrequencySweepDefinition(19, 1_000, 15, "logarithmic", "ascending"),
    ).toThrow("Frequency Sweep");
    expect(() =>
      createFrequencySweepDefinition(20, 20_001, 15, "logarithmic", "ascending"),
    ).toThrow("Frequency Sweep");
    expect(() =>
      createFrequencySweepDefinition(20, 1_000, 4, "logarithmic", "ascending"),
    ).toThrow("duration");
    expect(() =>
      createFrequencySweepDefinition(20, 1_000, 61, "logarithmic", "ascending"),
    ).toThrow("duration");
    expect(() =>
      createFrequencySweepDefinition(2_000, 1_000, 15, "linear", "descending"),
    ).toThrow("lowHz");
  });
});
