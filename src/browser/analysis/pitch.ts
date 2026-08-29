import { nextPowerOfTwo } from "./AudioAnalyzer";

export const PITCH_MIN_HZ = 50;
export const PITCH_MAX_HZ = 2_000;
export const YIN_THRESHOLD = 0.1;
export const PITCH_MIN_CONFIDENCE = 0.8;
export const PITCH_REFERENCE_A4_HZ = 440;
export const PITCH_MAX_ANALYSES_PER_SECOND = 20;
export const PITCH_ANALYSIS_INTERVAL_MS =
  1_000 / PITCH_MAX_ANALYSES_PER_SECOND;
export const PITCH_STABILIZATION_WINDOW = 5;
export const PITCH_STABLE_MIN_CONSECUTIVE = 3;
export const PITCH_STABLE_CENTS = 25;

export interface PitchAnalysisConfiguration {
  readonly contextRate: number;
  readonly downsampleFactor: number;
  readonly analysisRate: number;
  readonly frameSize: number;
  readonly sourceFrameSize: number;
  readonly tauMin: number;
  readonly tauMax: number;
}

export interface YinPitchEstimate {
  readonly frequencyHz: number;
  readonly confidence: number;
  readonly selectedTau: number;
  readonly refinedTau: number;
  readonly cmndfValue: number;
}

export interface NoteMapping {
  readonly nearestMidi: number;
  readonly noteName: string;
  readonly octave: number;
  readonly noteFrequencyHz: number;
  readonly cents: number;
}

export interface StabilizedPitch {
  readonly frequencyHz: number;
  readonly confidence: number;
  readonly stable: boolean;
  readonly acceptedCount: number;
}

interface AcceptedPitch {
  readonly frequencyHz: number;
  readonly confidence: number;
}

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

export function getPitchAnalysisConfiguration(
  contextRate: number,
): PitchAnalysisConfiguration {
  assertPositiveFinite(contextRate, "contextRate");

  const downsampleFactor = Math.ceil(contextRate / 48_000);
  const analysisRate = contextRate / downsampleFactor;
  const frameSize = nextPowerOfTwo((2 * analysisRate) / PITCH_MIN_HZ);
  const sourceFrameSize = frameSize * downsampleFactor;
  const tauMin = Math.max(1, Math.floor(analysisRate / PITCH_MAX_HZ));
  const tauMax = Math.ceil(analysisRate / PITCH_MIN_HZ);

  if (tauMax > Math.floor(frameSize / 2)) {
    throw new RangeError(
      "Pitch frame is too small for the documented minimum frequency",
    );
  }

  return {
    contextRate,
    downsampleFactor,
    analysisRate,
    frameSize,
    sourceFrameSize,
    tauMin,
    tauMax,
  };
}

export function downsampleAveraged(
  source: Float32Array,
  factor: number,
  target?: Float32Array,
): Float32Array {
  if (!Number.isInteger(factor) || factor <= 0) {
    throw new RangeError("downsample factor must be a positive integer");
  }

  const outputLength = Math.floor(source.length / factor);
  const output = target ?? new Float32Array(outputLength);
  if (output.length !== outputLength) {
    throw new RangeError(
      `downsample target length must equal ${outputLength}`,
    );
  }

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const sourceStart = outputIndex * factor;
    let sum = 0;
    for (let offset = 0; offset < factor; offset += 1) {
      sum += source[sourceStart + offset] ?? 0;
    }
    output[outputIndex] = sum / factor;
  }

  return output;
}

function calculateYinDifference(
  samples: Float32Array,
  tauMax: number,
): Float64Array {
  const windowSize = Math.floor(samples.length / 2);
  if (tauMax > windowSize) {
    throw new RangeError("tauMax cannot exceed half of the YIN frame size");
  }

  const difference = new Float64Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau += 1) {
    let sum = 0;
    for (let index = 0; index < windowSize; index += 1) {
      const delta = (samples[index] ?? 0) - (samples[index + tau] ?? 0);
      sum += delta * delta;
    }
    difference[tau] = sum;
  }
  return difference;
}

