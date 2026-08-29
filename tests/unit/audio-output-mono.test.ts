import { describe, expect, it } from "vitest";

import { AudioOutputEngine } from "../../src/browser/audio-output/AudioOutputEngine";

type ParamEvent = {
  kind: "hold" | "cancel" | "set" | "linear";
  value?: number;
  time: number;
};

type Connection = {
  readonly from: string;
  readonly to: string;
  readonly output: number;
  readonly input: number;
};

class FakeAudioParam {
  value = 0;
  readonly events: ParamEvent[] = [];

  cancelAndHoldAtTime(time: number) {
    this.events.push({ kind: "hold", time });
    return this as unknown as AudioParam;
  }

  cancelScheduledValues(time: number) {
    this.events.push({ kind: "cancel", time });
    return this as unknown as AudioParam;
  }

  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "set", value, time });
    return this as unknown as AudioParam;
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "linear", value, time });
    return this as unknown as AudioParam;
  }
}

class FakeNode {
  readonly kind: string;
  readonly connections: Connection[];

  constructor(kind: string, connections: Connection[]) {
    this.kind = kind;
    this.connections = connections;
  }

  connect(destination: unknown, output = 0, input = 0) {
    const target = destination as FakeNode;
    this.connections.push({
      from: this.kind,
      to: target.kind,
      output,
      input,
    });
    return destination as AudioNode;
  }

  disconnect() {}
}

class FakeGainNode extends FakeNode {
  readonly gain = new FakeAudioParam();
}

class FakeOscillatorNode extends FakeNode {
  readonly frequency = new FakeAudioParam();
  type: OscillatorType = "sine";
  readonly starts: number[] = [];
  readonly stops: number[] = [];

  start(time = 0) {
    this.starts.push(time);
  }

  stop(time = 0) {
    this.stops.push(time);
  }

  addEventListener() {}
}

class FakeAudioContext {
  currentTime = 2;
  readonly connections: Connection[] = [];
  readonly destination = new FakeNode("destination", this.connections);
  readonly gains: FakeGainNode[] = [];
  readonly oscillators: FakeOscillatorNode[] = [];
  mergerCreates = 0;

  createGain() {
    const gain = new FakeGainNode(`gain-${this.gains.length}`, this.connections);
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createOscillator() {
    const oscillator = new FakeOscillatorNode(
      `oscillator-${this.oscillators.length}`,
      this.connections,
    );
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }

  createChannelMerger() {
    this.mergerCreates += 1;
    return new FakeNode("merger", this.connections) as unknown as ChannelMergerNode;
  }
}

describe("AudioOutputEngine mono oscillator", () => {
  it("uses the canonical source envelope without creating a stereo router", () => {
    const context = new FakeAudioContext();
    const engine = new AudioOutputEngine(context as unknown as AudioContext);

    engine.startMonoOscillator({
      frequencyHz: 500,
      waveform: "sine",
      startTime: 5,
      durationSeconds: 0.7,
    });

    expect(context.mergerCreates).toBe(0);
    expect(context.oscillators[0]?.starts).toEqual([5]);
    expect(context.oscillators[0]?.stops).toEqual([5.7]);
    expect(context.gains[1]?.gain.events).toEqual([
      { kind: "set", value: 0, time: 5 },
      { kind: "linear", value: 1, time: 5.05 },
      { kind: "set", value: 1, time: 5.65 },
      { kind: "linear", value: 0, time: 5.7 },
    ]);
    expect(context.connections).toEqual([
      { from: "gain-0", to: "destination", output: 0, input: 0 },
      { from: "oscillator-0", to: "gain-1", output: 0, input: 0 },
      { from: "gain-1", to: "gain-0", output: 0, input: 0 },
    ]);
  });

  it("uses the shared 50 ms stop ramp for early Stop", () => {
    const context = new FakeAudioContext();
    const engine = new AudioOutputEngine(context as unknown as AudioContext);
    const playback = engine.startMonoOscillator({
      frequencyHz: 500,
      startTime: 2,
      durationSeconds: 4,
    });

    context.currentTime = 3;
    playback.stop();

    expect(context.gains[1]?.gain.events.slice(-2)).toEqual([
      { kind: "hold", time: 3 },
      { kind: "linear", value: 0, time: 3.05 },
    ]);
    expect(context.oscillators[0]?.stops.at(-1)).toBeCloseTo(3.05, 10);
  });
});
