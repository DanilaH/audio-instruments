import type { SessionResource } from "../audio-session/AudioSession";
import {
  DEFAULT_RAMP_SECONDS,
  clamp,
  dbToGain,
  getLevelProfile,
  getSweepEndpoints,
  type LevelProfile,
  type LevelProfileName,
  type SweepDefinition,
} from "../../utils/audio";

export type StereoChannelMode = "left" | "both" | "right";

export const PHASE_SWITCH_RAMP_SECONDS = 0.025;

export interface OscillatorPlayback extends SessionResource {
  readonly oscillator: OscillatorNode;
  setChannelMode(mode: StereoChannelMode): void;
  setFrequency(frequencyHz: number): void;
  setWaveform(type: OscillatorType): void;
  scheduleSweep(definition: SweepDefinition, startTime?: number): void;
  stop(): void;
}

export interface MonoOscillatorPlayback extends SessionResource {
  readonly oscillator: OscillatorNode;
  setFrequency(frequencyHz: number): void;
  setWaveform(type: OscillatorType): void;
  scheduleSweep(definition: SweepDefinition, startTime?: number): void;
  stop(): void;
}

export interface PannedOscillatorPlayback extends SessionResource {
  readonly oscillator: OscillatorNode;
  setFrequency(frequencyHz: number): void;
  setPan(value: number): void;
  schedulePanSweep(
    fromPan: number,
    toPan: number,
    durationSeconds: number,
    startTime?: number,
  ): void;
  stop(): void;
}

export interface BufferPlayback extends SessionResource {
  readonly source: AudioBufferSourceNode;
  setChannelMode(mode: StereoChannelMode): void;
  stop(): void;
}

export interface PhaseBufferPlayback extends SessionResource {
  readonly source: AudioBufferSourceNode;
  setInverted(inverted: boolean): void;
  stop(): void;
}

export interface OscillatorStartOptions {
  readonly frequencyHz: number;
  readonly waveform?: OscillatorType;
  readonly channelMode?: StereoChannelMode;
  readonly startTime?: number;
  readonly durationSeconds?: number;
  readonly sourceCoefficient?: number;
}

export interface MonoOscillatorStartOptions {
  readonly frequencyHz: number;
  readonly waveform?: OscillatorType;
  readonly startTime?: number;
  readonly durationSeconds?: number;
  readonly sourceCoefficient?: number;
}

export interface BufferStartOptions {
  readonly loop?: boolean;
  readonly channelMode?: StereoChannelMode;
  readonly startTime?: number;
  readonly offsetSeconds?: number;
  readonly sourceCoefficient?: number;
}

export interface AudioOutputEngineOptions {
  readonly destination?: AudioNode;
  readonly levelProfile?: LevelProfileName;
}

function validateSourceCoefficient(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new RangeError("sourceCoefficient must be in the range (0, 1]");
  }
  return value;
}

function validateDurationSeconds(value: number | undefined): number | null {
  if (value === undefined) return null;

  if (!Number.isFinite(value) || value < DEFAULT_RAMP_SECONDS * 2) {
    throw new RangeError(
      `durationSeconds must be finite and at least ${DEFAULT_RAMP_SECONDS * 2} seconds`,
    );
  }

  return value;
}

function validateAutomationDuration(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError("Automation duration must be a positive finite number");
  }
  return value;
}

function normalizePan(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("pan must be a finite number");
  }
  return clamp(value, -1, 1);
}

function holdParamAtTime(param: AudioParam, time: number): void {
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(time);
    return;
  }

  param.cancelScheduledValues(time);
  param.setValueAtTime(param.value, time);
}

function rampParam(
  param: AudioParam,
  target: number,
  time: number,
  durationSeconds = DEFAULT_RAMP_SECONDS,
): void {
  holdParamAtTime(param, time);
  param.linearRampToValueAtTime(target, time + durationSeconds);
}

