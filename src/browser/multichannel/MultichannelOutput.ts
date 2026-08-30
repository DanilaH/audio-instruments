import {
  AudioOutputEngine,
  type MonoOscillatorPlayback,
} from "../audio-output/AudioOutputEngine";
import type { SessionResource } from "../audio-session/AudioSession";
import { DEFAULT_RAMP_SECONDS, clamp, getLevelProfile } from "../../utils/audio";

export type MultichannelMode = "five-one" | "experimental-eight";

export interface DestinationConfiguration {
  readonly channelCount: number;
  readonly channelCountMode: ChannelCountMode;
  readonly channelInterpretation: ChannelInterpretation;
}

export interface MultichannelCandidates {
  readonly maxChannelCount: number;
  readonly fiveOneCandidate: boolean;
  readonly experimentalEightCandidate: boolean;
}

export type MultichannelConfigurationFailureReason =
  | "candidate_unavailable"
  | "configuration_rejected"
  | "readback_mismatch"
  | "graph_build_failed";

export type MultichannelConfigurationResult =
  | {
      readonly status: "confirmed";
      readonly mode: MultichannelMode;
      readonly maxChannelCount: number;
      readonly configuration: DestinationConfiguration;
    }
  | {
      readonly status: "unsupported";
      readonly mode: MultichannelMode;
      readonly maxChannelCount: number;
      readonly reason: MultichannelConfigurationFailureReason;
    }
  | {
      readonly status: "restore_failed";
      readonly mode: MultichannelMode;
      readonly maxChannelCount: number;
    };

export interface MultichannelBurstPlayback extends SessionResource {
  readonly oscillator: OscillatorNode;
  readonly channelIndex: number;
  stop(): void;
}

const FIVE_ONE_CONFIGURATION: DestinationConfiguration = {
  channelCount: 6,
  channelCountMode: "explicit",
  channelInterpretation: "speakers",
};

const EXPERIMENTAL_EIGHT_CONFIGURATION: DestinationConfiguration = {
  channelCount: 8,
  channelCountMode: "explicit",
  channelInterpretation: "discrete",
};

function targetFor(mode: MultichannelMode): DestinationConfiguration {
  return mode === "five-one"
    ? FIVE_ONE_CONFIGURATION
    : EXPERIMENTAL_EIGHT_CONFIGURATION;
}

function readDestinationConfiguration(
  destination: AudioDestinationNode,
): DestinationConfiguration {
  return {
    channelCount: destination.channelCount,
    channelCountMode: destination.channelCountMode,
    channelInterpretation: destination.channelInterpretation,
  };
}

function configurationsMatch(
  actual: DestinationConfiguration,
  expected: DestinationConfiguration,
): boolean {
  return (
    actual.channelCount === expected.channelCount &&
    actual.channelCountMode === expected.channelCountMode &&
    actual.channelInterpretation === expected.channelInterpretation
  );
}

function attemptDestinationConfiguration(
  destination: AudioDestinationNode,
  configuration: DestinationConfiguration,
): "confirmed" | "configuration_rejected" | "readback_mismatch" {
  try {
    destination.channelCountMode = configuration.channelCountMode;
    destination.channelInterpretation = configuration.channelInterpretation;
    destination.channelCount = configuration.channelCount;

    return configurationsMatch(
      readDestinationConfiguration(destination),
      configuration,
    )
      ? "confirmed"
      : "readback_mismatch";
  } catch {
    return "configuration_rejected";
  }
}

function safeDisconnect(node: AudioNode | null): void {
  if (!node) return;
  try {
    node.disconnect();
  } catch {
    // The owning AudioContext is still the final cleanup boundary.
  }
}

async function waitForStopRamp(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, Math.ceil(DEFAULT_RAMP_SECONDS * 1_000) + 5);
  });
}

export class MultichannelOutput implements SessionResource {
  readonly #context: AudioContext;
  readonly #destination: AudioDestinationNode;
  readonly #originalConfiguration: DestinationConfiguration;
  readonly #active = new Set<MultichannelBurstPlayback>();
  readonly #levelProfile = { ...getLevelProfile("general") };
  readonly #channelSinks: GainNode[] = [];
  readonly #channelEngines: AudioOutputEngine[] = [];

  #merger: ChannelMergerNode | null = null;
  #activeMode: MultichannelMode | null = null;
  #restorationHealthy = true;
  #disposed = false;
  #levelDb = this.#levelProfile.defaultDb;

  constructor(context: AudioContext) {
    this.#context = context;
    this.#destination = context.destination;
    this.#originalConfiguration = readDestinationConfiguration(this.#destination);
  }

  get activeMode(): MultichannelMode | null {
    return this.#activeMode;
  }

  get restorationHealthy(): boolean {
    return this.#restorationHealthy;
  }

