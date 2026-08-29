export const AV_SYNC_PERIOD_MS = 1_000;
export const AV_SYNC_LEAD_IN_MS = 500;
export const AV_SYNC_OFFSET_MIN_MS = -300;
export const AV_SYNC_OFFSET_MAX_MS = 300;
export const AV_SYNC_OFFSET_STEP_MS = 5;
export const AV_SYNC_SCHEDULER_TICK_MS = 100;
export const AV_SYNC_SCHEDULE_HORIZON_MS = 1_500;
export const AV_SYNC_VISUAL_PULSE_MS = 100;
export const AV_SYNC_VISUAL_ARM_LEAD_MS = 50;

export interface AvSyncAnchors {
  readonly perfAnchorMs: number;
  readonly audioAnchorSec: number;
}

export interface AvSyncCycleTiming {
  readonly cycleIndex: number;
  readonly visualTargetPerfMs: number;
  readonly audioTargetContextSec: number;
}

export function normalizeAvSyncOffsetMs(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("AV sync offset must be a finite number");
  }

  const clamped = Math.min(
    AV_SYNC_OFFSET_MAX_MS,
    Math.max(AV_SYNC_OFFSET_MIN_MS, value),
  );
  return Math.round(clamped / AV_SYNC_OFFSET_STEP_MS) * AV_SYNC_OFFSET_STEP_MS;
}

export function createAvSyncCycleTiming(
  anchors: AvSyncAnchors,
  cycleIndex: number,
  offsetMs: number,
): AvSyncCycleTiming {
  if (!Number.isInteger(cycleIndex) || cycleIndex < 0) {
    throw new RangeError("cycleIndex must be a non-negative integer");
  }
  if (!Number.isFinite(anchors.perfAnchorMs)) {
    throw new RangeError("perfAnchorMs must be finite");
  }
  if (!Number.isFinite(anchors.audioAnchorSec)) {
    throw new RangeError("audioAnchorSec must be finite");
  }

  const normalizedOffsetMs = normalizeAvSyncOffsetMs(offsetMs);
  const cycleBaseMs = AV_SYNC_LEAD_IN_MS + cycleIndex * AV_SYNC_PERIOD_MS;

  return {
    cycleIndex,
    visualTargetPerfMs: anchors.perfAnchorMs + cycleBaseMs,
    audioTargetContextSec:
      anchors.audioAnchorSec + (cycleBaseMs + normalizedOffsetMs) / 1_000,
  };
}

export function browserReportedLatencyMs(valueSeconds: unknown): number | null {
  if (
    typeof valueSeconds !== "number" ||
    !Number.isFinite(valueSeconds) ||
    valueSeconds < 0
  ) {
    return null;
  }
  return valueSeconds * 1_000;
}
