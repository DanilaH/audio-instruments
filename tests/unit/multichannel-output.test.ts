import { describe, expect, it } from "vitest";

import { MultichannelOutput } from "../../src/browser/multichannel/MultichannelOutput";

type ParamEvent = {
  kind: "hold" | "cancel" | "set" | "linear";
  value?: number;
  time: number;
};

type Connection = {
  readonly from: FakeNode;
  readonly to: FakeNode;
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
  disconnectCalls = 0;

  constructor(kind: string, connections: Connection[]) {
    this.kind = kind;
    this.connections = connections;
  }

  connect(destination: unknown, output = 0, input = 0) {
    this.connections.push({
      from: this,
      to: destination as FakeNode,
      output,
      input,
    });
    return destination as AudioNode;
  }

  disconnect() {
    this.disconnectCalls += 1;
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

  start(time = 0) {
    this.starts.push(time);
  }

  stop(time = 0) {
    this.stops.push(time);
  }

  addEventListener() {}
}

type DestinationOptions = {
  readonly maxChannelCount: number;
  readonly throwOnChannelCount?: number;
  readonly mismatchChannelCount?: number;
  readonly throwOnGainCreateNumber?: number;
};

class FakeDestinationNode extends FakeNode {
  readonly maxChannelCount: number;
  failRestoration = false;
  readonly writes: string[] = [];

  #channelCount = 2;
  #channelCountMode: ChannelCountMode = "max";
  #channelInterpretation: ChannelInterpretation = "speakers";
  #targetWasApplied = false;
  readonly #throwOnChannelCount: number | undefined;
  readonly #mismatchChannelCount: number | undefined;

  constructor(connections: Connection[], options: DestinationOptions) {
    super("destination", connections);
    this.maxChannelCount = options.maxChannelCount;
    this.#throwOnChannelCount = options.throwOnChannelCount;
    this.#mismatchChannelCount = options.mismatchChannelCount;
  }

  get channelCount() {
    return this.#channelCount;
  }

  set channelCount(value: number) {
    this.writes.push(`count:${value}`);
    if (value === this.#throwOnChannelCount)
      throw new Error("channelCount rejected");
    if (this.failRestoration && this.#targetWasApplied && value === 2) {
      throw new Error("restoration rejected");
    }
    this.#channelCount =
      value === this.#mismatchChannelCount ? value - 1 : value;
    if (value >= 6) this.#targetWasApplied = true;
  }

  get channelCountMode() {
    return this.#channelCountMode;
  }

  set channelCountMode(value: ChannelCountMode) {
    this.writes.push(`mode:${value}`);
    if (this.failRestoration && this.#targetWasApplied && value === "max") {
      throw new Error("restoration rejected");
    }
    this.#channelCountMode = value;
  }

  get channelInterpretation() {
    return this.#channelInterpretation;
  }

  set channelInterpretation(value: ChannelInterpretation) {
    this.writes.push(`interpretation:${value}`);
    this.#channelInterpretation = value;
  }
}

class FakeAudioContext {
  currentTime = 4;
  readonly connections: Connection[] = [];
  readonly destination: FakeDestinationNode;
  readonly gains: FakeGainNode[] = [];
  readonly oscillators: FakeOscillatorNode[] = [];
  readonly mergers: FakeNode[] = [];
  readonly #throwOnGainCreateNumber: number | undefined;
  #gainCreateCalls = 0;

  constructor(options: DestinationOptions) {
    this.destination = new FakeDestinationNode(this.connections, options);
    this.#throwOnGainCreateNumber = options.throwOnGainCreateNumber;
  }

  createGain() {
    this.#gainCreateCalls += 1;
    if (this.#gainCreateCalls === this.#throwOnGainCreateNumber) {
      throw new Error(`gain create ${this.#gainCreateCalls} failed`);
    }
    const node = new FakeGainNode(
      `gain-${this.gains.length}`,
      this.connections,
    );
    this.gains.push(node);
    return node as unknown as GainNode;
  }

  createOscillator() {
    const node = new FakeOscillatorNode(
      `oscillator-${this.oscillators.length}`,
      this.connections,
    );
    this.oscillators.push(node);
    return node as unknown as OscillatorNode;
  }

  createChannelMerger(numberOfInputs = 2) {
    const node = new FakeNode(`merger-${numberOfInputs}`, this.connections);
    this.mergers.push(node);
    return node as unknown as ChannelMergerNode;
  }
}

describe("MultichannelOutput", () => {
  it("treats maxChannelCount as a candidate ceiling without mutating the destination", () => {
    const context = new FakeAudioContext({ maxChannelCount: 8 });
    const output = new MultichannelOutput(context as unknown as AudioContext);

    expect(output.inspectCandidates()).toEqual({
      maxChannelCount: 8,
      fiveOneCandidate: true,
      experimentalEightCandidate: true,
    });
    expect(context.destination.writes).toEqual([]);
  });

  it("does not confirm 5.1 when destination assignment throws and restores the original configuration", async () => {
    const context = new FakeAudioContext({
      maxChannelCount: 6,
      throwOnChannelCount: 6,
    });
    const output = new MultichannelOutput(context as unknown as AudioContext);

    await expect(output.configure("five-one")).resolves.toMatchObject({
      status: "unsupported",
      reason: "configuration_rejected",
    });
    expect(context.destination.channelCount).toBe(2);
    expect(context.destination.channelCountMode).toBe("max");
    expect(context.destination.channelInterpretation).toBe("speakers");
  });

  it("does not confirm 5.1 when exact destination readback differs", async () => {
    const context = new FakeAudioContext({
      maxChannelCount: 6,
      mismatchChannelCount: 6,
    });
    const output = new MultichannelOutput(context as unknown as AudioContext);

    await expect(output.configure("five-one")).resolves.toMatchObject({
      status: "unsupported",
      reason: "readback_mismatch",
    });
    expect(context.destination.channelCount).toBe(2);
    expect(context.destination.channelCountMode).toBe("max");
  });

  it("confirms standardized 5.1 only after exact explicit speakers readback", async () => {
    const context = new FakeAudioContext({ maxChannelCount: 6 });
    const output = new MultichannelOutput(context as unknown as AudioContext);

    await expect(output.configure("five-one")).resolves.toEqual({
      status: "confirmed",
      mode: "five-one",
      maxChannelCount: 6,
      configuration: {
        channelCount: 6,
        channelCountMode: "explicit",
        channelInterpretation: "speakers",
      },
    });
    expect(context.destination.channelCount).toBe(6);
    expect(context.destination.channelCountMode).toBe("explicit");
    expect(context.destination.channelInterpretation).toBe("speakers");
  });

  it("configures experimental 8-channel only on explicit configure and requires exact discrete readback", async () => {
    const context = new FakeAudioContext({ maxChannelCount: 8 });
    const output = new MultichannelOutput(context as unknown as AudioContext);

    output.inspectCandidates();
    expect(context.destination.writes).toEqual([]);

    await expect(output.configure("experimental-eight")).resolves.toMatchObject(
      {
        status: "confirmed",
        mode: "experimental-eight",
        configuration: {
          channelCount: 8,
          channelCountMode: "explicit",
          channelInterpretation: "discrete",
        },
      },
    );
  });

  it("rejects experimental 8-channel when assignment throws and restores the prior destination", async () => {
    const context = new FakeAudioContext({
      maxChannelCount: 8,
      throwOnChannelCount: 8,
    });
    const output = new MultichannelOutput(context as unknown as AudioContext);

    await expect(output.configure("experimental-eight")).resolves.toMatchObject(
      {
        status: "unsupported",
        reason: "configuration_rejected",
      },
    );
    expect(context.destination.channelCount).toBe(2);
    expect(context.destination.channelCountMode).toBe("max");
    expect(context.destination.channelInterpretation).toBe("speakers");
  });

  it("rejects experimental 8-channel when exact readback differs", async () => {
    const context = new FakeAudioContext({
      maxChannelCount: 8,
      mismatchChannelCount: 8,
    });
    const output = new MultichannelOutput(context as unknown as AudioContext);

    await expect(output.configure("experimental-eight")).resolves.toMatchObject(
      {
        status: "unsupported",
        reason: "readback_mismatch",
      },
    );
    expect(context.destination.channelCount).toBe(2);
    expect(context.destination.channelCountMode).toBe("max");
  });

  it("routes every 5.1 control to the exact requested ChannelMerger input through mono sinks", async () => {
    const context = new FakeAudioContext({ maxChannelCount: 6 });
    const output = new MultichannelOutput(context as unknown as AudioContext);
    const result = await output.configure("five-one");
    expect(result.status).toBe("confirmed");

    for (let index = 0; index < 6; index += 1) {
      output.startChannel(index, 500, 10 + index, 0.7);
    }

    const merger = context.mergers[0];
    const channelInputs = context.connections
      .filter((connection) => connection.to === merger)
      .map((connection) => connection.input);
    expect(channelInputs).toEqual([0, 1, 2, 3, 4, 5]);
    expect(
      context.oscillators.map((oscillator) => oscillator.starts[0]),
    ).toEqual([10, 11, 12, 13, 14, 15]);
    expect(
      context.oscillators.map((oscillator) => oscillator.stops[0]),
    ).toEqual([10.7, 11.7, 12.7, 13.7, 14.7, 15.7]);

    expect(context.mergers).toHaveLength(1);
    expect(
      context.connections.filter(({ from }) =>
        from.kind.startsWith("oscillator-"),
      ),
    ).toHaveLength(6);
  });

  it("disconnects a partially-built multichannel graph and remains retryable", async () => {
    const context = new FakeAudioContext({
      maxChannelCount: 6,
      throwOnGainCreateNumber: 1,
    });
    const output = new MultichannelOutput(context as unknown as AudioContext);

    await expect(output.configure("five-one")).resolves.toMatchObject({
      status: "unsupported",
      reason: "graph_build_failed",
    });
    expect(context.mergers[0]?.disconnectCalls).toBe(1);
    expect(context.destination.channelCount).toBe(2);

    await expect(output.configure("five-one")).resolves.toMatchObject({
      status: "confirmed",
    });
  });

  it("keeps a failed channel-source allocation retryable without starting the orphan oscillator", async () => {
    const context = new FakeAudioContext({
      maxChannelCount: 6,
      throwOnGainCreateNumber: 13,
    });
    const output = new MultichannelOutput(context as unknown as AudioContext);
    expect((await output.configure("five-one")).status).toBe("confirmed");

    expect(() => output.startChannel(0, 500, 10, 0.7)).toThrow(
      "gain create 13 failed",
    );
    expect(context.oscillators[0]?.starts).toEqual([]);

    expect(() => output.startChannel(0, 500, 11, 0.7)).not.toThrow();
    expect(context.oscillators[1]?.starts).toEqual([11]);
  });

  it("marks restoration unhealthy when the prior destination configuration cannot be restored", async () => {
    const context = new FakeAudioContext({ maxChannelCount: 6 });
    const output = new MultichannelOutput(context as unknown as AudioContext);
    expect((await output.configure("five-one")).status).toBe("confirmed");

    context.destination.failRestoration = true;
    await expect(output.restore()).resolves.toBe(false);
    expect(output.restorationHealthy).toBe(false);
    await expect(output.configure("five-one")).resolves.toMatchObject({
      status: "restore_failed",
    });
  });
});