function calculateCmndf(difference: Float64Array): Float64Array {
  const cmndf = new Float64Array(difference.length);
  cmndf[0] = 1;
  let runningSum = 0;

  for (let tau = 1; tau < difference.length; tau += 1) {
    runningSum += difference[tau] ?? 0;
    cmndf[tau] =
      runningSum > 0 ? ((difference[tau] ?? 0) * tau) / runningSum : 1;
  }

  return cmndf;
}

function selectYinTau(
  cmndf: Float64Array,
  tauMin: number,
  tauMax: number,
  threshold: number,
): number {
  for (let tau = tauMin; tau <= tauMax; tau += 1) {
    if ((cmndf[tau] ?? 1) >= threshold) continue;

    let valleyTau = tau;
    while (
      valleyTau < tauMax &&
      (cmndf[valleyTau + 1] ?? 1) < (cmndf[valleyTau] ?? 1)
    ) {
      valleyTau += 1;
    }
    return valleyTau;
  }

  let bestTau = tauMin;
  let bestValue = cmndf[tauMin] ?? 1;
  for (let tau = tauMin + 1; tau <= tauMax; tau += 1) {
    const value = cmndf[tau] ?? 1;
    if (value < bestValue) {
      bestValue = value;
      bestTau = tau;
    }
  }
  return bestTau;
}

function refineTauParabolically(
  cmndf: Float64Array,
  selectedTau: number,
  minimumRefinedTau: number,
  maximumRefinedTau: number,
): number {
  const clampRefinedTau = (tau: number) =>
    Math.min(maximumRefinedTau, Math.max(minimumRefinedTau, tau));

  if (selectedTau <= 0 || selectedTau >= cmndf.length - 1) {
    return clampRefinedTau(selectedTau);
  }

  const left = cmndf[selectedTau - 1];
  const center = cmndf[selectedTau];
  const right = cmndf[selectedTau + 1];
  if (left === undefined || center === undefined || right === undefined) {
    return clampRefinedTau(selectedTau);
  }

  const denominator = 2 * (2 * center - right - left);
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) {
    return clampRefinedTau(selectedTau);
  }

  const offset = (right - left) / denominator;
  if (!Number.isFinite(offset)) return clampRefinedTau(selectedTau);
  return clampRefinedTau(selectedTau + offset);
}

export function estimatePitchYin(
  samples: Float32Array,
  analysisRate: number,
  options: {
    readonly minHz?: number;
    readonly maxHz?: number;
    readonly threshold?: number;
    readonly minimumConfidence?: number;
  } = {},
): YinPitchEstimate | null {
  assertPositiveFinite(analysisRate, "analysisRate");

  const minHz = options.minHz ?? PITCH_MIN_HZ;
  const maxHz = options.maxHz ?? PITCH_MAX_HZ;
  const threshold = options.threshold ?? YIN_THRESHOLD;
  const minimumConfidence =
    options.minimumConfidence ?? PITCH_MIN_CONFIDENCE;

  assertPositiveFinite(minHz, "minHz");
  assertPositiveFinite(maxHz, "maxHz");
  if (maxHz <= minHz) throw new RangeError("maxHz must be greater than minHz");
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new RangeError("YIN threshold must be in the range [0, 1]");
  }
  if (
    !Number.isFinite(minimumConfidence) ||
    minimumConfidence < 0 ||
    minimumConfidence > 1
  ) {
    throw new RangeError("minimumConfidence must be in the range [0, 1]");
  }

  const tauMin = Math.max(1, Math.floor(analysisRate / maxHz));
  const tauMax = Math.ceil(analysisRate / minHz);
  if (tauMax > Math.floor(samples.length / 2)) {
    throw new RangeError(
      "YIN frame must contain at least two periods of the minimum frequency",
    );
  }

  // Standard CMNDF normalization needs cumulative difference values at lower
  // lags. Those lower lags are normalization-only candidates: pitch candidate
  // selection remains strictly bounded to tauMin..tauMax.
  const difference = calculateYinDifference(samples, tauMax);
  const cmndf = calculateCmndf(difference);
  const selectedTau = selectYinTau(cmndf, tauMin, tauMax, threshold);
  const cmndfValue = cmndf[selectedTau] ?? 1;
  const confidence = Math.min(1, Math.max(0, 1 - cmndfValue));
  if (confidence < minimumConfidence) return null;

  const minimumRefinedTau = analysisRate / maxHz;
  const maximumRefinedTau = analysisRate / minHz;
  const refinedTau = refineTauParabolically(
    cmndf,
    selectedTau,
    minimumRefinedTau,
    maximumRefinedTau,
  );
  const frequencyHz = analysisRate / refinedTau;
  if (
    !Number.isFinite(frequencyHz) ||
    frequencyHz < minHz ||
    frequencyHz > maxHz
  ) {
    return null;
  }

  return {
    frequencyHz,
    confidence,
    selectedTau,
    refinedTau,
    cmndfValue,
  };
}