  get originalConfiguration(): DestinationConfiguration {
    return { ...this.#originalConfiguration };
  }

  inspectCandidates(): MultichannelCandidates {
    this.#assertUsable();
    const maxChannelCount = this.#destination.maxChannelCount;
    return {
      maxChannelCount,
      fiveOneCandidate: maxChannelCount >= 6,
      experimentalEightCandidate: maxChannelCount >= 8,
    };
  }

  async configure(mode: MultichannelMode): Promise<MultichannelConfigurationResult> {
    this.#assertUsable();
    const maxChannelCount = this.#destination.maxChannelCount;

    if (!this.#restorationHealthy) {
      return { status: "restore_failed", mode, maxChannelCount };
    }

    if (this.#activeMode !== null || this.#active.size > 0) {
      const restored = await this.restore();
      if (!restored) {
        return { status: "restore_failed", mode, maxChannelCount };
      }
    }

    const target = targetFor(mode);
    if (maxChannelCount < target.channelCount) {
      return {
        status: "unsupported",
        mode,
        maxChannelCount,
        reason: "candidate_unavailable",
      };
    }

    const attempted = attemptDestinationConfiguration(this.#destination, target);
    if (attempted !== "confirmed") {
      const restored = this.#restoreImmediately();
      if (!restored) {
        return { status: "restore_failed", mode, maxChannelCount };
      }
      return {
        status: "unsupported",
        mode,
        maxChannelCount,
        reason: attempted,
      };
    }

    try {
      this.#buildGraph(target.channelCount);
      this.#activeMode = mode;
      return {
        status: "confirmed",
        mode,
        maxChannelCount,
        configuration: readDestinationConfiguration(this.#destination),
      };
    } catch {
      this.#disconnectGraph();
      const restored = this.#restoreImmediately();
      if (!restored) {
        return { status: "restore_failed", mode, maxChannelCount };
      }
      return {
        status: "unsupported",
        mode,
        maxChannelCount,
        reason: "graph_build_failed",
      };
    }
  }

  setLevelDb(db: number): void {
    this.#assertUsable();
    if (!Number.isFinite(db)) {
      throw new RangeError("Level must be a finite dB value");
    }

    this.#levelDb = clamp(
      db,
      this.#levelProfile.minDb,
      this.#levelProfile.maxDb,
    );
    for (const engine of this.#channelEngines) {
      engine.setLevelDb(this.#levelDb);
    }
  }

  startChannel(
    channelIndex: number,
    frequencyHz: number,
    startTime: number,
    durationSeconds: number,
  ): MultichannelBurstPlayback {
    this.#assertUsable();
    const channelCount = targetFor(this.#requireActiveMode()).channelCount;
    const engine = this.#channelEngines[channelIndex];

    if (
      !Number.isInteger(channelIndex) ||
      channelIndex < 0 ||
      channelIndex >= channelCount ||
      !engine
    ) {
      throw new RangeError(`channelIndex must be between 0 and ${channelCount - 1}`);
    }
    if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
      throw new RangeError("frequencyHz must be a positive finite number");
    }
    if (!Number.isFinite(startTime) || startTime < 0) {
      throw new RangeError("startTime must be a non-negative finite number");
    }
    if (
      !Number.isFinite(durationSeconds) ||
      durationSeconds < DEFAULT_RAMP_SECONDS * 2
    ) {
      throw new RangeError(
        "durationSeconds is too short for the shared fade envelope",
      );
    }

    const enginePlayback: MonoOscillatorPlayback = engine.startMonoOscillator({
      frequencyHz,
      waveform: "sine",
      startTime,
      durationSeconds,
    });

    const playback: MultichannelBurstPlayback = {
      oscillator: enginePlayback.oscillator,
      channelIndex,
      stop: () => enginePlayback.stop(),
      dispose: () => enginePlayback.dispose?.(),
    };

    enginePlayback.oscillator.addEventListener(
      "ended",
      () => this.#active.delete(playback),
      { once: true },
    );
    this.#active.add(playback);
    return playback;
  }

  stop(): void {
    for (const playback of [...this.#active]) {
      playback.stop();
    }
  }

  async restore(): Promise<boolean> {
    this.#assertUsable();
    const hadActivePlayback = this.#active.size > 0;
    this.stop();
    if (hadActivePlayback) {
      await waitForStopRamp();
    }
    this.#disconnectGraph();
    return this.#restoreImmediately();
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;

    const hadActivePlayback = this.#active.size > 0;
    this.stop();
    if (hadActivePlayback) {
      await waitForStopRamp();
    }
    this.#disconnectGraph();
    this.#restoreImmediately();
    this.#disposed = true;
  }

  #restoreImmediately(): boolean {
    const restored =
      attemptDestinationConfiguration(
        this.#destination,
        this.#originalConfiguration,
      ) === "confirmed";
    if (!restored) {
      this.#restorationHealthy = false;
    }
    return restored;
  }

  #buildGraph(channelCount: number): void {
    this.#disconnectGraph();

    try {
      this.#merger = this.#context.createChannelMerger(channelCount);

      for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
        const sink = this.#context.createGain();
        this.#channelSinks.push(sink);
        sink.channelCount = 1;
        sink.channelCountMode = "explicit";
        sink.channelInterpretation = "discrete";
        sink.connect(this.#merger, 0, channelIndex);

        const engine = new AudioOutputEngine(this.#context, {
          destination: sink,
          levelProfile: "general",
        });
        this.#channelEngines.push(engine);
        engine.setLevelDb(this.#levelDb);
      }

      this.#merger.connect(this.#destination);
    } catch (error) {
      this.#disconnectGraph();
      throw error;
    }
  }

  #disconnectGraph(): void {
    this.#active.clear();
    this.#activeMode = null;

    for (const engine of this.#channelEngines.splice(0)) {
      engine.dispose();
    }
    for (const sink of this.#channelSinks.splice(0)) {
      safeDisconnect(sink);
    }

    const merger = this.#merger;
    this.#merger = null;
    safeDisconnect(merger);
  }

  #requireActiveMode(): MultichannelMode {
    if (!this.#activeMode) {
      throw new Error("Multichannel output mode is not configured");
    }
    return this.#activeMode;
  }

  #assertUsable(): void {
    if (this.#disposed) {
      throw new Error("Cannot use a disposed MultichannelOutput");
    }
  }
}
