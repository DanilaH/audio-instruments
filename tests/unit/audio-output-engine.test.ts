import { describe, expect, it } from "vitest";

import {
  AudioOutputEngine,
  scheduleSweepOnParam,
} from "../../src/browser/audio-output/AudioOutputEngine";
import {
  HEARING_LEVEL_PROFILE,
  dbToGain,
  type SweepDefinition,
} from "../../src/utils/audio";

type ParamEvent = {
  kind: "hold" | "cancel" | "set" | "linear" | "exponential";
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

  exponentialRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "exponential", value, time });
    return this as unknown as AudioParam;
  }
}

class FakeNode {
  readonly connections: Array<{ destination: FakeNode; input: number }> = [];
  disconnected = false;

  connect(destination: FakeNode, output = 0, input = 0) {
    void output;
    this.connections.push({ destination, input });
    return destination as unknown as AudioNode;
  }

  disconnect() {
    this.disconnected = true;
  }
}

class FakeGainNode extends FakeNode {
  readonly gain = new FakeAudioParam();
}

class FakeOscillatorNode extends FakeNode {
  readonly frequency = new FakeAudioParam();
  type: OscillatorType = "sine";
  readonly starts: number[] = [];
  readonly stops: number[] = [];
  #ended: (() => void) | null = null;

  start(time = 0) {
    this.starts.push(time);
  }

  stop(time = 0) {
    this.stops.push(time);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type !== "ended") return;
    this.#ended = () => {
      if (typeof listener === "function") listener(new Event("ended"));
      else listener.handleEvent(new Event("ended"));
    };
  }

  emitEnded() {
    this.#ended?.();
  }
}

class FakePannerNode extends FakeNode {
  readonly pan = new FakeAudioParam();
}

class FakeBufferSourceNode extends FakeNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  readonly starts: Array<{ time: number; offset: number }> = [];
  readonly stops: number[] = [];
  #ended: (() => void) | null = null;

  start(time = 0, offset = 0) {
    this.starts.push({ time, offset });
  }

  stop(time = 0) {
    this.stops.push(time);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type !== "ended") return;
    this.#ended = () => {
      if (typeof listener === "function") listener(new Event("ended"));
      else listener.handleEvent(new Event("ended"));
    };
  }

  emitEnded() {
    this.#ended?.();
  }
}

class FakeAudioContext {
  currentTime = 2;
  readonly destination = new FakeNode();
  readonly gains: FakeGainNode[] = [];
  readonly mergers: FakeNode[] = [];
  readonly oscillators: FakeOscillatorNode[] = [];
  readonly panners: FakePannerNode[] = [];
  readonly bufferSources: FakeBufferSourceNode[] = [];

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

  createStereoPanner() {
    const node = new FakePannerNode();
    this.panners.push(node);
    return node as unknown as StereoPannerNode;
  }

  createBufferSource() {
    const node = new FakeBufferSourceNode();
    this.bufferSources.push(node);
    return node as unknown as AudioBufferSourceNode;
  }
}

const linearSweep: SweepDefinition = {
  lowHz: 100,
  highHz: 1_000,
  durationSeconds: 4,
  direction: "ascending",
  scale: "linear",
};

