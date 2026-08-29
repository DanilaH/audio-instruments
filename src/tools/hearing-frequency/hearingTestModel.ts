import { getEffectiveMaxFrequency } from "../../utils/audio";

export const HEARING_REFERENCE_FREQUENCY_HZ = 1_000;
export const HEARING_REFERENCE_DURATION_SECONDS = 1;
export const HEARING_TONE_DURATION_SECONDS = 0.8;
export const HEARING_GUIDED_LEVEL_DB = -36;
export const HEARING_MANUAL_LEVEL_MIN_DB = -60;
export const HEARING_MANUAL_LEVEL_MAX_DB = -24;
export const HEARING_NOMINAL_MAX_HZ = 20_000;

export const HEARING_GUIDED_FREQUENCIES_HZ = [
  2_000,
  4_000,
  6_000,
  8_000,
  10_000,
  12_000,
  14_000,
  16_000,
  18_000,
  20_000,
] as const;

export interface HearingCapability {
  readonly effectiveMaxHz: number;
  readonly referenceAvailable: boolean;
  readonly guidedFrequenciesHz: readonly number[];
  readonly limited: boolean;
}

export function getHearingCapability(sampleRate: number): HearingCapability {
  const effectiveMaxHz = getEffectiveMaxFrequency(
    sampleRate,
    HEARING_NOMINAL_MAX_HZ,
  );
  const guidedFrequenciesHz = HEARING_GUIDED_FREQUENCIES_HZ.filter(
    (frequencyHz) => frequencyHz <= effectiveMaxHz,
  );

  return {
    effectiveMaxHz,
    referenceAvailable: effectiveMaxHz >= HEARING_REFERENCE_FREQUENCY_HZ,
    guidedFrequenciesHz,
    limited: effectiveMaxHz < HEARING_NOMINAL_MAX_HZ,
  };
}

export function nextGuidedFrequency(
  frequenciesHz: readonly number[],
  currentIndex: number,
): number | null {
  if (!Number.isInteger(currentIndex) || currentIndex < 0) {
    throw new RangeError("currentIndex must be a non-negative integer");
  }
  return frequenciesHz[currentIndex] ?? null;
}

export function recordHeardFrequency(
  highestHeardHz: number | null,
  frequencyHz: number,
): number {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    throw new RangeError("frequencyHz must be a positive finite number");
  }
  if (highestHeardHz === null) return frequencyHz;
  if (!Number.isFinite(highestHeardHz) || highestHeardHz <= 0) {
    throw new RangeError("highestHeardHz must be null or a positive finite number");
  }
  return Math.max(highestHeardHz, frequencyHz);
}

export function formatHearingFrequency(frequencyHz: number): string {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) return "—";
  if (frequencyHz >= 1_000 && frequencyHz % 1_000 === 0) {
    return `${frequencyHz / 1_000} kHz`;
  }
  return `${Math.round(frequencyHz)} Hz`;
}
