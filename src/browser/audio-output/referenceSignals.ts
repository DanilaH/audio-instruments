import {
  validateSweepDefinition,
  type SweepDefinition,
  type SweepDirection,
  type SweepScale,
} from "../../utils/audio";

export const CHANNEL_TEST_FREQUENCY_HZ = 500;
export const CHANNEL_TEST_DURATION_SECONDS = 0.7;
export const CHANNEL_SEQUENCE_GAP_SECONDS = 0.3;
export const CHANNEL_SEQUENCE_STEP_SECONDS =
  CHANNEL_TEST_DURATION_SECONDS + CHANNEL_SEQUENCE_GAP_SECONDS;
export const CHANNEL_SEQUENCE_TOTAL_SECONDS =
  CHANNEL_TEST_DURATION_SECONDS + CHANNEL_SEQUENCE_STEP_SECONDS * 2;

export const BASS_SWEEP_MIN_HZ = 20;
export const BASS_SWEEP_MAX_HZ = 200;
export const BASS_SINGLE_TONE_DEFAULT_HZ = 60;
export const BASS_SWEEP_DEFAULT_LOW_HZ = 20;
export const BASS_SWEEP_DEFAULT_HIGH_HZ = 120;
export const BASS_SWEEP_DEFAULT_DURATION_SECONDS = 12;
export const BASS_PRESET_FREQUENCIES_HZ = [
  20, 30, 40, 50, 60, 80, 100,
] as const;
export const BASS_PRESET_SEQUENCE_MAX_HZ =
  BASS_PRESET_FREQUENCIES_HZ[BASS_PRESET_FREQUENCIES_HZ.length - 1] ??
  BASS_SWEEP_MIN_HZ;
export const BASS_PRESET_TONE_DURATION_SECONDS = 0.8;
export const BASS_PRESET_SEQUENCE_GAP_SECONDS = 0.3;
export const BASS_PRESET_SEQUENCE_STEP_SECONDS =
  BASS_PRESET_TONE_DURATION_SECONDS + BASS_PRESET_SEQUENCE_GAP_SECONDS;
export const BASS_PRESET_SEQUENCE_TOTAL_SECONDS =
  BASS_PRESET_TONE_DURATION_SECONDS +
  BASS_PRESET_SEQUENCE_STEP_SECONDS * (BASS_PRESET_FREQUENCIES_HZ.length - 1);

export const FREQUENCY_SWEEP_MIN_HZ = 20;
export const FREQUENCY_SWEEP_MAX_HZ = 20_000;
export const FREQUENCY_SWEEP_DEFAULT_LOW_HZ = 20;
export const FREQUENCY_SWEEP_DEFAULT_HIGH_HZ = 20_000;
export const FREQUENCY_SWEEP_MIN_DURATION_SECONDS = 5;
export const FREQUENCY_SWEEP_MAX_DURATION_SECONDS = 60;
export const FREQUENCY_SWEEP_DEFAULT_DURATION_SECONDS = 15;
export const FREQUENCY_SWEEP_DEFAULT_SCALE: SweepScale = "logarithmic";
export const FREQUENCY_SWEEP_DEFAULT_DIRECTION: SweepDirection = "ascending";

export function createBassSweepDefinition(
  lowHz: number,
  highHz: number,
  durationSeconds = BASS_SWEEP_DEFAULT_DURATION_SECONDS,
): SweepDefinition {
  if (lowHz < BASS_SWEEP_MIN_HZ || highHz > BASS_SWEEP_MAX_HZ) {
    throw new RangeError(
      `Bass sweep must stay within ${BASS_SWEEP_MIN_HZ}–${BASS_SWEEP_MAX_HZ} Hz`,
    );
  }

  return validateSweepDefinition({
    lowHz,
    highHz,
    durationSeconds,
    direction: "ascending",
    scale: "logarithmic",
  });
}

export function createFrequencySweepDefinition(
  lowHz: number,
  highHz: number,
  durationSeconds: number,
  scale: SweepScale,
  direction: SweepDirection,
): SweepDefinition {
  if (lowHz < FREQUENCY_SWEEP_MIN_HZ || highHz > FREQUENCY_SWEEP_MAX_HZ) {
    throw new RangeError(
      `Frequency Sweep must stay within ${FREQUENCY_SWEEP_MIN_HZ}–${FREQUENCY_SWEEP_MAX_HZ} Hz`,
    );
  }
  if (
    durationSeconds < FREQUENCY_SWEEP_MIN_DURATION_SECONDS ||
    durationSeconds > FREQUENCY_SWEEP_MAX_DURATION_SECONDS
  ) {
    throw new RangeError(
      `Frequency Sweep duration must stay within ${FREQUENCY_SWEEP_MIN_DURATION_SECONDS}–${FREQUENCY_SWEEP_MAX_DURATION_SECONDS} seconds`,
    );
  }

  return validateSweepDefinition({
    lowHz,
    highHz,
    durationSeconds,
    scale,
    direction,
  });
}