function scheduleSourceEnvelope(
  param: AudioParam,
  coefficient: number,
  startTime: number,
  durationSeconds: number | null = null,
): void {
  param.setValueAtTime(0, startTime);
  param.linearRampToValueAtTime(coefficient, startTime + DEFAULT_RAMP_SECONDS);

  if (durationSeconds === null) return;

  const endTime = startTime + durationSeconds;
  param.setValueAtTime(coefficient, endTime - DEFAULT_RAMP_SECONDS);
  param.linearRampToValueAtTime(0, endTime);
}

class StereoChannelRouter {
  readonly #context: AudioContext;
  readonly #leftGain: GainNode;
  readonly #rightGain: GainNode;
  readonly #merger: ChannelMergerNode;
  #disposed = false;

  constructor(
    context: AudioContext,
    source: AudioNode,
    destination: AudioNode,
    mode: StereoChannelMode,
  ) {
    this.#context = context;
    this.#leftGain = context.createGain();
    this.#rightGain = context.createGain();
    this.#merger = context.createChannelMerger(2);

    source.connect(this.#leftGain);
    source.connect(this.#rightGain);
    this.#leftGain.connect(this.#merger, 0, 0);
    this.#rightGain.connect(this.#merger, 0, 1);
    this.#merger.connect(destination);

    this.setMode(mode, false);
  }

  setMode(mode: StereoChannelMode, ramp = true): void {
    if (this.#disposed) return;

    const left = mode === "right" ? 0 : 1;
    const right = mode === "left" ? 0 : 1;
    const now = this.#context.currentTime;

    if (ramp) {
      rampParam(this.#leftGain.gain, left, now);
      rampParam(this.#rightGain.gain, right, now);
      return;
    }

    this.#leftGain.gain.setValueAtTime(left, now);
    this.#rightGain.gain.setValueAtTime(right, now);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#leftGain.disconnect();
    this.#rightGain.disconnect();
    this.#merger.disconnect();
  }
}

class PhaseChannelRouter {
  readonly #context: AudioContext;
  readonly #leftGain: GainNode;
  readonly #rightGain: GainNode;
  readonly #merger: ChannelMergerNode;
  #disposed = false;
  #inverted = false;

  constructor(
    context: AudioContext,
    source: AudioNode,
    destination: AudioNode,
    inverted: boolean,
    startTime: number,
  ) {
    this.#context = context;
    this.#leftGain = context.createGain();
    this.#rightGain = context.createGain();
    this.#merger = context.createChannelMerger(2);

    source.connect(this.#leftGain);
    source.connect(this.#rightGain);
    this.#leftGain.connect(this.#merger, 0, 0);
    this.#rightGain.connect(this.#merger, 0, 1);
    this.#merger.connect(destination);

    this.#leftGain.gain.setValueAtTime(1, startTime);
    this.#rightGain.gain.setValueAtTime(inverted ? -1 : 1, startTime);
    this.#inverted = inverted;
  }

  setInverted(inverted: boolean): void {
    if (this.#disposed || inverted === this.#inverted) return;

    const now = this.#context.currentTime;
    const midpoint = now + PHASE_SWITCH_RAMP_SECONDS;
    const endTime = midpoint + PHASE_SWITCH_RAMP_SECONDS;
    const target = inverted ? -1 : 1;

    holdParamAtTime(this.#rightGain.gain, now);
    this.#rightGain.gain.linearRampToValueAtTime(0, midpoint);
    this.#rightGain.gain.setValueAtTime(0, midpoint);
    this.#rightGain.gain.linearRampToValueAtTime(target, endTime);
    this.#inverted = inverted;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#leftGain.disconnect();
    this.#rightGain.disconnect();
    this.#merger.disconnect();
  }
}

function scheduleSweepOnParam(
  param: AudioParam,
  definition: SweepDefinition,
  startTime: number,
): void {
  const [startHz, endHz] = getSweepEndpoints(definition);
  const endTime = startTime + definition.durationSeconds;

  param.cancelScheduledValues(startTime);
  param.setValueAtTime(startHz, startTime);

  if (definition.scale === "linear") {
    param.linearRampToValueAtTime(endHz, endTime);
  } else {
    param.exponentialRampToValueAtTime(endHz, endTime);
  }
}

export class AudioOutputEngine implements SessionResource {
  readonly #context: AudioContext;
  readonly #masterGain: GainNode;
  readonly #levelProfile: LevelProfile;
  readonly #active = new Set<SessionResource>();
  #disposed = false;

  constructor(context: AudioContext, options: AudioOutputEngineOptions = {}) {
    this.#context = context;
    this.#levelProfile = {
      ...getLevelProfile(options.levelProfile ?? "general"),
    };
    this.#masterGain = context.createGain();
    this.#masterGain.gain.setValueAtTime(
      dbToGain(this.#levelProfile.defaultDb),
      context.currentTime,
    );
    this.#masterGain.connect(options.destination ?? context.destination);
  }

  get levelDb(): number {
    return 20 * Math.log10(Math.max(this.#masterGain.gain.value, Number.EPSILON));
  }

  get levelProfile(): Readonly<LevelProfile> {
    return { ...this.#levelProfile };
  }

  setLevelDb(db: number): void {
    this.#assertUsable();
    if (!Number.isFinite(db)) {
      throw new RangeError("Level must be a finite dB value");
    }

    const safeDb = clamp(
      db,
      this.#levelProfile.minDb,
      this.#levelProfile.maxDb,
    );
    rampParam(
      this.#masterGain.gain,
      dbToGain(safeDb),
      this.#context.currentTime,
    );
  }

  startMonoOscillator(options: MonoOscillatorStartOptions): MonoOscillatorPlayback {
    this.#assertUsable();
    if (!Number.isFinite(options.frequencyHz) || options.frequencyHz <= 0) {
      throw new RangeError("frequencyHz must be a positive finite number");
    }

    const durationSeconds = validateDurationSeconds(options.durationSeconds);
    const coefficient = validateSourceCoefficient(options.sourceCoefficient ?? 1);
    const startTime = options.startTime ?? this.#context.currentTime;
    const oscillator = this.#context.createOscillator();
    const sourceGain = this.#context.createGain();

    oscillator.type = options.waveform ?? "sine";
    oscillator.frequency.setValueAtTime(options.frequencyHz, startTime);
    scheduleSourceEnvelope(
      sourceGain.gain,
      coefficient,
      startTime,
      durationSeconds,
    );

    let stopped = false;
    let cleaned = false;
    let connected = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      stopped = true;
      oscillator.disconnect();
      sourceGain.disconnect();
      this.#active.delete(playback);
    };

    const playback: MonoOscillatorPlayback = {
      oscillator,
      setFrequency: (frequencyHz) => {
        if (stopped) return;
        if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
          throw new RangeError("frequencyHz must be a positive finite number");
        }
        holdParamAtTime(oscillator.frequency, this.#context.currentTime);
        oscillator.frequency.setValueAtTime(
          frequencyHz,
          this.#context.currentTime,
        );
      },
      setWaveform: (type) => {
        if (!stopped) oscillator.type = type;
      },
      scheduleSweep: (
        definition,
        sweepStartTime = this.#context.currentTime,
      ) => {
        if (stopped) return;
        scheduleSweepOnParam(oscillator.frequency, definition, sweepStartTime);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        const now = this.#context.currentTime;
        rampParam(sourceGain.gain, 0, now);
        holdParamAtTime(oscillator.frequency, now);
        oscillator.stop(now + DEFAULT_RAMP_SECONDS);
      },
      dispose: () => playback.stop(),
    };

    oscillator.addEventListener("ended", cleanup, { once: true });
    this.#active.add(playback);

    try {
      oscillator.connect(sourceGain);
      sourceGain.connect(this.#masterGain);
      connected = true;
      oscillator.start(startTime);
      if (durationSeconds !== null) {
        oscillator.stop(startTime + durationSeconds);
      }
      return playback;
    } catch (error) {
      this.#active.delete(playback);
      if (connected) {
        cleanup();
      } else {
        try {
          oscillator.disconnect();
        } catch {
          // Best-effort cleanup for partially connected Web Audio nodes.
        }
        try {
          sourceGain.disconnect();
        } catch {
          // Best-effort cleanup for partially connected Web Audio nodes.
        }
      }
      throw error;
    }
  }

  startOscillator(options: OscillatorStartOptions): OscillatorPlayback {
    this.#assertUsable();
    if (!Number.isFinite(options.frequencyHz) || options.frequencyHz <= 0) {
      throw new RangeError("frequencyHz must be a positive finite number");
    }

    const durationSeconds = validateDurationSeconds(options.durationSeconds);
    const oscillator = this.#context.createOscillator();
    const sourceGain = this.#context.createGain();
    const coefficient = validateSourceCoefficient(
      options.sourceCoefficient ?? 1,
    );
    const startTime = options.startTime ?? this.#context.currentTime;
    const router = new StereoChannelRouter(
      this.#context,
      sourceGain,
      this.#masterGain,
      options.channelMode ?? "both",
    );

    oscillator.type = options.waveform ?? "sine";
    oscillator.frequency.setValueAtTime(options.frequencyHz, startTime);
    scheduleSourceEnvelope(
      sourceGain.gain,
      coefficient,
      startTime,
      durationSeconds,
    );
    oscillator.connect(sourceGain);

    let stopped = false;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      stopped = true;
      oscillator.disconnect();
      sourceGain.disconnect();
      router.dispose();
      this.#active.delete(playback);
    };

    const playback: OscillatorPlayback = {
      oscillator,
      setChannelMode: (mode) => router.setMode(mode),
      setFrequency: (frequencyHz) => {
        if (stopped) return;
        if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
          throw new RangeError("frequencyHz must be a positive finite number");
        }
        holdParamAtTime(oscillator.frequency, this.#context.currentTime);
        oscillator.frequency.setValueAtTime(
          frequencyHz,
          this.#context.currentTime,
        );
      },
      setWaveform: (type) => {
        if (!stopped) oscillator.type = type;
      },
      scheduleSweep: (
        definition,
        sweepStartTime = this.#context.currentTime,
      ) => {
        if (stopped) return;
        scheduleSweepOnParam(oscillator.frequency, definition, sweepStartTime);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        const now = this.#context.currentTime;
        rampParam(sourceGain.gain, 0, now);
        holdParamAtTime(oscillator.frequency, now);
        oscillator.stop(now + DEFAULT_RAMP_SECONDS);
      },
      dispose: () => playback.stop(),
    };

    oscillator.addEventListener("ended", cleanup, { once: true });
    this.#active.add(playback);
    oscillator.start(startTime);
    if (durationSeconds !== null) {
      oscillator.stop(startTime + durationSeconds);
    }
    return playback;
  }

  startPannedOscillator(
    frequencyHz: number,
    pan = 0,
    startTime = this.#context.currentTime,
    durationSeconds?: number,
  ): PannedOscillatorPlayback {
    this.#assertUsable();
    if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
      throw new RangeError("frequencyHz must be a positive finite number");
    }
    const safePan = normalizePan(pan);
    const safeDuration = validateDurationSeconds(durationSeconds);

    const oscillator = this.#context.createOscillator();
    const sourceGain = this.#context.createGain();
    const panner = this.#context.createStereoPanner();
    oscillator.frequency.setValueAtTime(frequencyHz, startTime);
    scheduleSourceEnvelope(sourceGain.gain, 1, startTime, safeDuration);
    panner.pan.setValueAtTime(safePan, startTime);
    oscillator.connect(sourceGain);
    sourceGain.connect(panner);
    panner.connect(this.#masterGain);

    let stopped = false;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      stopped = true;
      oscillator.disconnect();
      sourceGain.disconnect();
      panner.disconnect();
      this.#active.delete(playback);
    };

    const playback: PannedOscillatorPlayback = {
      oscillator,
      setFrequency: (nextFrequencyHz) => {
        if (stopped) return;
        if (!Number.isFinite(nextFrequencyHz) || nextFrequencyHz <= 0) {
          throw new RangeError("frequencyHz must be a positive finite number");
        }
        holdParamAtTime(oscillator.frequency, this.#context.currentTime);
        oscillator.frequency.setValueAtTime(
          nextFrequencyHz,
          this.#context.currentTime,
        );
      },
      setPan: (value) => {
        if (!stopped) {
          rampParam(panner.pan, normalizePan(value), this.#context.currentTime);
        }
      },
      schedulePanSweep: (
        fromPan,
        toPan,
        sweepDurationSeconds,
        sweepStartTime = this.#context.currentTime,
      ) => {
        if (stopped) return;
        const from = normalizePan(fromPan);
        const to = normalizePan(toPan);
        const duration = validateAutomationDuration(sweepDurationSeconds);
        panner.pan.cancelScheduledValues(sweepStartTime);
        panner.pan.setValueAtTime(from, sweepStartTime);
        panner.pan.linearRampToValueAtTime(to, sweepStartTime + duration);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        const now = this.#context.currentTime;
        rampParam(sourceGain.gain, 0, now);
        holdParamAtTime(panner.pan, now);
        oscillator.stop(now + DEFAULT_RAMP_SECONDS);
      },
      dispose: () => playback.stop(),
    };

    oscillator.addEventListener("ended", cleanup, { once: true });
    this.#active.add(playback);
    oscillator.start(startTime);
    if (safeDuration !== null) {
      oscillator.stop(startTime + safeDuration);
    }
    return playback;
  }

  startBuffer(
    buffer: AudioBuffer,
    options: BufferStartOptions = {},
  ): BufferPlayback {
    this.#assertUsable();
    const source = this.#context.createBufferSource();
    const sourceGain = this.#context.createGain();
    const coefficient = validateSourceCoefficient(
      options.sourceCoefficient ?? 1,
    );
    const startTime = options.startTime ?? this.#context.currentTime;
    const router = new StereoChannelRouter(
      this.#context,
      sourceGain,
      this.#masterGain,
      options.channelMode ?? "both",
    );

    source.buffer = buffer;
    source.loop = options.loop ?? false;
    scheduleSourceEnvelope(sourceGain.gain, coefficient, startTime);
    source.connect(sourceGain);

    let stopped = false;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      stopped = true;
      source.disconnect();
      sourceGain.disconnect();
      router.dispose();
      this.#active.delete(playback);
    };

    const playback: BufferPlayback = {
      source,
      setChannelMode: (mode) => router.setMode(mode),
      stop: () => {
        if (stopped) return;
        stopped = true;
        const now = this.#context.currentTime;
        rampParam(sourceGain.gain, 0, now);
        source.stop(now + DEFAULT_RAMP_SECONDS);
      },
      dispose: () => playback.stop(),
    };

    source.addEventListener("ended", cleanup, { once: true });
    this.#active.add(playback);
    try {
      source.start(startTime, options.offsetSeconds ?? 0);
      return playback;
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  startPhaseBuffer(
    buffer: AudioBuffer,
    inverted = false,
    startTime = this.#context.currentTime,
  ): PhaseBufferPlayback {
    this.#assertUsable();
    const source = this.#context.createBufferSource();
    const sourceGain = this.#context.createGain();
    const router = new PhaseChannelRouter(
      this.#context,
      sourceGain,
      this.#masterGain,
      inverted,
      startTime,
    );

    source.buffer = buffer;
    source.loop = true;
    scheduleSourceEnvelope(sourceGain.gain, 1, startTime);
    source.connect(sourceGain);

    let stopped = false;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      stopped = true;
      source.disconnect();
      sourceGain.disconnect();
      router.dispose();
      this.#active.delete(playback);
    };

    const playback: PhaseBufferPlayback = {
      source,
      setInverted: (nextInverted) => {
        if (!stopped) router.setInverted(nextInverted);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        const now = this.#context.currentTime;
        rampParam(sourceGain.gain, 0, now);
        source.stop(now + DEFAULT_RAMP_SECONDS);
      },
      dispose: () => playback.stop(),
    };

    source.addEventListener("ended", cleanup, { once: true });
    this.#active.add(playback);
    source.start(startTime);
    return playback;
  }

  stop(): void {
    for (const resource of [...this.#active]) {
      resource.stop?.();
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.stop();
    this.#masterGain.disconnect();
    this.#active.clear();
  }

  #assertUsable(): void {
    if (this.#disposed) {
      throw new Error("Cannot use a disposed AudioOutputEngine");
    }
  }
}

export { scheduleSweepOnParam };
