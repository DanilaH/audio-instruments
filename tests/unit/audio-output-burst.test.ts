import { describe, expect, it } from "vitest";

import { AudioOutputEngine } from "../../src/browser/audio-output/AudioOutputEngine";

type ParamEvent = {
  kind: "hold" | "cancel" | "set" | "linear";
  value?: number;
  time: number;
};

class FakeAudioParam {
  value = 1;
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
  readonly connections: Array<{ destination: FakeNode; input: number }> = [];

  connect(destination: FakeNode, output = 0, input = 0) {
    void output;
    this.connections.push({ destination, input });
    return destination as unknown as AudioNode;
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
  readonly destination = new FakeNode();
  readonly gains: FakeGainNode[] = [];
  readonly mergers: FakeNode[] = [];
  readonly oscillators: FakeOscillatorNode[] = [];

  createGain() {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node as unknown as GainNode;
  }

  createChannelMerger() {
    const node = new FakeNode();
    this.mergers.push(node);
    return node as unknown as ChannelMergerNode;
  }

  createOscillator() {
    const node = new FakeOscillatorNode();
    this.oscillators.push(node);
    return node as unknown as OscillatorNode;
  }
}

describe("AudioOutputEngine finite oscillator bursts", () => {
  it("schedules a 700 ms source envelope and exact oscillator stop", () => {
    const context = new FakeAudioContext();
    const engine = new AudioOutputEngine(context as unknown as AudioContext);

    engine.startOscillator({
      frequencyHz: 500,
      channelMode: "left",
      startTime: 3,
      durationSeconds: 0.7,
    });

    const oscillator = context.oscillators[0];
    const sourceGain = context.gains[1]?.gain;
    const leftGain = context.gains[2]?.gain;
    const rightGain = context.gains[3]?.gain;

    expect(oscillator?.starts).toEqual([3]);
    expect(oscillator?.stops[0]).toBeCloseTo(3.7, 10);
    expect(oscillator?.frequency.events).toContainEqual({
      kind: "set",
      value: 500,
      time: 3,
    });

    expect(sourceGain?.events).toHaveLength(4);
    expect(sourceGain?.events[0]).toMatchObject({ kind: "set", value: 0 });
    expect(sourceGain?.events[0]?.time).toBeCloseTo(3, 10);
    expect(sourceGain?.events[1]).toMatchObject({ kind: "linear", value: 1 });
    expect(sourceGain?.events[1]?.time).toBeCloseTo(3.05, 10);
    expect(sourceGain?.events[2]).toMatchObject({ kind: "set", value: 1 });
    expect(sourceGain?.events[2]?.time).toBeCloseTo(3.65, 10);
    expect(sourceGain?.events[3]).toMatchObject({ kind: "linear", value: 0 });
    expect(sourceGain?.events[3]?.time).toBeCloseTo(3.7, 10);

    expect(leftGain?.value).toBe(1);
    expect(rightGain?.value).toBe(0);
  });

  it("rejects finite bursts too short to preserve both shared ramps", () => {
    const context = new FakeAudioContext();
    const engine = new AudioOutputEngine(context as unknown as AudioContext);

    expect(() =>
      engine.startOscillator({ frequencyHz: 500, durationSeconds: 0.05 }),
    ).toThrow("durationSeconds");
    expect(() =>
      engine.startOscillator({ frequencyHz: 500, durationSeconds: Number.NaN }),
    ).toThrow("durationSeconds");
    expect(context.oscillators).toHaveLength(0);
  });
});