export function mapFrequencyToNote(
  frequencyHz: number,
  referenceA4Hz: number = PITCH_REFERENCE_A4_HZ,
): NoteMapping {
  assertPositiveFinite(frequencyHz, "frequencyHz");
  assertPositiveFinite(referenceA4Hz, "referenceA4Hz");

  const midiFloat = 69 + 12 * Math.log2(frequencyHz / referenceA4Hz);
  const nearestMidi = Math.round(midiFloat);
  const noteFrequencyHz =
    referenceA4Hz * 2 ** ((nearestMidi - 69) / 12);
  const cents = 1_200 * Math.log2(frequencyHz / noteFrequencyHz);
  const noteIndex = ((nearestMidi % 12) + 12) % 12;
  const noteName = NOTE_NAMES[noteIndex] ?? "—";
  const octave = Math.floor(nearestMidi / 12) - 1;

  return {
    nearestMidi,
    noteName,
    octave,
    noteFrequencyHz,
    cents,
  };
}

function medianFrequency(values: readonly AcceptedPitch[]): number {
  const sorted = values
    .map((value) => value.frequencyHz)
    .sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function absoluteCentsBetween(leftHz: number, rightHz: number): number {
  return Math.abs(1_200 * Math.log2(leftHz / rightHz));
}

export class PitchStabilizer {
  readonly #accepted: AcceptedPitch[] = [];
  #consecutiveAccepted = 0;

  get size(): number {
    return this.#accepted.length;
  }

  reset(): void {
    this.#accepted.length = 0;
    this.#consecutiveAccepted = 0;
  }

  reject(): void {
    this.#consecutiveAccepted = 0;
  }

  accept(estimate: YinPitchEstimate): StabilizedPitch {
    assertPositiveFinite(estimate.frequencyHz, "estimate.frequencyHz");
    if (
      !Number.isFinite(estimate.confidence) ||
      estimate.confidence < 0 ||
      estimate.confidence > 1
    ) {
      throw new RangeError("estimate.confidence must be in the range [0, 1]");
    }

    this.#accepted.push({
      frequencyHz: estimate.frequencyHz,
      confidence: estimate.confidence,
    });
    if (this.#accepted.length > PITCH_STABILIZATION_WINDOW) {
      this.#accepted.splice(
        0,
        this.#accepted.length - PITCH_STABILIZATION_WINDOW,
      );
    }
    this.#consecutiveAccepted = Math.min(
      this.#consecutiveAccepted + 1,
      this.#accepted.length,
    );

    const frequencyHz = medianFrequency(this.#accepted);
    let consecutiveWithinMedian = 0;
    const candidatesToCheck = Math.min(
      this.#consecutiveAccepted,
      this.#accepted.length,
    );
    for (let offset = 0; offset < candidatesToCheck; offset += 1) {
      const value = this.#accepted[this.#accepted.length - 1 - offset];
      if (
        !value ||
        absoluteCentsBetween(value.frequencyHz, frequencyHz) > PITCH_STABLE_CENTS
      ) {
        break;
      }
      consecutiveWithinMedian += 1;
    }

    return {
      frequencyHz,
      confidence: estimate.confidence,
      stable: consecutiveWithinMedian >= PITCH_STABLE_MIN_CONSECUTIVE,
      acceptedCount: this.#accepted.length,
    };
  }
}
