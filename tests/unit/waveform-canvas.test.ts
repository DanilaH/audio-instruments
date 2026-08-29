import { describe, expect, it } from "vitest";

import { getWaveformCanvasPixelRatio } from "../../src/components/visualizations/WaveformCanvas";

describe("WaveformCanvas pixel ratio", () => {
  it("clamps the drawing-buffer DPR to the documented 1..2 range", () => {
    expect(getWaveformCanvasPixelRatio(Number.NaN)).toBe(1);
    expect(getWaveformCanvasPixelRatio(0)).toBe(1);
    expect(getWaveformCanvasPixelRatio(1)).toBe(1);
    expect(getWaveformCanvasPixelRatio(1.5)).toBe(1.5);
    expect(getWaveformCanvasPixelRatio(2)).toBe(2);
    expect(getWaveformCanvasPixelRatio(3)).toBe(2);
  });
});
