import type { SessionResource } from "../audio-session/AudioSession";
import {
  DEFAULT_RAMP_SECONDS,
  clamp,
  dbToGain,
  getLevelProfile,
} from "../../utils/audio";

export type MultichannelMode = "five-one" | "experimental-eight";

export interface DestinationConfiguration {
  readonly channelCount: number;
  readonly channelCountMode: ChannelCountMode;
  readonly channelInterpretation: ChannelInterpretation;
}

export interface MultichannelCapabilities {
  readonly maxChannelCount: number;
  readonly fiveOne: boolean;
  readonly experimentalEight: boolean;
  readonly restorationHealthy: boolean;
}

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

function applyDestinationConfiguration(
  destination: AudioDestinationNode,
  configuration: DestinationConfiguration,
): boolean {
  try {
    destination.channelCountMode = configuration.channelCountMode;
    destination.channelInterpretation = configuration.channelInterpretation;
    destination.channelCount = configuration.channelCount;
  } catch {
    return false;
  }

  return configurationsMatch(
    readDestinationConfiguration(destination),
    configuration,
  );
}

function holdParamAtTime(param: AudioParam, time: number): void {
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(time);
    return;
  }
  param.cancelScheduledValues(time);
  param.setValueAtTime(param.value, time);
}

function scheduleEnvelope(
  param: AudioParam,
  startTime: number,
  durationSeconds: number,
): void {
  param.setValueAtTime(0, startTime);
  param.linearRampToValueAtTime(1, startTime + DEFAULT_RAMP_SECONDS);
  const endTime = startTime + durationSeconds;
  param.setValueAtTime(1, endTime - DEFAULT_RAMP_SECONDS);
  param.linearRampToValueAtTime(0, endTime);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export class MultichannelOutputSession implements SessionResource {
  readonly #context: AudioContext;
  readonly #destination: AudioDestinationNode;
  readonly #originalConfiguration: DestinationConfiguration;
  readonly #active = new Set<MultichannelBurstPlayback>();
  readonly #levelProfile = { ...getLevelProfile("general") };

  #merger: ChannelMergerNode | null = null;
  #masterGain: GainNode | null = null;
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

  probeCapabilities(): MultichannelCapabilities {
    this.#assertUsable();
    if (this.#activeMode || this.#active.size > 0) {
      throw new Error("Cannot probe multichannel capabilities while playback is active");
    }

    const maxChannelCount = this.#destination.maxChannelCount;
    let fiveOne = false;
    let experimentalEight = false;

    if (maxChannelCount >= 6) {
      fiveOne = this.#probeTarget(FIVE_ONE_CONFIGURATION);
    }
    if (this.#restorationHealthy && maxChannelCount >= 8) {
      experimentalEight = this.#probeTarget(EXPERIMENTAL_EIGHT_CONFIGURATION);
    }

    return {
      maxChannelCount,
      fiveOne,
      experimentalEight,
      restorationHealthy: this.#restorationHealthy,
    };
  }

  async configure(mode: MultichannelMode): Promise<boolean> {
    this.#assertUsable();
    if (!this.#restorationHealthy) return false;

    if (this.#activeMode !== null || this.#active.size > 0) {
      const restored = await this.restore();
      if (!restored) return false;
    }

    const target = targetFor(mode);
    const candidate = this.#destination.maxChannelCount >= target.channelCount;
    if (!candidate) return false;

    if (!applyDestinationConfiguration(this.#destination, target)) {
      this.#restoreImmediately();
      return false;
    }

    try {
      this.#buildGraph(target.channelCount);
      this.#activeMode = mode;
      return true;
    } catch {
      this.#disconnectGraph();
      this.#restoreImmediately();
      return false;
    }
  }

  setLevelDb(db: number): void {
    this.#assertUsable();
    if (!Number.isFinite(db)) {
      throw new RangeError("Level must be a finite dB value");
    }
    this.#levelDb = clamp(db, this.#levelProfile.minDb, this.#levelProfile.maxDb);
    const masterGain = this.#masterGain;
    if (!masterGain) return;

    const now = this.#context.currentTime;
    holdParamAtTime(masterGain.gain, now);
    masterGain.gain.linearRampToValueAtTime(
      dbToGain(this.#levelDb),
      now + DEFAULT_RAMP_SECONDS,
    );
  }

  startChannel(
    channelIndex: number,
    frequencyHz: number,
    startTime: number,
    durationSeconds: number,
  ): MultichannelBurstPlayback {
    this.#assertUsable();
    const merger = this.#merger;
    const channelCount = targetFor(this.#requireActiveMode()).channelCount;
    if (!merger) throw new Error("Multichannel graph is not configured");
    if (!Number.isInteger(channelIndex) || channelIndex < 0 || channelIndex >= channelCount) {
      throw new RangeError(`channelIndex must be between 0 and ${channelCount - 1}`);
    }
    if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
      throw new RangeError("frequencyHz must be a positive finite number");
    }
    if (!Number.isFinite(startTime) || startTime < 0) {
      throw new RangeError("startTime must be a non-negative finite number");
    }
    if (!Number.isFinite(durationSeconds) || durationSeconds < DEFAULT_RAMP_SECONDS * 2) {
      throw new RangeError("durationSeconds is too short for the shared fade envelope");
    }

    const oscillator = this.#context.createOscillator();
    const sourceGain = this.#context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequencyHz, startTime);
    scheduleEnvelope(sourceGain.gain, startTime, durationSeconds);
    oscillator.connect(sourceGain);
    sourceGain.connect(merger, 0, channelIndex);

    let stopped = false;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      stopped = true;
      oscillator.disconnect();
      sourceGain.disconnect();
      this.#active.delete(playback);
    };

    const playback: MultichannelBurstPlayback = {
      oscillator,
      channelIndex,
      stop: () => {
        if (stopped) return;
        stopped = true;
        const now = this.#context.currentTime;
        holdParamAtTime(sourceGain.gain, now);
        sourceGain.gain.linearRampToValueAtTime(0, now + DEFAULT_RAMP_SECONDS);
        oscillator.stop(now + DEFAULT_RAMP_SECONDS);
      },
      dispose: () => playback.stop(),
    };

    oscillator.addEventListener("ended", cleanup, { once: true });
    this.#active.add(playback);
    oscillator.start(startTime);
    oscillator.stop(startTime + durationSeconds);
    return playback;
  }

  stop(): void {
    for (const playback of [...this.#active]) playback.stop();
  }

  async restore(): Promise<boolean> {
    this.#assertUsable();
    const hadActivePlayback = this.#active.size > 0;
    this.stop();
    if (hadActivePlayback) {
      await sleep(Math.ceil(DEFAULT_RAMP_SECONDS * 1_000) + 5);
    }
    this.#disconnectGraph();
    return this.#restoreImmediately();
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.stop();
    this.#disconnectGraph();
    this.#restoreImmediately();
    this.#disposed = true;
    this.#active.clear();
  }

  #probeTarget(target: DestinationConfiguration): boolean {
    const confirmed = applyDestinationConfiguration(this.#destination, target);
    const restored = this.#restoreImmediately();
    return confirmed && restored;
  }

  #restoreImmediately(): boolean {
    const restored = applyDestinationConfiguration(
      this.#destination,
      this.#originalConfiguration,
    );
    if (!restored) this.#restorationHealthy = false;
    return restored;
  }

  #buildGraph(channelCount: number): void {
    this.#disconnectGraph();
    const merger = this.#context.createChannelMerger(channelCount);
    const masterGain = this.#context.createGain();
    masterGain.gain.setValueAtTime(dbToGain(this.#levelDb), this.#context.currentTime);
    merger.connect(masterGain);
    masterGain.connect(this.#destination);
    this.#merger = merger;
    this.#masterGain = masterGain;
  }

  #disconnectGraph(): void {
    this.#merger?.disconnect();
    this.#masterGain?.disconnect();
    this.#merger = null;
    this.#masterGain = null;
    this.#activeMode = null;
  }

  #requireActiveMode(): MultichannelMode {
    if (!this.#activeMode) {
      throw new Error("Multichannel output mode is not configured");
    }
    return this.#activeMode;
  }

  #assertUsable(): void {
    if (this.#disposed) {
      throw new Error("Cannot use a disposed MultichannelOutputSession");
    }
  }
}
