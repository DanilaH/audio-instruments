import { describe, expect, it } from "vitest";

import {
  DOMINANT_FFT_MIN_HZ,
  SPECTROGRAM_COLUMN_CAPACITY,
  SPECTROGRAM_HISTORY_MS,
  SPECTROGRAM_MIN_COLUMN_INTERVAL_MS,
  SpectrogramHistory,
  dbToDisplayRatio,
  findDominantFftBin,
  frequencyForFftBin,
  frequencyToLogRatio,
  getSpectrumDisplayMaxHz,
  spectrogramTimestampToRatio,
} from "../../src/tools/spectrum-analyzer/model";

describe("Spectrum Analyzer display model", () => {
  it("caps the visible frequency range at 20 kHz or Nyquist", () => {
    expect(getSpectrumDisplayMaxHz(48_000)).toBe(20_000);
    expect(getSpectrumDisplayMaxHz(32_000)).toBe(16_000);
  });

  it("maps the spectrum frequency axis logarithmically", () => {
    expect(frequencyToLogRatio(20, 20, 20_000)).toBeCloseTo(0, 8);
    expect(frequencyToLogRatio(20_000, 20, 20_000)).toBeCloseTo(1, 8);
    expect(frequencyToLogRatio(200, 20, 20_000)).toBeCloseTo(1 / 3, 6);
    expect(frequencyToLogRatio(2_000, 20, 20_000)).toBeCloseTo(2 / 3, 6);
  });

  it("maps analyser dB values into the documented -100..-20 display clamp", () => {
    expect(dbToDisplayRatio(-120)).toBe(0);
    expect(dbToDisplayRatio(-100)).toBe(0);
    expect(dbToDisplayRatio(-60)).toBeCloseTo(0.5, 8);
    expect(dbToDisplayRatio(-20)).toBe(1);
    expect(dbToDisplayRatio(0)).toBe(1);
  });

  it("labels the strongest displayed FFT bin while ignoring ordinary dominance below 40 Hz", () => {
    const fftSize = 2_048;
    const sampleRate = 48_000;
    const values = new Float32Array(fftSize / 2).fill(-90);
    values[1] = -25; // 23.4375 Hz: deliberately stronger but below the 40 Hz label floor.
    values[4] = -35; // 93.75 Hz.
    values[8] = -45;

    const dominant = findDominantFftBin(values, sampleRate, fftSize);

    expect(DOMINANT_FFT_MIN_HZ).toBe(40);
    expect(dominant).toEqual({
      binIndex: 4,
      frequencyHz: 93.75,
      valueDb: -35,
    });
    expect(frequencyForFftBin(4, sampleRate, fftSize)).toBe(93.75);
  });

  it("ignores bins above the displayed 20 kHz range and non-finite values", () => {
    const fftSize = 1_024;
    const sampleRate = 48_000;
    const values = new Float32Array(fftSize / 2).fill(-90);
    values[5] = Number.NaN;
    values[100] = -50;
    values[500] = -10; // Above 20 kHz and must not win.

    expect(findDominantFftBin(values, sampleRate, fftSize)).toMatchObject({
      binIndex: 100,
      valueDb: -50,
    });
  });
});

describe("SpectrogramHistory", () => {
  it("samples at no more than 30 columns per second and copies retained data", () => {
    const history = new SpectrogramHistory();
    const values = new Float32Array([-80, -60]);

    expect(history.ingest(0, values)).toBe(true);
    expect(
      history.ingest(SPECTROGRAM_MIN_COLUMN_INTERVAL_MS - 0.1, values),
    ).toBe(false);
    expect(
      history.ingest(SPECTROGRAM_MIN_COLUMN_INTERVAL_MS + 0.1, values),
    ).toBe(true);

    values[0] = -20;
    const columns = history.columnsForRender(100);
    expect(columns).toHaveLength(2);
    expect(columns[0]?.valuesDb[0]).toBe(-80);
  });

  it("evicts by real timestamp and preserves gaps instead of stretching history", () => {
    const history = new SpectrogramHistory();
    const values = new Float32Array([-70]);
    history.ingest(0, values);
    history.ingest(1_000, values);
    history.ingest(9_000, values);

    const columns = history.columnsForRender(10_000);
    expect(columns.map((column) => column.timestampMs)).toEqual([
      0, 1_000, 9_000,
    ]);
    expect(spectrogramTimestampToRatio(0, 10_000)).toBe(0);
    expect(spectrogramTimestampToRatio(1_000, 10_000)).toBeCloseTo(0.1, 8);
    expect(spectrogramTimestampToRatio(9_000, 10_000)).toBeCloseTo(0.9, 8);

    expect(history.columnsForRender(SPECTROGRAM_HISTORY_MS + 1)).toEqual([
      expect.objectContaining({ timestampMs: 1_000 }),
      expect.objectContaining({ timestampMs: 9_000 }),
    ]);
  });

  it("never exceeds the hard 300-column capacity", () => {
    const history = new SpectrogramHistory();
    const values = new Float32Array([-70]);
    const step = SPECTROGRAM_MIN_COLUMN_INTERVAL_MS + 0.001;

    for (let index = 0; index < SPECTROGRAM_COLUMN_CAPACITY + 5; index += 1) {
      history.ingest(index * step, values);
    }

    const nowMs = (SPECTROGRAM_COLUMN_CAPACITY + 4) * step;
    const columns = history.columnsForRender(nowMs);
    expect(columns.length).toBeLessThanOrEqual(SPECTROGRAM_COLUMN_CAPACITY);
    expect(history.size).toBeLessThanOrEqual(SPECTROGRAM_COLUMN_CAPACITY);
  });

  it("requires monotonic finite timestamps", () => {
    const history = new SpectrogramHistory();
    history.ingest(100, new Float32Array([0]));

    expect(() => history.ingest(99, new Float32Array([0]))).toThrow(
      "Spectrogram timestamps must be monotonic",
    );
    expect(() => history.columnsForRender(Number.NaN)).toThrow(
      "Spectrogram timestamp must be finite",
    );
  });
});
