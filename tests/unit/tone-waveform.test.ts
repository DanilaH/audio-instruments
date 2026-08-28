import { describe, expect, it } from "vitest";

import { sampleToneWaveform } from "../../src/tools/tone-generator/ToneWaveformRenderer";

describe("Tone waveform primitives", () => {
  it("samples the canonical oscillator shapes at stable phases", () => {
    expect(sampleToneWaveform("sine", 0)).toBeCloseTo(0, 12);
    expect(sampleToneWaveform("sine", 0.25)).toBeCloseTo(1, 12);
    expect(sampleToneWaveform("sine", 0.5)).toBeCloseTo(0, 12);

    expect(sampleToneWaveform("square", 0)).toBe(1);
    expect(sampleToneWaveform("square", 0.25)).toBe(1);
    expect(sampleToneWaveform("square", 0.75)).toBe(-1);

    expect(sampleToneWaveform("triangle", 0)).toBeCloseTo(0, 12);
    expect(sampleToneWaveform("triangle", 0.25)).toBeCloseTo(1, 12);
    expect(sampleToneWaveform("triangle", 0.75)).toBeCloseTo(-1, 12);

    expect(sampleToneWaveform("sawtooth", 0)).toBeCloseTo(0, 12);
    expect(sampleToneWaveform("sawtooth", 0.25)).toBeCloseTo(0.5, 12);
    expect(sampleToneWaveform("sawtooth", 0.75)).toBeCloseTo(-0.5, 12);
  });

  it("wraps phase values without changing the waveform", () => {
    for (const waveform of [
      "sine",
      "square",
      "triangle",
      "sawtooth",
    ] as const) {
      expect(sampleToneWaveform(waveform, 1.25)).toBeCloseTo(
        sampleToneWaveform(waveform, 0.25),
        12,
      );
      expect(sampleToneWaveform(waveform, -0.25)).toBeCloseTo(
        sampleToneWaveform(waveform, 0.75),
        12,
      );
    }
  });
});
