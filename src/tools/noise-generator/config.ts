import type { NoiseKind } from "../../browser/noise/NoiseEngine";

export const NOISE_GENERATOR_KINDS = ["white", "pink", "brown"] as const satisfies readonly NoiseKind[];
export const NOISE_GENERATOR_TIMER_MINUTES = [0, 1, 5, 10] as const;

export type NoiseTimerMinutes = (typeof NOISE_GENERATOR_TIMER_MINUTES)[number];

export const NOISE_GENERATOR_INITIAL_KIND: NoiseKind = "white";
export const NOISE_GENERATOR_INITIAL_TIMER_MINUTES: NoiseTimerMinutes = 0;

export function isNoiseTimerMinutes(value: number): value is NoiseTimerMinutes {
  return NOISE_GENERATOR_TIMER_MINUTES.includes(value as NoiseTimerMinutes);
}

export function getNoiseTimerDurationMs(minutes: NoiseTimerMinutes): number | null {
  return minutes === 0 ? null : minutes * 60_000;
}
