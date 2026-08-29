import type { SessionResource } from "../audio-session/AudioSession";
import { clamp } from "../../utils/audio";

export const METER_WINDOW_SECONDS = 0.1;
export const METER_UPDATE_HZ = 10;
export const METER_UPDATE_INTERVAL_MS = 1_000 / METER_UPDATE_HZ;
export const METER_MIN_FFT_SIZE = 2_048;
export const METER_MAX_FFT_SIZE = 32_768;
export const METER_DBFS_FLOOR = -100;
export const METER_EPSILON = 1e-5;
export const METER_PEAK_HOLD_MS = 1_000;
export const METER_PEAK_DECAY_DB_PER_SECOND = 20;

export const SPECTRUM_FFT_SIZES = [1_024, 2_048, 4_096, 8_192] as const;
export type SpectrumFftSize = (typeof SPECTRUM_FFT_SIZES)[number];
export const SPECTRUM_DEFAULT_FFT_SIZE: SpectrumFftSize = 2_048;
export const SPECTRUM_DEFAULT_SMOOTHING = 0.8;
export const SPECTRUM_DISPLAY_MIN_DB = -100;
export const SPECTRUM_DISPLAY_MAX_DB = -20;

export interface MeterConfiguration {
  readonly analysisSampleRate: number;
  readonly windowSamples: number;
  readonly fftSize: number;
}

export interface InstantMeterReading {
  readonly rms: number;
  readonly peak: number;
  readonly rmsDbfs: number;
  readonly peakDbfs: number;
}

export interface MeterReading extends InstantMeterReading {
  readonly heldPeakDbfs: number;
}

export interface SpectrumConfiguration {
  readonly fftSize?: SpectrumFftSize;
  readonly smoothingTimeConstant?: number;
}

export function nextPowerOfTwo(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError("value must be a positive finite number");
  }
  return 2 ** Math.ceil(Math.log2(value));
}

export function getMeterConfiguration(sampleRate: number): MeterConfiguration {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError("sampleRate must be a positive finite number");
  }

  const windowSamples = Math.ceil(sampleRate * METER_WINDOW_SECONDS);
  const fftSize = clamp(
    nextPowerOfTwo(windowSamples),
    METER_MIN_FFT_SIZE,
    METER_MAX_FFT_SIZE,
  );

  if (windowSamples > fftSize) {
    throw new RangeError(
      "AudioContext sampleRate is too high for the documented 100 ms meter window",
    );
  }

  return {
    analysisSampleRate: sampleRate,
    windowSamples,
    fftSize,
  };
}

function amplitudeToDbfs(amplitude: number): number {
  return Math.max(
    METER_DBFS_FLOOR,
    20 * Math.log10(Math.max(amplitude, METER_EPSILON)),
  );
}

export function calculateMeterReading(
  samples: Float32Array,
  windowSamples: number = samples.length,
): InstantMeterReading {
  if (!Number.isInteger(windowSamples) || windowSamples <= 0) {
    throw new RangeError("windowSamples must be a positive integer");
  }
  if (windowSamples > samples.length) {
    throw new RangeError("windowSamples cannot exceed the available PCM buffer");
  }

  const startIndex = samples.length - windowSamples;
  let squareSum = 0;
  let peak = 0;

  for (let index = startIndex; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0;
    squareSum += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }

  const rms = Math.sqrt(squareSum / windowSamples);
  return {
    rms,
    peak,
    rmsDbfs: amplitudeToDbfs(rms),
    peakDbfs: amplitudeToDbfs(peak),
  };
}

export function clampSpectrumDbForDisplay(valueDb: number): number {
  if (!Number.isFinite(valueDb)) return SPECTRUM_DISPLAY_MIN_DB;
  return clamp(valueDb, SPECTRUM_DISPLAY_MIN_DB, SPECTRUM_DISPLAY_MAX_DB);
}

export function isSpectrumFftSize(value: number): value is SpectrumFftSize {
  return SPECTRUM_FFT_SIZES.includes(value as SpectrumFftSize);
}

export class AudioAnalyzer implements SessionResource {
  readonly #context: AudioContext;
  readonly #input: GainNode;
  readonly #meterAnalyser: AnalyserNode;
  readonly #spectrumAnalyser: AnalyserNode;
  readonly #meterConfiguration: MeterConfiguration;
  readonly #meterSamples: Float32Array;

  #heldPeakDbfs = METER_DBFS_FLOOR;
  #peakHoldUntilMs = 0;
  #lastPeakUpdateMs: number | null = null;
  #disposed = false;

  constructor(context: AudioContext) {
    this.#context = context;
    this.#meterConfiguration = getMeterConfiguration(context.sampleRate);
    this.#input = context.createGain();
    this.#meterAnalyser = context.createAnalyser();
    this.#spectrumAnalyser = context.createAnalyser();

    this.#input.gain.setValueAtTime(1, context.currentTime);
    this.#meterAnalyser.fftSize = this.#meterConfiguration.fftSize;
    this.#meterAnalyser.smoothingTimeConstant = 0;
    this.#spectrumAnalyser.fftSize = SPECTRUM_DEFAULT_FFT_SIZE;
    this.#spectrumAnalyser.smoothingTimeConstant = SPECTRUM_DEFAULT_SMOOTHING;

    this.#input.connect(this.#meterAnalyser);
    this.#input.connect(this.#spectrumAnalyser);
    this.#meterSamples = new Float32Array(this.#meterAnalyser.fftSize);
  }

