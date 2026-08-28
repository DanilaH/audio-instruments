import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_NOISE_SEED,
  NoiseEngine,
  PHASE_TEST_DURATION_SECONDS,
  REFERENCE_NOISE_SAMPLE_RATE,
  conditionLoopBoundary,
  createXorshift32,
  generateNoiseSamples,
} from "../../src/browser/noise/NoiseEngine";

function peak(samples: Float32Array): number {
  return samples.reduce(
    (current, sample) => Math.max(current, Math.abs(sample)),
    0,
  );
}

describe("NoiseEngine primitives", () => {
  it("produces deterministic xorshift32 output for the same seed", () => {
    const first = createXorshift32(DEFAULT_NOISE_SEED);
    const second = createXorshift32(DEFAULT_NOISE_SEED);

    expect(Array.from({ length: 8 }, () => first())).toEqual(
      Array.from({ length: 8 }, () => second()),
    );
  });

  it.each(["white", "pink", "brown"] as const)(
    "generates deterministic normalized %s noise",
    (kind) => {
      const first = generateNoiseSamples(kind, 4096, 1234);
      const second = generateNoiseSamples(kind, 4096, 1234);

      expect(first).toEqual(second);
      expect(peak(first)).toBeCloseTo(1, 6);
    },
  );

  it("removes the brown-noise DC mean before normalization", () => {
    const samples = generateNoiseSamples("brown", 44_100, 4567);
    const mean =
      samples.reduce((sum, sample) => sum + sample, 0) / samples.length;

    expect(Math.abs(mean)).toBeLessThan(1e-5);
  });

  it("conditions the final loop sample to equal the first", () => {
    const samples = generateNoiseSamples("white", 4096, 222);
    conditionLoopBoundary(samples, REFERENCE_NOISE_SAMPLE_RATE);

    expect(samples.at(-1)).toBe(samples[0]);
  });

  it("creates the phase-test buffer at canonical 44.1 kHz for four seconds", () => {
    const channel = new Float32Array(
      REFERENCE_NOISE_SAMPLE_RATE * PHASE_TEST_DURATION_SECONDS,
    );
    const getChannelData = vi.fn(() => channel);
    const buffer = {
      sampleRate: REFERENCE_NOISE_SAMPLE_RATE,
      length: channel.length,
      getChannelData,
    } as unknown as AudioBuffer;
    const createBuffer = vi.fn(() => buffer);
    const context = { createBuffer } as unknown as AudioContext;
    const engine = new NoiseEngine(context);

    const result = engine.createPhaseTestPinkBuffer(999);

    expect(result).toBe(buffer);
    expect(createBuffer).toHaveBeenCalledWith(
      1,
      REFERENCE_NOISE_SAMPLE_RATE * PHASE_TEST_DURATION_SECONDS,
      REFERENCE_NOISE_SAMPLE_RATE,
    );
    expect(getChannelData).toHaveBeenCalledWith(0);
    expect(channel.some((sample) => sample !== 0)).toBe(true);
  });
});
