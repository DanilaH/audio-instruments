import {
  validateSweepDefinition,
  type SweepDefinition,
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
export const BASS_SWEEP_DEFAULT_DURATION_SECONDS = 12;

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
