export const GENERAL_LEVEL_MIN_DB = -60;
export const GENERAL_LEVEL_DEFAULT_DB = -24;
export const GENERAL_LEVEL_MAX_DB = -12;
export const HEARING_LEVEL_MIN_DB = -60;
export const HEARING_LEVEL_DEFAULT_DB = -36;
export const HEARING_LEVEL_MAX_DB = -24;
export const DEFAULT_RAMP_SECONDS = 0.05;

export interface LevelProfile {
  readonly minDb: number;
  readonly defaultDb: number;
  readonly maxDb: number;
}

export const GENERAL_LEVEL_PROFILE = {
  minDb: GENERAL_LEVEL_MIN_DB,
  defaultDb: GENERAL_LEVEL_DEFAULT_DB,
  maxDb: GENERAL_LEVEL_MAX_DB,
} as const satisfies LevelProfile;

export const HEARING_LEVEL_PROFILE = {
  minDb: HEARING_LEVEL_MIN_DB,
  defaultDb: HEARING_LEVEL_DEFAULT_DB,
  maxDb: HEARING_LEVEL_MAX_DB,
} as const satisfies LevelProfile;

export const LEVEL_PROFILES = {
  general: GENERAL_LEVEL_PROFILE,
  hearing: HEARING_LEVEL_PROFILE,
} as const;

export type LevelProfileName = keyof typeof LEVEL_PROFILES;

export function getLevelProfile(name: LevelProfileName): LevelProfile {
  const profile = LEVEL_PROFILES[name];
  if (!profile) {
    throw new RangeError(`Unknown Level profile: ${String(name)}`);
  }
  return profile;
}

export type SweepDirection = "ascending" | "descending";
export type SweepScale = "linear" | "logarithmic";

export interface SweepDefinition {
  readonly lowHz: number;
  readonly highHz: number;
  readonly durationSeconds: number;
  readonly direction: SweepDirection;
  readonly scale: SweepScale;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

export function getWorstCaseSummingCoefficient(sourceCount: number): number {
  if (!Number.isInteger(sourceCount) || sourceCount <= 0) {
    throw new RangeError("sourceCount must be a positive integer");
  }

  return 1 / sourceCount;
}

export function getEffectiveMaxFrequency(
  sampleRate: number,
  nominalMaxHz: number,
): number {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError("sampleRate must be a positive finite number");
  }
  if (!Number.isFinite(nominalMaxHz) || nominalMaxHz <= 0) {
    throw new RangeError("nominalMaxHz must be a positive finite number");
  }

  return Math.min(nominalMaxHz, Math.floor(sampleRate * 0.5 * 0.95));
}

export function validateSweepDefinition(
  definition: SweepDefinition,
): SweepDefinition {
  const { lowHz, highHz, durationSeconds } = definition;

  if (!Number.isFinite(lowHz) || lowHz <= 0) {
    throw new RangeError("lowHz must be a positive finite number");
  }
  if (!Number.isFinite(highHz) || highHz <= 0) {
    throw new RangeError("highHz must be a positive finite number");
  }
  if (lowHz > highHz) {
    throw new RangeError("lowHz must be less than or equal to highHz");
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError("durationSeconds must be a positive finite number");
  }

  return definition;
}

export function getSweepEndpoints(
  definition: SweepDefinition,
): readonly [startHz: number, endHz: number] {
  validateSweepDefinition(definition);

  return definition.direction === "ascending"
    ? [definition.lowHz, definition.highHz]
    : [definition.highHz, definition.lowHz];
}

export function getSweepFrequencyAtElapsed(
  definition: SweepDefinition,
  elapsedSeconds: number,
): number {
  const [startHz, endHz] = getSweepEndpoints(definition);
  const progress = clamp(elapsedSeconds / definition.durationSeconds, 0, 1);

  if (definition.scale === "linear") {
    return startHz + (endHz - startHz) * progress;
  }

  return startHz * (endHz / startHz) ** progress;
}
