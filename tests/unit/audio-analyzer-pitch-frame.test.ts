import { describe, expect, it } from "vitest";

import { AudioAnalyzer } from "../../src/browser/analysis/AudioAnalyzer";

class FakeAudioParam {
  value = 1;
  setValueAtTime(value: number) {
    this.value = value;
    return this as unknown as AudioParam;
  }
}

class FakeNode {
  readonly connections: AudioNode[] = [];
  connect(destination: AudioNode) {
    this.connections.push(destination);
    return destination;
  }
  disconnect() {
    this.connections.length = 0;
  }
}

class FakeGainNode extends FakeNode {
  readonly gain = new FakeAudioParam();
}

class FakeAnalyserNode extends FakeNode {
  #fftSize = 2_048;
  smoothingTimeConstant = 0;
  timeData = new Float32Array();

  get fftSize() {
    return this.#fftSize;
  }
  set fftSize(value: number) {
    this.#fftSize = value;
  }
  get frequencyBinCount() {
    return this.#fftSize / 2;
  }
  getFloatTimeDomainData(target: Float32Array) {
    target.fill(0);
    const source = this.timeData.subarray(
      Math.max(0, this.timeData.length - target.length),
    );
    target.set(source, target.length - source.length);
  }
  getFloatFrequencyData(target: Float32Array) {
    target.fill(-100);
  }
}

class FakeAudioContext {
  currentTime = 0;
  readonly destination = new FakeNode();
  readonly analysers: FakeAnalyserNode[] = [];
  readonly gains: FakeGainNode[] = [];

  constructor(readonly sampleRate: number) {}

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

describe("AudioAnalyzer recent time-domain frame access", () => {
  it("copies the newest requested PCM samples from the dedicated meter analyser", () => {
    const context = new FakeAudioContext(48_000);
    const analyzer = new AudioAnalyzer(context as unknown as AudioContext);
    const meter = context.analysers[0];
    expect(meter?.fftSize).toBe(8_192);

    meter!.timeData = Float32Array.from(
      { length: 8_192 },
      (_, index) => index / 8_192,
    );

    const target = new Float32Array(2_048);
    expect(analyzer.readRecentTimeDomain(target)).toBe(target);
    expect(target[0]).toBeCloseTo(6_144 / 8_192, 6);
    expect(target.at(-1)).toBeCloseTo(8_191 / 8_192, 6);
  });

  it("uses the meter buffer independently from Spectrum FFT configuration", () => {
    const context = new FakeAudioContext(192_000);
    const analyzer = new AudioAnalyzer(context as unknown as AudioContext);
    const meter = context.analysers[0];
    const spectrum = context.analysers[1];
    expect(meter?.fftSize).toBe(32_768);

    analyzer.configureSpectrum({ fftSize: 1_024 });
    expect(spectrum?.fftSize).toBe(1_024);

    meter!.timeData = Float32Array.from(
      { length: 32_768 },
      (_, index) => (index >= 32_768 - 8_192 ? 0.25 : 0),
    );
    const pitchSourceFrame = analyzer.readRecentTimeDomain(
      new Float32Array(8_192),
    );
    expect(pitchSourceFrame.every((sample) => sample === 0.25)).toBe(true);
  });

  it("rejects empty or larger-than-meter targets", () => {
    const context = new FakeAudioContext(48_000);
    const analyzer = new AudioAnalyzer(context as unknown as AudioContext);

    expect(() => analyzer.readRecentTimeDomain(new Float32Array())).toThrow(
      "Recent time-domain target must not be empty",
    );
    expect(() =>
      analyzer.readRecentTimeDomain(new Float32Array(8_193)),
    ).toThrow("Recent time-domain target cannot exceed meter buffer length 8192");
  });
});
