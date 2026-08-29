import { describe, expect, it } from "vitest";

import {
  PITCH_ANALYSIS_INTERVAL_MS,
  PITCH_MAX_ANALYSES_PER_SECOND,
  PITCH_MIN_CONFIDENCE,
  PITCH_STABILIZATION_WINDOW,
  PitchStabilizer,
  downsampleAveraged,
  estimatePitchYin,
  getPitchAnalysisConfiguration,
  mapFrequencyToNote,
  type YinPitchEstimate,
} from "../../src/browser/analysis/pitch";

function sineFrame(
  frequencyHz: number,
  sampleRate: number,
  sampleCount: number,
): Float32Array {
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = Math.sin((2 * Math.PI * frequencyHz * index) / sampleRate);
  }
  return samples;
}

function estimateAtContextRate(
  frequencyHz: number,
  contextRate: number,
): YinPitchEstimate | null {
  const configuration = getPitchAnalysisConfiguration(contextRate);
  const source = sineFrame(
    frequencyHz,
    contextRate,
    configuration.sourceFrameSize,
  );
  const analysis = downsampleAveraged(
    source,
    configuration.downsampleFactor,
  );
  return estimatePitchYin(analysis, configuration.analysisRate);
}

function estimate(frequencyHz: number, confidence = 0.95): YinPitchEstimate {
  return {
    frequencyHz,
    confidence,
    selectedTau: 100,
    refinedTau: 100,
    cmndfValue: 1 - confidence,
  };
}

describe("Pitch analysis configuration", () => {
  it.each([
    [44_100, 1, 44_100, 2_048, 2_048],
    [48_000, 1, 48_000, 2_048, 2_048],
    [88_200, 2, 44_100, 2_048, 4_096],
    [96_000, 2, 48_000, 2_048, 4_096],
    [176_400, 4, 44_100, 2_048, 8_192],
    [192_000, 4, 48_000, 2_048, 8_192],
  ])(
    "bounds %i Hz context processing",
    (contextRate, factor, analysisRate, frameSize, sourceFrameSize) => {
      const configuration = getPitchAnalysisConfiguration(contextRate);

      expect(configuration.downsampleFactor).toBe(factor);
      expect(configuration.analysisRate).toBe(analysisRate);
      expect(configuration.frameSize).toBe(frameSize);
      expect(configuration.sourceFrameSize).toBe(sourceFrameSize);
      expect(configuration.tauMin).toBe(
        Math.max(1, Math.floor(analysisRate / 2_000)),
      );
      expect(configuration.tauMax).toBe(Math.ceil(analysisRate / 50));
      expect(configuration.tauMax).toBeLessThanOrEqual(frameSize / 2);
      expect(configuration.analysisRate).toBeLessThanOrEqual(48_000);
    },
  );

  it("caps YIN cadence at 20 analyses per second", () => {
    expect(PITCH_MAX_ANALYSES_PER_SECOND).toBe(20);
    expect(PITCH_ANALYSIS_INTERVAL_MS).toBe(50);
  });
});

describe("Pitch downsampling", () => {
  it("averages complete groups and discards an incomplete trailing group", () => {
    const source = new Float32Array([1, 3, 2, 6, 100]);
    expect([...downsampleAveraged(source, 2)]).toEqual([2, 4]);
  });

  it("preserves samples for factor one", () => {
    const source = new Float32Array([0.1, -0.2, 0.3]);
    const output = downsampleAveraged(source, 1);
    expect(output[0]).toBeCloseTo(0.1, 6);
    expect(output[1]).toBeCloseTo(-0.2, 6);
    expect(output[2]).toBeCloseTo(0.3, 6);
  });
});

