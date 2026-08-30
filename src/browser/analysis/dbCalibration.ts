import type { MeterReading } from "./AudioAnalyzer";

export const DB_CALIBRATION_STORAGE_KEY = "browserAudioLab.dbCalibration.v2";
export const DB_CALIBRATION_WINDOW_MS = 3_000;
export const DB_CALIBRATION_TARGET_SAMPLES = 30;
export const DB_CALIBRATION_MIN_VALID_SAMPLES = 25;
export const DB_CALIBRATION_MAX_STDDEV_DB = 1.5;
export const DB_CALIBRATION_CLIPPING_PEAK_DBFS = -1;

export interface CalibrationEligibilitySettings {
  readonly autoGainControl?: boolean | string;
  readonly noiseSuppression?: boolean | string;
  readonly echoCancellation?: boolean | string;
}

export interface CalibrationSample {
  readonly rmsDbfs: number;
  readonly peakDbfs: number;
}

export interface CalibrationRecord {
  readonly offset: number;
  readonly createdAt: number;
  readonly optionalLabel?: string;
}

export interface CalibrationWindowResult {
  readonly measuredCalibrationDbfs: number;
  readonly offset: number;
  readonly validSampleCount: number;
  readonly standardDeviationDb: number;
}

export type CalibrationWindowFailure =
  | "insufficient-valid-samples"
  | "clipping"
  | "unstable";

interface StoredCalibrationEnvelope {
  readonly byDeviceId: Record<string, CalibrationRecord>;
}

interface EnvelopeReadResult {
  readonly ok: boolean;
  readonly envelope: StoredCalibrationEnvelope;
}

export function isReferenceCalibrationEligible(
  settings: CalibrationEligibilitySettings,
): boolean {
  return (
    settings.autoGainControl === false &&
    settings.noiseSuppression === false &&
    settings.echoCancellation === false
  );
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? Number.NaN;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function sampleStandardDeviation(values: readonly number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const squaredDeviationSum = values.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  );
  return Math.sqrt(squaredDeviationSum / (values.length - 1));
}

export function evaluateCalibrationWindow(
  samples: readonly CalibrationSample[],
  referenceDbSpl: number,
):
  | { readonly ok: true; readonly result: CalibrationWindowResult }
  | { readonly ok: false; readonly reason: CalibrationWindowFailure } {
  if (!Number.isFinite(referenceDbSpl)) {
    throw new RangeError("referenceDbSpl must be a finite number");
  }

  const validSamples = samples.filter(
    (sample) => Number.isFinite(sample.rmsDbfs) && Number.isFinite(sample.peakDbfs),
  );
  if (validSamples.length < DB_CALIBRATION_MIN_VALID_SAMPLES) {
    return { ok: false, reason: "insufficient-valid-samples" };
  }

  if (
    validSamples.some(
      (sample) => sample.peakDbfs > DB_CALIBRATION_CLIPPING_PEAK_DBFS,
    )
  ) {
    return { ok: false, reason: "clipping" };
  }

  const rmsValues = validSamples.map((sample) => sample.rmsDbfs);
  const standardDeviationDb = sampleStandardDeviation(rmsValues);
  if (standardDeviationDb > DB_CALIBRATION_MAX_STDDEV_DB) {
    return { ok: false, reason: "unstable" };
  }

  const measuredCalibrationDbfs = median(rmsValues);
  return {
    ok: true,
    result: {
      measuredCalibrationDbfs,
      offset: referenceDbSpl - measuredCalibrationDbfs,
      validSampleCount: validSamples.length,
      standardDeviationDb,
    },
  };
}

export function estimateReferenceCalibratedLevel(
  rmsDbfs: number,
  offset: number,
): number {
  if (!Number.isFinite(rmsDbfs) || !Number.isFinite(offset)) {
    throw new RangeError("rmsDbfs and offset must be finite numbers");
  }
  return rmsDbfs + offset;
}

export function meterReadingToCalibrationSample(
  reading: Pick<MeterReading, "rmsDbfs" | "peakDbfs">,
): CalibrationSample {
  return {
    rmsDbfs: reading.rmsDbfs,
    peakDbfs: reading.peakDbfs,
  };
}

function isCalibrationRecord(value: unknown): value is CalibrationRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.offset === "number" &&
    Number.isFinite(record.offset) &&
    typeof record.createdAt === "number" &&
    Number.isFinite(record.createdAt) &&
    (record.optionalLabel === undefined || typeof record.optionalLabel === "string")
  );
}

function emptyEnvelope(): StoredCalibrationEnvelope {
  return { byDeviceId: {} };
}

function readEnvelope(storage: Storage): EnvelopeReadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(DB_CALIBRATION_STORAGE_KEY);
  } catch {
    return { ok: false, envelope: emptyEnvelope() };
  }

  if (!raw) return { ok: true, envelope: emptyEnvelope() };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: true, envelope: emptyEnvelope() };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: true, envelope: emptyEnvelope() };
  }
  const candidate = (parsed as { byDeviceId?: unknown }).byDeviceId;
  if (!candidate || typeof candidate !== "object") {
    return { ok: true, envelope: emptyEnvelope() };
  }

  const byDeviceId: Record<string, CalibrationRecord> = {};
  for (const [deviceId, value] of Object.entries(candidate)) {
    if (deviceId && isCalibrationRecord(value)) byDeviceId[deviceId] = value;
  }
  return { ok: true, envelope: { byDeviceId } };
}

export class DbCalibrationStore {
  readonly #storage: Storage;

  constructor(storage: Storage) {
    this.#storage = storage;
  }

  load(deviceId: string): CalibrationRecord | null {
    if (!deviceId) return null;
    const read = readEnvelope(this.#storage);
    if (!read.ok) return null;
    return read.envelope.byDeviceId[deviceId] ?? null;
  }

  save(deviceId: string, record: CalibrationRecord): boolean {
    if (!deviceId) return false;
    const read = readEnvelope(this.#storage);
    if (!read.ok) return false;
    read.envelope.byDeviceId[deviceId] = record;
    try {
      this.#storage.setItem(
        DB_CALIBRATION_STORAGE_KEY,
        JSON.stringify(read.envelope),
      );
      return true;
    } catch {
      return false;
    }
  }

  remove(deviceId: string): boolean {
    if (!deviceId) return false;
    const read = readEnvelope(this.#storage);
    if (!read.ok) return false;
    if (!(deviceId in read.envelope.byDeviceId)) return true;
    delete read.envelope.byDeviceId[deviceId];
    try {
      this.#storage.setItem(
        DB_CALIBRATION_STORAGE_KEY,
        JSON.stringify(read.envelope),
      );
      return true;
    } catch {
      return false;
    }
  }
}
