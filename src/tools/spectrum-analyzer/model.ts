import {
  SPECTRUM_DISPLAY_MAX_DB,
  SPECTRUM_DISPLAY_MIN_DB,
  clampSpectrumDbForDisplay,
} from "../../browser/analysis/AudioAnalyzer";

export const SPECTRUM_DISPLAY_MIN_HZ = 20;
export const SPECTRUM_DISPLAY_MAX_HZ = 20_000;
export const DOMINANT_FFT_MIN_HZ = 40;
export const SPECTRUM_MAX_RENDER_FPS = 60;
export const SPECTROGRAM_MAX_COLUMNS_PER_SECOND = 30;
export const SPECTROGRAM_HISTORY_MS = 10_000;
export const SPECTROGRAM_COLUMN_CAPACITY = 300;
export const SPECTROGRAM_MIN_COLUMN_INTERVAL_MS =
  1_000 / SPECTROGRAM_MAX_COLUMNS_PER_SECOND;
export const SPECTROGRAM_CONTRAST_GAMMA = 0.65;

export interface DominantFftBin {
  readonly binIndex: number;
  readonly frequencyHz: number;
  readonly valueDb: number;
}

export interface SpectrogramColumn {
  readonly timestampMs: number;
  readonly valuesDb: Float32Array;
}

export function getSpectrumDisplayMaxHz(sampleRate: number): number {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError("sampleRate must be a positive finite number");
  }
  return Math.min(SPECTRUM_DISPLAY_MAX_HZ, sampleRate / 2);
}

export function getFrequencyBinWidthHz(
  sampleRate: number,
  fftSize: number,
): number {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError("sampleRate must be a positive finite number");
  }
  if (!Number.isInteger(fftSize) || fftSize <= 0) {
    throw new RangeError("fftSize must be a positive integer");
  }
  return sampleRate / fftSize;
}

export function frequencyForFftBin(
  binIndex: number,
  sampleRate: number,
  fftSize: number,
): number {
  if (!Number.isInteger(binIndex) || binIndex < 0 || binIndex >= fftSize / 2) {
    throw new RangeError("binIndex is outside the FFT frequency-bin range");
  }
  return binIndex * getFrequencyBinWidthHz(sampleRate, fftSize);
}

export function frequencyToLogRatio(
  frequencyHz: number,
  minHz: number,
  maxHz: number,
): number {
  if (
    !Number.isFinite(frequencyHz) ||
    !Number.isFinite(minHz) ||
    !Number.isFinite(maxHz) ||
    minHz <= 0 ||
    maxHz <= minHz
  ) {
    throw new RangeError("Log-frequency mapping requires 0 < minHz < maxHz");
  }

  const boundedFrequency = Math.min(maxHz, Math.max(minHz, frequencyHz));
  return Math.log(boundedFrequency / minHz) / Math.log(maxHz / minHz);
}

export function frequencyFromLogRatio(
  ratio: number,
  minHz: number,
  maxHz: number,
): number {
  if (
    !Number.isFinite(ratio) ||
    !Number.isFinite(minHz) ||
    !Number.isFinite(maxHz) ||
    minHz <= 0 ||
    maxHz <= minHz
  ) {
    throw new RangeError("Log-frequency mapping requires a finite ratio and 0 < minHz < maxHz");
  }

  const boundedRatio = Math.min(1, Math.max(0, ratio));
  return minHz * Math.pow(maxHz / minHz, boundedRatio);
}

export function dbToDisplayRatio(valueDb: number): number {
  const bounded = clampSpectrumDbForDisplay(valueDb);
  return (
    (bounded - SPECTRUM_DISPLAY_MIN_DB) /
    (SPECTRUM_DISPLAY_MAX_DB - SPECTRUM_DISPLAY_MIN_DB)
  );
}

export function spectrogramDbToIntensity(valueDb: number): number {
  // This is a monotonic display-contrast transfer only. It does not turn raw
  // analyser dB values into calibrated SPL or a measured frequency response.
  return Math.pow(dbToDisplayRatio(valueDb), SPECTROGRAM_CONTRAST_GAMMA);
}

