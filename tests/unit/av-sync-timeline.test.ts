import { describe, expect, it } from "vitest";

import {
  AV_SYNC_LEAD_IN_MS,
  AV_SYNC_OFFSET_MAX_MS,
  AV_SYNC_OFFSET_MIN_MS,
  AV_SYNC_OFFSET_STEP_MS,
  AV_SYNC_PERIOD_MS,
  browserReportedLatencyMs,
  createAvSyncCycleTiming,
  normalizeAvSyncOffsetMs,
} from "../../src/tools/audio-latency/avSyncTimeline";

describe("AV sync timeline", () => {
  it("uses the documented 500 ms lead-in and 1000 ms cycle period", () => {
    const anchors = { perfAnchorMs: 10_000, audioAnchorSec: 20 };

    expect(createAvSyncCycleTiming(anchors, 0, 0)).toEqual({
      cycleIndex: 0,
      visualTargetPerfMs: 10_000 + AV_SYNC_LEAD_IN_MS,
      audioTargetContextSec: 20 + AV_SYNC_LEAD_IN_MS / 1_000,
    });

    expect(createAvSyncCycleTiming(anchors, 2, 0)).toEqual({
      cycleIndex: 2,
      visualTargetPerfMs: 10_000 + AV_SYNC_LEAD_IN_MS + 2 * AV_SYNC_PERIOD_MS,
      audioTargetContextSec:
        20 + (AV_SYNC_LEAD_IN_MS + 2 * AV_SYNC_PERIOD_MS) / 1_000,
    });
  });

  it("keeps the documented sign convention", () => {
    const anchors = { perfAnchorMs: 1_000, audioAnchorSec: 2 };
    const positive = createAvSyncCycleTiming(anchors, 0, 50);
    const negative = createAvSyncCycleTiming(anchors, 0, -50);

    expect(positive.audioTargetContextSec).toBeCloseTo(2.55, 8);
    expect(negative.audioTargetContextSec).toBeCloseTo(2.45, 8);
    expect(positive.visualTargetPerfMs).toBe(1_500);
    expect(negative.visualTargetPerfMs).toBe(1_500);
  });

  it("keeps the first audio event in the future at the minimum offset", () => {
    const timing = createAvSyncCycleTiming(
      { perfAnchorMs: 0, audioAnchorSec: 10 },
      0,
      AV_SYNC_OFFSET_MIN_MS,
    );

    expect(timing.audioTargetContextSec).toBeCloseTo(10.2, 8);
  });

  it("clamps and snaps offsets to the documented 5 ms control grid", () => {
    expect(normalizeAvSyncOffsetMs(52)).toBe(50);
    expect(normalizeAvSyncOffsetMs(-52)).toBe(-50);
    expect(normalizeAvSyncOffsetMs(AV_SYNC_OFFSET_MAX_MS + 100)).toBe(
      AV_SYNC_OFFSET_MAX_MS,
    );
    expect(normalizeAvSyncOffsetMs(AV_SYNC_OFFSET_MIN_MS - 100)).toBe(
      AV_SYNC_OFFSET_MIN_MS,
    );
    expect(AV_SYNC_OFFSET_STEP_MS).toBe(5);
  });

  it("converts browser-reported seconds to milliseconds without inventing values", () => {
    expect(browserReportedLatencyMs(0.0125)).toBe(12.5);
    expect(browserReportedLatencyMs(0)).toBe(0);
    expect(browserReportedLatencyMs(undefined)).toBeNull();
    expect(browserReportedLatencyMs(Number.NaN)).toBeNull();
    expect(browserReportedLatencyMs(-0.1)).toBeNull();
  });
});
