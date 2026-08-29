import { describe, expect, it } from "vitest";

import {
  BASS_SWEEP_DEFAULT_DURATION_SECONDS,
  CHANNEL_SEQUENCE_GAP_SECONDS,
  CHANNEL_SEQUENCE_STEP_SECONDS,
  CHANNEL_TEST_DURATION_SECONDS,
  CHANNEL_TEST_FREQUENCY_HZ,
  createBassSweepDefinition,
} from "../../src/browser/audio-output/referenceSignals";

describe("shared output reference signals", () => {
  it("keeps the canonical channel burst and sequence timing", () => {
    expect(CHANNEL_TEST_FREQUENCY_HZ).toBe(500);
    expect(CHANNEL_TEST_DURATION_SECONDS).toBe(0.7);
    expect(CHANNEL_SEQUENCE_GAP_SECONDS).toBe(0.3);
    expect(CHANNEL_SEQUENCE_STEP_SECONDS).toBe(1);
  });

  it("builds the Speaker bass/rattle sweep through the reusable Bass primitive", () => {
    expect(createBassSweepDefinition(40, 120)).toEqual({
      lowHz: 40,
      highHz: 120,
      durationSeconds: BASS_SWEEP_DEFAULT_DURATION_SECONDS,
      direction: "ascending",
      scale: "logarithmic",
    });
    expect(BASS_SWEEP_DEFAULT_DURATION_SECONDS).toBe(12);
  });

  it("rejects bass sweeps outside the v1 20–200 Hz contract", () => {
    expect(() => createBassSweepDefinition(19, 120)).toThrow("Bass sweep");
    expect(() => createBassSweepDefinition(40, 201)).toThrow("Bass sweep");
    expect(() => createBassSweepDefinition(120, 40)).toThrow("lowHz");
  });
});