export function findDominantFftBin(
  valuesDb: Float32Array,
  sampleRate: number,
  fftSize: number,
): DominantFftBin | null {
  if (valuesDb.length !== fftSize / 2) {
    throw new RangeError("Frequency data length must equal fftSize / 2");
  }

  const maxHz = getSpectrumDisplayMaxHz(sampleRate);
  if (maxHz < DOMINANT_FFT_MIN_HZ) return null;

  const binWidthHz = getFrequencyBinWidthHz(sampleRate, fftSize);
  const firstBin = Math.max(1, Math.ceil(DOMINANT_FFT_MIN_HZ / binWidthHz));
  const lastBin = Math.min(valuesDb.length - 1, Math.floor(maxHz / binWidthHz));

  let strongestBin = -1;
  let strongestDb = Number.NEGATIVE_INFINITY;

  for (let binIndex = firstBin; binIndex <= lastBin; binIndex += 1) {
    const valueDb = valuesDb[binIndex];
    if (valueDb === undefined || !Number.isFinite(valueDb)) continue;
    if (strongestBin < 0 || valueDb > strongestDb) {
      strongestBin = binIndex;
      strongestDb = valueDb;
    }
  }

  if (strongestBin < 0) return null;
  return {
    binIndex: strongestBin,
    frequencyHz: strongestBin * binWidthHz,
    valueDb: strongestDb,
  };
}

export function spectrogramTimestampToRatio(
  timestampMs: number,
  nowMs: number,
): number {
  if (!Number.isFinite(timestampMs) || !Number.isFinite(nowMs)) {
    throw new RangeError("Spectrogram timestamps must be finite");
  }
  const leftBoundary = nowMs - SPECTROGRAM_HISTORY_MS;
  return Math.min(
    1,
    Math.max(0, (timestampMs - leftBoundary) / SPECTROGRAM_HISTORY_MS),
  );
}

export class SpectrogramHistory {
  readonly #columns: SpectrogramColumn[] = [];
  #lastAcceptedTimestampMs: number | null = null;

  get size(): number {
    return this.#columns.length;
  }

  clear(): void {
    this.#columns.length = 0;
    this.#lastAcceptedTimestampMs = null;
  }

  ingest(timestampMs: number, valuesDb: Float32Array): boolean {
    this.#assertTimestamp(timestampMs);
    this.#evict(timestampMs);

    const previousTimestamp = this.#lastAcceptedTimestampMs;
    if (
      previousTimestamp !== null &&
      timestampMs - previousTimestamp < SPECTROGRAM_MIN_COLUMN_INTERVAL_MS
    ) {
      return false;
    }

    this.#columns.push({
      timestampMs,
      valuesDb: new Float32Array(valuesDb),
    });
    this.#lastAcceptedTimestampMs = timestampMs;
    this.#enforceCapacity();
    return true;
  }

  columnsForRender(nowMs: number): readonly SpectrogramColumn[] {
    this.#assertTimestamp(nowMs);
    this.#evict(nowMs);
    this.#enforceCapacity();
    return this.#columns;
  }

  #evict(nowMs: number): void {
    let removeCount = 0;
    while (
      removeCount < this.#columns.length &&
      nowMs - (this.#columns[removeCount]?.timestampMs ?? nowMs) >
        SPECTROGRAM_HISTORY_MS
    ) {
      removeCount += 1;
    }
    if (removeCount > 0) this.#columns.splice(0, removeCount);
  }

  #enforceCapacity(): void {
    const overflow = this.#columns.length - SPECTROGRAM_COLUMN_CAPACITY;
    if (overflow > 0) this.#columns.splice(0, overflow);
  }

  #assertTimestamp(timestampMs: number): void {
    if (!Number.isFinite(timestampMs)) {
      throw new RangeError("Spectrogram timestamp must be finite");
    }
    const lastAccepted = this.#lastAcceptedTimestampMs;
    if (lastAccepted !== null && timestampMs < lastAccepted) {
      throw new RangeError("Spectrogram timestamps must be monotonic");
    }
  }
}
