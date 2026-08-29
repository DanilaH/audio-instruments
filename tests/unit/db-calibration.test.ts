import { describe, expect, it } from "vitest";

import {
  DB_CALIBRATION_CLIPPING_PEAK_DBFS,
  DB_CALIBRATION_MAX_STDDEV_DB,
  DB_CALIBRATION_MIN_VALID_SAMPLES,
  DB_CALIBRATION_STORAGE_KEY,
  DB_CALIBRATION_TARGET_SAMPLES,
  DbCalibrationStore,
  estimateReferenceCalibratedLevel,
  evaluateCalibrationWindow,
  isReferenceCalibrationEligible,
  type CalibrationRecord,
  type CalibrationSample,
} from "../../src/browser/analysis/dbCalibration";

class FakeStorage implements Storage {
  readonly #values = new Map<string, string>();
  readonly throwOnWrite: boolean;

  constructor(options: { readonly throwOnWrite?: boolean } = {}) {
    this.throwOnWrite = options.throwOnWrite ?? false;
  }

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.throwOnWrite) throw new Error("storage unavailable");
    this.#values.set(key, value);
  }
}

function stableSamples(
  count: number = DB_CALIBRATION_TARGET_SAMPLES,
  rmsDbfs = -40,
  peakDbfs = -12,
): CalibrationSample[] {
  return Array.from({ length: count }, (_, index) => ({
    rmsDbfs: rmsDbfs + ((index % 3) - 1) * 0.1,
    peakDbfs,
  }));
}

describe("Decibel Meter calibration eligibility", () => {
  it("requires AGC, noise suppression and echo cancellation all explicitly false", () => {
    expect(
      isReferenceCalibrationEligible({
        autoGainControl: false,
        noiseSuppression: false,
        echoCancellation: false,
      }),
    ).toBe(true);

    expect(
      isReferenceCalibrationEligible({
        autoGainControl: true,
        noiseSuppression: false,
        echoCancellation: false,
      }),
    ).toBe(false);
    expect(
      isReferenceCalibrationEligible({
        autoGainControl: false,
        noiseSuppression: false,
      }),
    ).toBe(false);
  });
});

describe("Decibel Meter calibration window", () => {
  it("uses the median RMS dBFS and external reference to derive the offset", () => {
    const result = evaluateCalibrationWindow(stableSamples(), 72);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.validSampleCount).toBe(DB_CALIBRATION_TARGET_SAMPLES);
    expect(result.result.measuredCalibrationDbfs).toBeCloseTo(-40, 6);
    expect(result.result.offset).toBeCloseTo(112, 6);
    expect(result.result.standardDeviationDb).toBeLessThan(
      DB_CALIBRATION_MAX_STDDEV_DB,
    );
    expect(
      estimateReferenceCalibratedLevel(-37.5, result.result.offset),
    ).toBeCloseTo(74.5, 6);
  });

  it("rejects fewer than 25 valid samples", () => {
    const samples = stableSamples(DB_CALIBRATION_MIN_VALID_SAMPLES - 1);
    const result = evaluateCalibrationWindow(samples, 70);
    expect(result).toEqual({ ok: false, reason: "insufficient-valid-samples" });
  });

  it("ignores non-finite samples when enforcing the valid-sample minimum", () => {
    const samples = stableSamples(DB_CALIBRATION_MIN_VALID_SAMPLES);
    samples.push({ rmsDbfs: Number.NaN, peakDbfs: -10 });
    const result = evaluateCalibrationWindow(samples, 70);
    expect(result.ok).toBe(true);
  });

  it("rejects clipping when any valid peak exceeds -1 dBFS", () => {
    const samples = stableSamples();
    samples[5] = {
      rmsDbfs: -39.9,
      peakDbfs: DB_CALIBRATION_CLIPPING_PEAK_DBFS + 0.01,
    };
    expect(evaluateCalibrationWindow(samples, 70)).toEqual({
      ok: false,
      reason: "clipping",
    });
  });

  it("accepts the exact -1 dBFS peak boundary", () => {
    const samples = stableSamples();
    samples[5] = {
      rmsDbfs: -40,
      peakDbfs: DB_CALIBRATION_CLIPPING_PEAK_DBFS,
    };
    expect(evaluateCalibrationWindow(samples, 70).ok).toBe(true);
  });

  it("rejects an unstable RMS window above 1.5 dB sample standard deviation", () => {
    const samples = Array.from(
      { length: DB_CALIBRATION_TARGET_SAMPLES },
      (_, index) => ({
        rmsDbfs: index % 2 === 0 ? -36 : -44,
        peakDbfs: -10,
      }),
    );
    expect(evaluateCalibrationWindow(samples, 70)).toEqual({
      ok: false,
      reason: "unstable",
    });
  });
});

describe("DbCalibrationStore", () => {
  it("persists records by deviceId under the canonical v2 storage key", () => {
    const storage = new FakeStorage();
    const store = new DbCalibrationStore(storage);
    const first: CalibrationRecord = {
      offset: 108.5,
      createdAt: 1_000,
      optionalLabel: "Built-in microphone",
    };
    const second: CalibrationRecord = { offset: 104, createdAt: 2_000 };

    expect(store.save("mic-1", first)).toBe(true);
    expect(store.save("mic-2", second)).toBe(true);
    expect(store.load("mic-1")).toEqual(first);
    expect(store.load("mic-2")).toEqual(second);
    expect(storage.getItem(DB_CALIBRATION_STORAGE_KEY)).toContain('"mic-1"');
  });

  it("removes only the matching current-device record", () => {
    const storage = new FakeStorage();
    const store = new DbCalibrationStore(storage);
    const first: CalibrationRecord = { offset: 108.5, createdAt: 1_000 };
    const second: CalibrationRecord = { offset: 104, createdAt: 2_000 };

    expect(store.save("mic-1", first)).toBe(true);
    expect(store.save("mic-2", second)).toBe(true);
    expect(store.remove("mic-1")).toBe(true);
    expect(store.load("mic-1")).toBeNull();
    expect(store.load("mic-2")).toEqual(second);
    expect(storage.getItem(DB_CALIBRATION_STORAGE_KEY)).not.toContain('"mic-1"');
    expect(storage.getItem(DB_CALIBRATION_STORAGE_KEY)).toContain('"mic-2"');
  });

  it("never treats an empty deviceId as persistent scope", () => {
    const storage = new FakeStorage();
    const store = new DbCalibrationStore(storage);
    expect(store.save("", { offset: 100, createdAt: 1 })).toBe(false);
    expect(store.load("")).toBeNull();
    expect(store.remove("")).toBe(false);
    expect(storage.length).toBe(0);
  });

  it("fails closed for malformed persisted data and write failures", () => {
    const malformed = new FakeStorage();
    malformed.setItem(DB_CALIBRATION_STORAGE_KEY, "not-json");
    expect(new DbCalibrationStore(malformed).load("mic-1")).toBeNull();

    const failing = new DbCalibrationStore(
      new FakeStorage({ throwOnWrite: true }),
    );
    expect(failing.save("mic-1", { offset: 100, createdAt: 1 })).toBe(false);
  });
});
