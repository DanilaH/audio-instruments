import { describe, expect, it } from "vitest";

import {
  AudioOutputEngine,
  PHASE_SWITCH_RAMP_SECONDS,
} from "../../src/browser/audio-output/AudioOutputEngine";

type ParamEvent = {
  kind: "hold" | "cancel" | "set" | "linear";
  value?: number;
  time: number;
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
  connect(destination: unknown, output = 0, input = 0) {
    void output;
    void input;
    return destination as AudioNode;
  }

  disconnect() {}
}

class FakeGainNode extends FakeNode {
  readonly gain = new FakeAudioParam();
}

class FakeStereoPannerNode extends FakeNode {
  readonly pan = new FakeAudioParam();
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

class FakeBufferSourceNode extends FakeNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  readonly starts: Array<{ time: number; offset: number }> = [];
  readonly stops: number[] = [];

  start(time = 0, offset = 0) {
    this.starts.push({ time, offset });
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
  readonly panners: FakeStereoPannerNode[] = [];
  readonly oscillators: FakeOscillatorNode[] = [];
  readonly sources: FakeBufferSourceNode[] = [];

  createGain() {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node as unknown as GainNode;
  }

  createStereoPanner() {
    const node = new FakeStereoPannerNode();
    this.panners.push(node);
    return node as unknown as StereoPannerNode;
  }

  createOscillator() {
    const node = new FakeOscillatorNode();
    this.oscillators.push(node);
    return node as unknown as OscillatorNode;
  }

  createBufferSource() {
    const node = new FakeBufferSourceNode();
    this.sources.push(node);
    return node as unknown as AudioBufferSourceNode;
  }

  createChannelMerger() {
    return new FakeNode() as unknown as ChannelMergerNode;
  }
}

describe("AudioOutputEngine stereo and phase primitives", () => {
  it("schedules an exact four-second linear pan on one panned oscillator", () => {
    const context = new FakeAudioContext();
    const engine = new AudioOutputEngine(context as unknown as AudioContext);

    const playback = engine.startPannedOscillator(500, -1, 5, 4);
    playback.schedulePanSweep(-1, 1, 4, 5);

    const oscillator = context.oscillators[0];
    const sourceGain = context.gains[1]?.gain;
    const pan = context.panners[0]?.pan;

    expect(oscillator?.starts).toEqual([5]);
    expect(oscillator?.stops).toEqual([9]);
    expect(sourceGain?.events).toEqual([
      { kind: "set", value: 0, time: 5 },
      { kind: "linear", value: 1, time: 5.05 },
      { kind: "set", value: 1, time: 8.95 },
      { kind: "linear", value: 0, time: 9 },
    ]);
    expect(pan?.events).toEqual([
      { kind: "set", value: -1, time: 5 },
      { kind: "cancel", time: 5 },
      { kind: "set", value: -1, time: 5 },
      { kind: "linear", value: 1, time: 9 },
    ]);
  });

  it("switches phase by ramping only the right channel while keeping one source", () => {
    const context = new FakeAudioContext();
    const engine = new AudioOutputEngine(context as unknown as AudioContext);
    const buffer = {} as AudioBuffer;

    const playback = engine.startPhaseBuffer(buffer, false, 2);
    const source = context.sources[0];
    const left = context.gains[2]?.gain;
    const right = context.gains[3]?.gain;

    expect(context.sources).toHaveLength(1);
    expect(source?.buffer).toBe(buffer);
    expect(source?.loop).toBe(true);
    expect(source?.starts).toEqual([{ time: 2, offset: 0 }]);
    expect(left?.events).toEqual([{ kind: "set", value: 1, time: 2 }]);
    expect(right?.events).toEqual([{ kind: "set", value: 1, time: 2 }]);

    playback.setInverted(true);

    expect(context.sources).toHaveLength(1);
    expect(source?.starts).toHaveLength(1);
    expect(right?.events.slice(1)).toEqual([
      { kind: "hold", time: 2 },
      {
        kind: "linear",
        value: 0,
        time: 2 + PHASE_SWITCH_RAMP_SECONDS,
      },
      { kind: "set", value: 0, time: 2 + PHASE_SWITCH_RAMP_SECONDS },
      {
        kind: "linear",
        value: -1,
        time: 2 + PHASE_SWITCH_RAMP_SECONDS * 2,
      },
    ]);
    expect(left?.events).toHaveLength(1);
  });
});
