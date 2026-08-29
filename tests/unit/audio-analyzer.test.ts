import { describe, expect, it } from "vitest";

import {
  AudioAnalyzer,
  METER_DBFS_FLOOR,
  SPECTRUM_DEFAULT_FFT_SIZE,
  SPECTRUM_DEFAULT_SMOOTHING,
  calculateMeterReading,
  clampSpectrumDbForDisplay,
  getMeterConfiguration,
  nextPowerOfTwo,
} from "../../src/browser/analysis/AudioAnalyzer";

class FakeAudioParam {
  value = 1;

  setValueAtTime(value: number, time: number) {
    void time;
    this.value = value;
    return this as unknown as AudioParam;
  }
}

class FakeNode {
  readonly connections: AudioNode[] = [];
  disconnected = false;

  connect(destination: AudioNode) {
    this.connections.push(destination);
    return destination;
  }

  disconnect() {
    this.disconnected = true;
    this.connections.length = 0;
  }
}

class FakeGainNode extends FakeNode {
  readonly gain = new FakeAudioParam();
}

class FakeAnalyserNode extends FakeNode {
  #fftSize = 2_048;
  smoothingTimeConstant = 0;
  timeData: Float32Array | null = null;
  frequencyData: Float32Array | null = null;

  get fftSize(): number {
    return this.#fftSize;
  }

  set fftSize(value: number) {
    this.#fftSize = value;
  }

  get frequencyBinCount(): number {
    return this.#fftSize / 2;
  }

  getFloatTimeDomainData(target: Float32Array): void {
    target.fill(0);
    if (!this.timeData) return;
    const source = this.timeData.subarray(
      Math.max(0, this.timeData.length - target.length),
    );
    target.set(source, target.length - source.length);
  }

  getFloatFrequencyData(target: Float32Array): void {
    target.fill(-Infinity);
    if (!this.frequencyData) return;
    target.set(this.frequencyData.subarray(0, target.length));
  }
}

class FakeAudioContext {
  currentTime = 0;
  sampleRate: number;
  readonly destination = new FakeNode();
  readonly gains: FakeGainNode[] = [];
  readonly analysers: FakeAnalyserNode[] = [];

  constructor(sampleRate = 48_000) {
    this.sampleRate = sampleRate;
  }

