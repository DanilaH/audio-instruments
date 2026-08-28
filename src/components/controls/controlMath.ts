import { clamp } from "../../utils/audio";

export function frequencyToSliderPosition(
  frequencyHz: number,
  minHz: number,
  maxHz: number,
): number {
  validateFrequencyRange(minHz, maxHz);
  const frequency = clamp(frequencyHz, minHz, maxHz);
  return Math.log(frequency / minHz) / Math.log(maxHz / minHz);
}

export function sliderPositionToFrequency(
  position: number,
  minHz: number,
  maxHz: number,
): number {
  validateFrequencyRange(minHz, maxHz);
  const normalized = clamp(position, 0, 1);
  return minHz * (maxHz / minHz) ** normalized;
}

function validateFrequencyRange(minHz: number, maxHz: number): void {
  if (!Number.isFinite(minHz) || minHz <= 0) {
    throw new RangeError("minHz must be a positive finite number");
  }
  if (!Number.isFinite(maxHz) || maxHz <= minHz) {
    throw new RangeError("maxHz must be greater than minHz");
  }
}