describe("bounded YIN", () => {
  it.each([
    [110, 48_000],
    [220, 44_100],
    [440, 48_000],
    [880, 96_000],
    [1_760, 192_000],
  ])("estimates a %i Hz monophonic sine at %i Hz context rate", (frequency, rate) => {
    const result = estimateAtContextRate(frequency, rate);

    expect(result).not.toBeNull();
    expect(Math.abs((result?.frequencyHz ?? 0) - frequency)).toBeLessThan(
      frequency * 0.001,
    );
    expect(result?.confidence).toBeGreaterThanOrEqual(PITCH_MIN_CONFIDENCE);
  });

  it.each([
    [50, 44_100],
    [1_990, 44_100],
    [2_000, 44_100],
    [50, 48_000],
    [2_000, 48_000],
  ])("keeps %i Hz inside the accepted target at %i Hz context rate", (frequency, rate) => {
    const result = estimateAtContextRate(frequency, rate);

    expect(result).not.toBeNull();
    expect(result?.frequencyHz).toBeGreaterThanOrEqual(50);
    expect(result?.frequencyHz).toBeLessThanOrEqual(2_000);
    expect(Math.abs((result?.frequencyHz ?? 0) - frequency)).toBeLessThan(
      Math.max(1, frequency * 0.002),
    );
  });

  it("rejects silence instead of emitting a random note", () => {
    const configuration = getPitchAnalysisConfiguration(48_000);
    const result = estimatePitchYin(
      new Float32Array(configuration.frameSize),
      configuration.analysisRate,
    );

    expect(result).toBeNull();
  });

  it("rejects frames that cannot contain the documented 50 Hz search lag", () => {
    expect(() => estimatePitchYin(new Float32Array(1_024), 48_000)).toThrow(
      "YIN frame must contain at least two periods",
    );
  });
});

describe("Pitch note mapping", () => {
  it("maps A4 exactly to MIDI 69 and zero cents", () => {
    expect(mapFrequencyToNote(440)).toMatchObject({
      nearestMidi: 69,
      noteName: "A",
      octave: 4,
      noteFrequencyHz: 440,
      cents: 0,
    });
  });

  it("maps middle C and signed cents around the nearest note", () => {
    const c4 = mapFrequencyToNote(261.625565);
    expect(c4.noteName).toBe("C");
    expect(c4.octave).toBe(4);
    expect(c4.cents).toBeCloseTo(0, 3);

    expect(mapFrequencyToNote(445).cents).toBeGreaterThan(0);
    expect(mapFrequencyToNote(435).cents).toBeLessThan(0);
  });
});

describe("PitchStabilizer", () => {
  it("uses the median of at most five accepted estimates", () => {
    const stabilizer = new PitchStabilizer();
    for (const frequency of [438, 441, 440, 900, 439, 442]) {
      stabilizer.accept(estimate(frequency));
    }

    const result = stabilizer.accept(estimate(440));
    expect(stabilizer.size).toBe(PITCH_STABILIZATION_WINDOW);
    expect(result.frequencyHz).toBe(440);
  });

  it("marks stable after three consecutive accepted estimates within 25 cents of the median", () => {
    const stabilizer = new PitchStabilizer();

    expect(stabilizer.accept(estimate(440)).stable).toBe(false);
    expect(stabilizer.accept(estimate(441)).stable).toBe(false);
    expect(stabilizer.accept(estimate(439.5)).stable).toBe(true);
  });

  it("keeps the last accepted window but breaks the stability streak after rejection", () => {
    const stabilizer = new PitchStabilizer();
    stabilizer.accept(estimate(440));
    stabilizer.accept(estimate(440.5));
    expect(stabilizer.accept(estimate(439.5)).stable).toBe(true);
    expect(stabilizer.size).toBe(3);

    stabilizer.reject();
    expect(stabilizer.size).toBe(3);
    expect(stabilizer.accept(estimate(660)).stable).toBe(false);
    expect(stabilizer.accept(estimate(660.5)).stable).toBe(false);
    expect(stabilizer.accept(estimate(659.5)).stable).toBe(true);
  });
});