describe("AudioOutputEngine", () => {
  it("starts at the general -24 dB master level and clamps to the -12 dB app max", () => {
    const context = new FakeAudioContext();
    const engine = new AudioOutputEngine(context as unknown as AudioContext);
    const master = context.gains[0]?.gain;

    expect(master?.value).toBeCloseTo(dbToGain(-24), 8);

    engine.setLevelDb(0);

    expect(master?.events.at(-1)).toMatchObject({
      kind: "linear",
      value: dbToGain(-12),
      time: 2.05,
    });
  });

  it("enforces the hearing -36 dB default and -24 dB maximum in the shared engine", () => {
    const context = new FakeAudioContext();
    const engine = new AudioOutputEngine(context as unknown as AudioContext, {
      levelProfile: "hearing",
    });
    const master = context.gains[0]?.gain;

    expect(master?.value).toBeCloseTo(dbToGain(-36), 8);
    expect(engine.levelProfile).toEqual(HEARING_LEVEL_PROFILE);

    engine.setLevelDb(-12);

    expect(master?.events.at(-1)).toMatchObject({
      kind: "linear",
      value: dbToGain(-24),
      time: 2.05,
    });
  });

  it("rejects unknown profiles and non-finite Level values at the engine boundary", () => {
    const invalidContext = new FakeAudioContext();
    expect(
      () =>
        new AudioOutputEngine(invalidContext as unknown as AudioContext, {
          levelProfile: "custom" as "hearing",
        }),
    ).toThrow("Unknown Level profile");

    const context = new FakeAudioContext();
    const engine = new AudioOutputEngine(context as unknown as AudioContext);
    expect(() => engine.setLevelDb(Number.NaN)).toThrow("finite dB value");
    expect(() => engine.setLevelDb(Number.POSITIVE_INFINITY)).toThrow(
      "finite dB value",
    );
  });

  it("fades every generated source in from silence over the shared 50 ms ramp", () => {
    const oscillatorContext = new FakeAudioContext();
    const oscillatorEngine = new AudioOutputEngine(
      oscillatorContext as unknown as AudioContext,
    );
    oscillatorEngine.startOscillator({ frequencyHz: 440 });
    expect(oscillatorContext.gains[1]?.gain.events.slice(0, 2)).toEqual([
      { kind: "set", value: 0, time: 2 },
      { kind: "linear", value: 1, time: 2.05 },
    ]);

    const pannedContext = new FakeAudioContext();
    const pannedEngine = new AudioOutputEngine(
      pannedContext as unknown as AudioContext,
    );
    pannedEngine.startPannedOscillator(500);
    expect(pannedContext.gains[1]?.gain.events.slice(0, 2)).toEqual([
      { kind: "set", value: 0, time: 2 },
      { kind: "linear", value: 1, time: 2.05 },
    ]);

    const bufferContext = new FakeAudioContext();
    const bufferEngine = new AudioOutputEngine(
      bufferContext as unknown as AudioContext,
    );
    bufferEngine.startBuffer({} as AudioBuffer);
    expect(bufferContext.gains[1]?.gain.events.slice(0, 2)).toEqual([
      { kind: "set", value: 0, time: 2 },
      { kind: "linear", value: 1, time: 2.05 },
    ]);
  });

  it("uses explicit per-channel gains and a merger for hard Left/Both/Right routing", () => {
    const context = new FakeAudioContext();
    const engine = new AudioOutputEngine(context as unknown as AudioContext);
    const playback = engine.startOscillator({
      frequencyHz: 500,
      channelMode: "left",
    });

    const leftGain = context.gains[2]?.gain;
    const rightGain = context.gains[3]?.gain;

    expect(context.mergers).toHaveLength(1);
    expect(leftGain?.value).toBe(1);
    expect(rightGain?.value).toBe(0);

    playback.setChannelMode("both");
    expect(leftGain?.events.at(-1)).toMatchObject({ kind: "linear", value: 1 });
    expect(rightGain?.events.at(-1)).toMatchObject({
      kind: "linear",
      value: 1,
    });

    playback.setChannelMode("right");
    expect(leftGain?.events.at(-1)).toMatchObject({ kind: "linear", value: 0 });
    expect(rightGain?.events.at(-1)).toMatchObject({
      kind: "linear",
      value: 1,
    });
  });

  it("uses StereoPannerNode only for continuous pan", () => {
    const context = new FakeAudioContext();
    const engine = new AudioOutputEngine(context as unknown as AudioContext);
    const playback = engine.startPannedOscillator(500, -1);

    expect(context.panners).toHaveLength(1);
    expect(context.mergers).toHaveLength(0);
    expect(context.panners[0]?.pan.value).toBe(-1);

    playback.setPan(1);
    expect(context.panners[0]?.pan.events.at(-1)).toMatchObject({
      kind: "linear",
      value: 1,
    });
  });

  it("schedules linear and logarithmic sweeps with the canonical AudioParam ramps", () => {
    const linearParam = new FakeAudioParam();
    scheduleSweepOnParam(linearParam as unknown as AudioParam, linearSweep, 3);

    expect(linearParam.events).toContainEqual({
      kind: "set",
      value: 100,
      time: 3,
    });
    expect(linearParam.events).toContainEqual({
      kind: "linear",
      value: 1_000,
      time: 7,
    });

    const logParam = new FakeAudioParam();
    scheduleSweepOnParam(
      logParam as unknown as AudioParam,
      { ...linearSweep, scale: "logarithmic", direction: "descending" },
      5,
    );

    expect(logParam.events).toContainEqual({
      kind: "set",
      value: 1_000,
      time: 5,
    });
    expect(logParam.events).toContainEqual({
      kind: "exponential",
      value: 100,
      time: 9,
    });
  });

  it("uses a ramped idempotent stop and releases nodes after ended", () => {
    const context = new FakeAudioContext();
    const engine = new AudioOutputEngine(context as unknown as AudioContext);
    const playback = engine.startOscillator({ frequencyHz: 440 });
    const oscillator = context.oscillators[0];

    playback.stop();
    playback.stop();

    expect(oscillator?.stops).toEqual([2.05]);
    oscillator?.emitEnded();
    expect(oscillator?.disconnected).toBe(true);
  });
});
