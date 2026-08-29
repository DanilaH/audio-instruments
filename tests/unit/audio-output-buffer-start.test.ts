import { describe, expect, it } from "vitest";

import { AudioOutputEngine } from "../../src/browser/audio-output/AudioOutputEngine";

class FakeAudioParam {
  value = 1;

  cancelAndHoldAtTime(time: number) {
    void time;
    return this as unknown as AudioParam;
  }

  cancelScheduledValues(time: number) {
    void time;
    return this as unknown as AudioParam;
  }

  setValueAtTime(value: number, time: number) {
    void time;
    this.value = value;
    return this as unknown as AudioParam;
  }

  linearRampToValueAtTime(value: number, time: number) {
    void time;
    this.value = value;
    return this as unknown as AudioParam;
  }
}

class FakeNode {
  disconnected = false;

  connect(destination: unknown, output = 0, input = 0) {
    void output;
    void input;
    return destination as AudioNode;
  }

  disconnect() {
    this.disconnected = true;
  }
}

class FakeGainNode extends FakeNode {
  readonly gain = new FakeAudioParam();
}

class FakeBufferSourceNode extends FakeNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  readonly starts: Array<{ time: number; offset: number }> = [];
  readonly stops: number[] = [];
  shouldThrowOnStart = false;

  start(time = 0, offset = 0) {
    this.starts.push({ time, offset });
    if (this.shouldThrowOnStart) {
      throw new Error("deterministic buffer start failure");
    }
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
  readonly bufferSources: FakeBufferSourceNode[] = [];
  throwNextBufferStart = true;

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

  createBufferSource() {
    const node = new FakeBufferSourceNode();
    node.shouldThrowOnStart = this.throwNextBufferStart;
    this.throwNextBufferStart = false;
    this.bufferSources.push(node);
    return node as unknown as AudioBufferSourceNode;
  }
}

describe("AudioOutputEngine buffer start transaction", () => {
  it("cleans the partial graph when AudioBufferSourceNode.start throws and permits retry", () => {
    const context = new FakeAudioContext();
    const engine = new AudioOutputEngine(context as unknown as AudioContext);

    expect(() =>
      engine.startBuffer({} as AudioBuffer, {
        loop: true,
        channelMode: "both",
      }),
    ).toThrow("deterministic buffer start failure");

    const failedSource = context.bufferSources[0];
    expect(failedSource?.disconnected).toBe(true);
    expect(failedSource?.stops).toEqual([]);
    expect(context.gains[1]?.disconnected).toBe(true);
    expect(context.gains[2]?.disconnected).toBe(true);
    expect(context.gains[3]?.disconnected).toBe(true);
    expect(context.mergers[0]?.disconnected).toBe(true);

    engine.stop();
    expect(failedSource?.stops).toEqual([]);

    const retry = engine.startBuffer({} as AudioBuffer, {
      loop: true,
      channelMode: "both",
    });
    expect(context.bufferSources[1]?.starts).toEqual([{ time: 2, offset: 0 }]);

    retry.stop();
    expect(context.bufferSources[1]?.stops.at(-1)).toBeCloseTo(2.05, 10);
  });
});
