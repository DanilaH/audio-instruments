export const REFERENCE_NOISE_SAMPLE_RATE = 44_100;
export const NOISE_GENERATOR_DURATION_SECONDS = 8;
export const PHASE_TEST_DURATION_SECONDS = 4;
export const DEFAULT_NOISE_SEED = 0x6d2b79f5;

export type NoiseKind = "white" | "pink" | "brown";

export interface NoiseBufferOptions {
  readonly durationSeconds?: number;
  readonly seed?: number;
  readonly conditionLoopBoundary?: boolean;
}

function normalizeSeed(seed: number): number {
  const normalized = seed >>> 0;
  return normalized === 0 ? DEFAULT_NOISE_SEED : normalized;
}

export function createXorshift32(seed = DEFAULT_NOISE_SEED): () => number {
  let state = normalizeSeed(seed);

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;

    return (state / 0x1_0000_0000) * 2 - 1;
  };
}

export function removeDcMean(samples: Float32Array): void {
  if (samples.length === 0) return;

  let sum = 0;
  for (const sample of samples) sum += sample;
  const mean = sum / samples.length;

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (samples[index] ?? 0) - mean;
  }
}

export function normalizePeak(samples: Float32Array): void {
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }

  if (peak <= Number.EPSILON) return;

  const scale = 1 / peak;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (samples[index] ?? 0) * scale;
  }
}

export function conditionLoopBoundary(
  samples: Float32Array,
  sampleRate = REFERENCE_NOISE_SAMPLE_RATE,
): void {
  if (samples.length < 2) return;

  const boundarySamples = Math.min(
    samples.length - 1,
    Math.max(16, Math.round(sampleRate * 0.01)),
  );
  const firstSample = samples[0] ?? 0;
  const startIndex = samples.length - boundarySamples;

  for (let index = 0; index < boundarySamples; index += 1) {
    const sampleIndex = startIndex + index;
    const progress = (index + 1) / boundarySamples;
    const current = samples[sampleIndex] ?? 0;
    samples[sampleIndex] = current + (firstSample - current) * progress;
  }
}

export function generateNoiseSamples(
  kind: NoiseKind,
  sampleCount: number,
  seed = DEFAULT_NOISE_SEED,
): Float32Array {
  if (!Number.isInteger(sampleCount) || sampleCount <= 0) {
    throw new RangeError("sampleCount must be a positive integer");
  }

  const random = createXorshift32(seed);
  const samples = new Float32Array(sampleCount);

  if (kind === "white") {
    for (let index = 0; index < sampleCount; index += 1) {
      samples[index] = random();
    }
    normalizePeak(samples);
    return samples;
  }

  if (kind === "pink") {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    for (let index = 0; index < sampleCount; index += 1) {
      const white = random();
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      samples[index] =
        b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
    }

    normalizePeak(samples);
    return samples;
  }

  let state = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const white = random();
    state = 0.98 * state + 0.02 * white;
    samples[index] = state;
  }

  removeDcMean(samples);
  normalizePeak(samples);
  return samples;
}

function writeMonoBuffer(
  context: AudioContext,
  samples: Float32Array,
): AudioBuffer {
  const buffer = context.createBuffer(
    1,
    samples.length,
    REFERENCE_NOISE_SAMPLE_RATE,
  );
  buffer.getChannelData(0).set(samples);
  return buffer;
}

export class NoiseEngine {
  readonly #context: AudioContext;

  constructor(context: AudioContext) {
    this.#context = context;
  }

  createNoiseBuffer(
    kind: NoiseKind,
    options: NoiseBufferOptions = {},
  ): AudioBuffer {
    const durationSeconds =
      options.durationSeconds ?? NOISE_GENERATOR_DURATION_SECONDS;

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new RangeError("durationSeconds must be a positive finite number");
    }

    const sampleCount = Math.round(
      REFERENCE_NOISE_SAMPLE_RATE * durationSeconds,
    );
    const samples = generateNoiseSamples(kind, sampleCount, options.seed);

    if (options.conditionLoopBoundary ?? true) {
      conditionLoopBoundary(samples);
    }

    return writeMonoBuffer(this.#context, samples);
  }

  createPhaseTestPinkBuffer(seed = DEFAULT_NOISE_SEED): AudioBuffer {
    return this.createNoiseBuffer("pink", {
      durationSeconds: PHASE_TEST_DURATION_SECONDS,
      seed,
      conditionLoopBoundary: true,
    });
  }
}