  get inputNode(): AudioNode {
    this.#assertUsable();
    return this.#input;
  }

  get analysisSampleRate(): number {
    return this.#context.sampleRate;
  }

  get meterConfiguration(): Readonly<MeterConfiguration> {
    return { ...this.#meterConfiguration };
  }

  get spectrumFftSize(): SpectrumFftSize {
    return this.#spectrumAnalyser.fftSize as SpectrumFftSize;
  }

  get smoothingTimeConstant(): number {
    return this.#spectrumAnalyser.smoothingTimeConstant;
  }

  get frequencyBinCount(): number {
    return this.#spectrumAnalyser.frequencyBinCount;
  }

  get frequencyBinWidthHz(): number {
    return this.analysisSampleRate / this.#spectrumAnalyser.fftSize;
  }

  configureSpectrum(configuration: SpectrumConfiguration): void {
    this.#assertUsable();

    if (configuration.fftSize !== undefined) {
      if (!isSpectrumFftSize(configuration.fftSize)) {
        throw new RangeError("Unsupported Spectrum Analyzer fftSize");
      }
      this.#spectrumAnalyser.fftSize = configuration.fftSize;
    }

    if (configuration.smoothingTimeConstant !== undefined) {
      const smoothing = configuration.smoothingTimeConstant;
      if (!Number.isFinite(smoothing) || smoothing < 0 || smoothing > 1) {
        throw new RangeError("smoothingTimeConstant must be in the range [0, 1]");
      }
      this.#spectrumAnalyser.smoothingTimeConstant = smoothing;
    }
  }

  readMeter(nowMs: number = performance.now()): MeterReading {
    this.#assertUsable();
    if (!Number.isFinite(nowMs)) {
      throw new RangeError("nowMs must be a finite number");
    }

    this.#meterAnalyser.getFloatTimeDomainData(this.#meterSamples);
    const reading = calculateMeterReading(
      this.#meterSamples,
      this.#meterConfiguration.windowSamples,
    );
    const heldPeakDbfs = this.#updatePeakHold(reading.peakDbfs, nowMs);
    return { ...reading, heldPeakDbfs };
  }

  readWaveform(target?: Float32Array): Float32Array {
    this.#assertUsable();
    const output = target ?? new Float32Array(this.#spectrumAnalyser.fftSize);
    if (output.length !== this.#spectrumAnalyser.fftSize) {
      throw new RangeError(
        `Waveform buffer length must equal current fftSize ${this.#spectrumAnalyser.fftSize}`,
      );
    }
    this.#spectrumAnalyser.getFloatTimeDomainData(output);
    return output;
  }

  readFrequencyData(target?: Float32Array): Float32Array {
    this.#assertUsable();
    const output =
      target ?? new Float32Array(this.#spectrumAnalyser.frequencyBinCount);
    if (output.length !== this.#spectrumAnalyser.frequencyBinCount) {
      throw new RangeError(
        `Frequency buffer length must equal frequencyBinCount ${this.#spectrumAnalyser.frequencyBinCount}`,
      );
    }
    this.#spectrumAnalyser.getFloatFrequencyData(output);
    return output;
  }

  frequencyForBin(index: number): number {
    this.#assertUsable();
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.#spectrumAnalyser.frequencyBinCount
    ) {
      throw new RangeError("Frequency-bin index is outside the current FFT range");
    }
    return index * this.frequencyBinWidthHz;
  }

  resetMeter(): void {
    this.#heldPeakDbfs = METER_DBFS_FLOOR;
    this.#peakHoldUntilMs = 0;
    this.#lastPeakUpdateMs = null;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#input.disconnect();
    this.#meterAnalyser.disconnect();
    this.#spectrumAnalyser.disconnect();
  }

  #updatePeakHold(peakDbfs: number, nowMs: number): number {
    const previousUpdateMs = this.#lastPeakUpdateMs;

    if (previousUpdateMs === null || peakDbfs >= this.#heldPeakDbfs) {
      this.#heldPeakDbfs = peakDbfs;
      this.#peakHoldUntilMs = nowMs + METER_PEAK_HOLD_MS;
      this.#lastPeakUpdateMs = nowMs;
      return this.#heldPeakDbfs;
    }

    if (nowMs <= this.#peakHoldUntilMs) {
      this.#lastPeakUpdateMs = nowMs;
      return this.#heldPeakDbfs;
    }

    const decayStartMs = Math.max(previousUpdateMs, this.#peakHoldUntilMs);
    const elapsedSeconds = Math.max(0, nowMs - decayStartMs) / 1_000;
    const decayedPeak = Math.max(
      METER_DBFS_FLOOR,
      this.#heldPeakDbfs - METER_PEAK_DECAY_DB_PER_SECOND * elapsedSeconds,
    );

    if (peakDbfs >= decayedPeak) {
      this.#heldPeakDbfs = peakDbfs;
      this.#peakHoldUntilMs = nowMs + METER_PEAK_HOLD_MS;
    } else {
      this.#heldPeakDbfs = decayedPeak;
    }

    this.#lastPeakUpdateMs = nowMs;
    return this.#heldPeakDbfs;
  }

  #assertUsable(): void {
    if (this.#disposed) {
      throw new Error("Cannot use a disposed AudioAnalyzer");
    }
  }
}
