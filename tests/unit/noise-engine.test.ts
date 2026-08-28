import { describe, expect, it, vi } from "vitest";

import {
  BROWN_NOISE_SEED,
  NoiseEngine,
  PHASE_PINK_SEED,
  PHASE_TEST_DURATION_SECONDS,
  PINK_NOISE_SEED,
  REFERENCE_NOISE_PEAK,
  REFERENCE_NOISE_SAMPLE_RATE,
  WHITE_NOISE_SEED,
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

function createFakeAudioBufferContext(length: number) {
  const channel = new Float32Array(length);
  const getChannelData = vi.fn(() => channel);
  const buffer = {
    sampleRate: REFERENCE_NOISE_SAMPLE_RATE,
    length,
    getChannelData,
  } as unknown as AudioBuffer;
  const createBuffer = vi.fn(() => buffer);
  const context = { createBuffer } as unknown as AudioContext;

  return { channel, getChannelData, buffer, createBuffer, context };
}

describe("NoiseEngine primitives", () => {
  it("matches the canonical xorshift32 reference mapping", () => {
    const random = createXorshift32(WHITE_NOISE_SEED);
    const expected = [
      -0.68009846184405, -0.4541176360692172, 0.9196747205964464,
      -0.708945881973241,
    ];

    for (const value of expected) {
      expect(random()).toBeCloseTo(value, 12);
    }
  });

  it.each([
    ["white", WHITE_NOISE_SEED],
    ["pink", PINK_NOISE_SEED],
    ["brown", BROWN_NOISE_SEED],
  ] as const)("uses the locked %s seed and 0.8 peak", (kind, seed) => {
    const implicit = generateNoiseSamples(kind, 4096);
    const explicit = generateNoiseSamples(kind, 4096, seed);

    expect(implicit).toEqual(explicit);
    expect(peak(implicit)).toBeCloseTo(REFERENCE_NOISE_PEAK, 6);
  });

  it("removes the brown-noise DC mean before normalization", () => {
    const samples = generateNoiseSamples("brown", 44_100, BROWN_NOISE_SEED);
    const mean =
      samples.reduce((sum, sample) => sum + sample, 0) / samples.length;

    expect(Math.abs(mean)).toBeLessThan(1e-5);
  });

  it("conditions the final loop sample to equal the first", () => {
    const samples = generateNoiseSamples("white", 4096, WHITE_NOISE_SEED);
    conditionLoopBoundary(samples, REFERENCE_NOISE_SAMPLE_RATE);

    expect(samples.at(-1)).toBe(samples[0]);
  });

  it("creates the phase-test buffer with the locked phase seed at canonical 44.1 kHz", () => {
    const length = REFERENCE_NOISE_SAMPLE_RATE * PHASE_TEST_DURATION_SECONDS;
    const first = createFakeAudioBufferContext(length);
    const second = createFakeAudioBufferContext(length);
    const firstEngine = new NoiseEngine(first.context);
    const secondEngine = new NoiseEngine(second.context);

    const result = firstEngine.createPhaseTestPinkBuffer();
    secondEngine.createPhaseTestPinkBuffer(PHASE_PINK_SEED);

    expect(result).toBe(first.buffer);
    expect(first.createBuffer).toHaveBeenCalledWith(
      1,
      length,
      REFERENCE_NOISE_SAMPLE_RATE,
    );
    expect(first.getChannelData).toHaveBeenCalledWith(0);
    expect(first.channel).toEqual(second.channel);
    expect(first.channel.some((sample) => sample !== 0)).toBe(true);
    expect(peak(first.channel)).toBeLessThanOrEqual(
      REFERENCE_NOISE_PEAK + 1e-6,
    );
    expect(first.channel.at(-1)).toBe(first.channel[0]);
  });
});