  createGain() {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createAnalyser() {
    const analyser = new FakeAnalyserNode();
    this.analysers.push(analyser);
    return analyser as unknown as AnalyserNode;
  }
}

describe("AudioAnalyzer pure meter helpers", () => {
  it("derives the exact documented 100 ms meter window and bounded FFT size", () => {
    expect(nextPowerOfTwo(4_800)).toBe(8_192);
    expect(getMeterConfiguration(48_000)).toEqual({
      analysisSampleRate: 48_000,
      windowSamples: 4_800,
      fftSize: 8_192,
    });
    expect(getMeterConfiguration(44_100)).toEqual({
      analysisSampleRate: 44_100,
      windowSamples: 4_410,
      fftSize: 8_192,
    });
    expect(getMeterConfiguration(192_000)).toEqual({
      analysisSampleRate: 192_000,
      windowSamples: 19_200,
      fftSize: 32_768,
    });
  });

  it("uses only the most recent requested PCM window for RMS/peak dBFS", () => {
    const samples = Float32Array.from([1, -1, 0.5, -0.5]);
    const reading = calculateMeterReading(samples, 2);

    expect(reading.rms).toBeCloseTo(0.5, 10);
    expect(reading.peak).toBeCloseTo(0.5, 10);
    expect(reading.rmsDbfs).toBeCloseTo(-6.020599913, 8);
    expect(reading.peakDbfs).toBeCloseTo(-6.020599913, 8);
  });

  it("uses the exact -100 dBFS display floor", () => {
    expect(calculateMeterReading(new Float32Array(16))).toEqual({
      rms: 0,
      peak: 0,
      rmsDbfs: METER_DBFS_FLOOR,
      peakDbfs: METER_DBFS_FLOOR,
    });
  });

  it("clamps analyser frequency values only at the display boundary", () => {
    expect(clampSpectrumDbForDisplay(-140)).toBe(-100);
    expect(clampSpectrumDbForDisplay(-55)).toBe(-55);
    expect(clampSpectrumDbForDisplay(-5)).toBe(-20);
    expect(clampSpectrumDbForDisplay(Number.NaN)).toBe(-100);
  });
});

describe("AudioAnalyzer service", () => {
  it("keeps the dedicated meter analyser independent from Spectrum FFT settings", () => {
    const context = new FakeAudioContext(48_000);
    const analyzer = new AudioAnalyzer(context as unknown as AudioContext);
    const meter = context.analysers[0];
    const spectrum = context.analysers[1];
    const input = context.gains[0];

    expect(meter?.fftSize).toBe(8_192);
    expect(meter?.smoothingTimeConstant).toBe(0);
    expect(spectrum?.fftSize).toBe(SPECTRUM_DEFAULT_FFT_SIZE);
    expect(spectrum?.smoothingTimeConstant).toBe(SPECTRUM_DEFAULT_SMOOTHING);
    expect(input?.connections).toEqual([meter, spectrum]);
    expect(input?.connections).not.toContain(context.destination);

    analyzer.configureSpectrum({ fftSize: 1_024, smoothingTimeConstant: 0.25 });

    expect(meter?.fftSize).toBe(8_192);
    expect(spectrum?.fftSize).toBe(1_024);
    expect(spectrum?.smoothingTimeConstant).toBe(0.25);
    expect(analyzer.meterConfiguration.windowSamples).toBe(4_800);
  });

  it("reads the latest 100 ms meter window and applies 1 s peak hold then 20 dB/s decay", () => {
    const context = new FakeAudioContext(48_000);
    const analyzer = new AudioAnalyzer(context as unknown as AudioContext);
    const meter = context.analysers[0];
    expect(meter).toBeDefined();

    const loud = new Float32Array(8_192);
    loud.fill(0, 0, 8_192 - 4_800);
    loud.fill(0.5, 8_192 - 4_800);
    meter!.timeData = loud;

    const first = analyzer.readMeter(0);
    expect(first.peakDbfs).toBeCloseTo(-6.020599913, 8);
    expect(first.heldPeakDbfs).toBeCloseTo(-6.020599913, 8);

    const quiet = new Float32Array(8_192);
    quiet.fill(0.05, 8_192 - 4_800);
    meter!.timeData = quiet;

    const duringHold = analyzer.readMeter(500);
    expect(duringHold.peakDbfs).toBeCloseTo(-26.020599913, 8);
    expect(duringHold.heldPeakDbfs).toBeCloseTo(-6.020599913, 8);

    const afterHalfSecondDecay = analyzer.readMeter(1_500);
    expect(afterHalfSecondDecay.heldPeakDbfs).toBeCloseTo(-16.020599913, 8);
  });

  it("exposes waveform and float-frequency data with current FFT bin semantics", () => {
    const context = new FakeAudioContext(48_000);
    const analyzer = new AudioAnalyzer(context as unknown as AudioContext);
    const spectrum = context.analysers[1];
    expect(spectrum).toBeDefined();

    analyzer.configureSpectrum({ fftSize: 1_024 });
    spectrum!.timeData = Float32Array.from({ length: 1_024 }, (_, index) =>
      index === 1_023 ? 0.75 : 0,
    );
    spectrum!.frequencyData = Float32Array.from(
      { length: 512 },
      (_, index) => -100 + index / 10,
    );

    const waveform = analyzer.readWaveform();
    const frequencies = analyzer.readFrequencyData();

    expect(waveform).toHaveLength(1_024);
    expect(waveform.at(-1)).toBeCloseTo(0.75, 6);
    expect(frequencies).toHaveLength(512);
    expect(frequencies[10]).toBeCloseTo(-99, 6);
    expect(analyzer.frequencyBinWidthHz).toBeCloseTo(46.875, 6);
    expect(analyzer.frequencyForBin(10)).toBeCloseTo(468.75, 6);
    expect(() => analyzer.frequencyForBin(512)).toThrow(
      "Frequency-bin index is outside the current FFT range",
    );
  });

  it("validates Spectrum configuration and target buffer sizes", () => {
    const context = new FakeAudioContext();
    const analyzer = new AudioAnalyzer(context as unknown as AudioContext);

    expect(() =>
      analyzer.configureSpectrum({ fftSize: 512 as 1_024 }),
    ).toThrow("Unsupported Spectrum Analyzer fftSize");
    expect(() =>
      analyzer.configureSpectrum({ smoothingTimeConstant: 1.1 }),
    ).toThrow("smoothingTimeConstant must be in the range [0, 1]");
    expect(() => analyzer.readWaveform(new Float32Array(5))).toThrow(
      "Waveform buffer length must equal current fftSize",
    );
    expect(() => analyzer.readFrequencyData(new Float32Array(5))).toThrow(
      "Frequency buffer length must equal frequencyBinCount",
    );
  });

  it("resets held meter state and disposes the non-audible analysis graph idempotently", () => {
    const context = new FakeAudioContext(48_000);
    const analyzer = new AudioAnalyzer(context as unknown as AudioContext);
    const meter = context.analysers[0];
    meter!.timeData = Float32Array.from({ length: 8_192 }, () => 0.5);
    expect(analyzer.readMeter(0).heldPeakDbfs).toBeGreaterThan(-10);

    analyzer.resetMeter();
    meter!.timeData = new Float32Array(8_192);
    expect(analyzer.readMeter(0).heldPeakDbfs).toBe(-100);

    analyzer.dispose();
    analyzer.dispose();
    expect(context.gains[0]?.disconnected).toBe(true);
    expect(context.analysers[0]?.disconnected).toBe(true);
    expect(context.analysers[1]?.disconnected).toBe(true);
    expect(() => analyzer.readMeter(0)).toThrow(
      "Cannot use a disposed AudioAnalyzer",
    );
  });
});
