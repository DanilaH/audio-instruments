import { getWaveformCanvasPixelRatio } from "../../components/visualizations/WaveformCanvas";
import {
  SPECTRUM_DISPLAY_MAX_DB,
  SPECTRUM_DISPLAY_MIN_DB,
} from "../../browser/analysis/AudioAnalyzer";
import {
  SPECTROGRAM_COLUMN_CAPACITY,
  SPECTRUM_DISPLAY_MIN_HZ,
  dbToDisplayRatio,
  frequencyForFftBin,
  frequencyFromLogRatio,
  frequencyToLogRatio,
  getSpectrumDisplayMaxHz,
  spectrogramDbToIntensity,
  spectrogramTimestampToRatio,
  type SpectrogramColumn,
} from "./model";

interface CanvasGeometry {
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly pixelRatio: number;
}

function syncCanvas(canvas: HTMLCanvasElement): CanvasGeometry {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = getWaveformCanvasPixelRatio(window.devicePixelRatio || 1);
  const cssWidth = Math.max(1, rect.width);
  const cssHeight = Math.max(1, rect.height);
  const pixelWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
  const pixelHeight = Math.max(1, Math.round(cssHeight * pixelRatio));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  return { cssWidth, cssHeight, pixelWidth, pixelHeight, pixelRatio };
}

const FREQUENCY_GRID_HZ = [
  20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000,
] as const;
const DB_GRID = [-100, -80, -60, -40, -20] as const;
const SPECTROGRAM_PIXEL_ALPHA = 232;

function formatFrequency(frequencyHz: number): string {
  return frequencyHz >= 1_000
    ? `${Number((frequencyHz / 1_000).toFixed(frequencyHz >= 10_000 ? 0 : 1))}k`
    : `${Math.round(frequencyHz)}`;
}

export class SpectrumCanvas {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("SpectrumCanvas requires a 2D canvas context");
    this.#canvas = canvas;
    this.#context = context;
  }

  clear(): void {
    const geometry = syncCanvas(this.#canvas);
    this.#context.setTransform(1, 0, 0, 1, 0, 0);
    this.#context.clearRect(0, 0, geometry.pixelWidth, geometry.pixelHeight);
  }

  draw(valuesDb: Float32Array, sampleRate: number, fftSize: number): void {
    if (valuesDb.length !== fftSize / 2) {
      throw new RangeError("Spectrum data length must equal fftSize / 2");
    }

    const geometry = syncCanvas(this.#canvas);
    const context = this.#context;
    context.setTransform(geometry.pixelRatio, 0, 0, geometry.pixelRatio, 0, 0);
    context.clearRect(0, 0, geometry.cssWidth, geometry.cssHeight);

    const padding = { top: 12, right: 12, bottom: 24, left: 38 };
    const width = Math.max(1, geometry.cssWidth - padding.left - padding.right);
    const height = Math.max(
      1,
      geometry.cssHeight - padding.top - padding.bottom,
    );
    const maxHz = getSpectrumDisplayMaxHz(sampleRate);

    context.font = "10px system-ui, sans-serif";
    context.textBaseline = "middle";
    context.lineWidth = 1;

    for (const db of DB_GRID) {
      const ratio =
        (db - SPECTRUM_DISPLAY_MIN_DB) /
        (SPECTRUM_DISPLAY_MAX_DB - SPECTRUM_DISPLAY_MIN_DB);
      const y = padding.top + (1 - ratio) * height;
      context.strokeStyle = "rgba(31, 63, 72, 0.10)";
      context.beginPath();
      context.moveTo(padding.left, y);
      context.lineTo(padding.left + width, y);
      context.stroke();
      context.fillStyle = "rgba(40, 54, 60, 0.62)";
      context.textAlign = "right";
      context.fillText(`${db}`, padding.left - 6, y);
    }

    for (const frequencyHz of FREQUENCY_GRID_HZ) {
      if (frequencyHz > maxHz) continue;
      const x =
        padding.left +
        frequencyToLogRatio(frequencyHz, SPECTRUM_DISPLAY_MIN_HZ, maxHz) *
          width;
      context.strokeStyle = "rgba(31, 63, 72, 0.08)";
      context.beginPath();
      context.moveTo(x, padding.top);
      context.lineTo(x, padding.top + height);
      context.stroke();
      context.fillStyle = "rgba(40, 54, 60, 0.62)";
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillText(
        formatFrequency(frequencyHz),
        x,
        padding.top + height + 6,
      );
      context.textBaseline = "middle";
    }

    context.save();
    context.beginPath();
    context.rect(padding.left, padding.top, width, height);
    context.clip();
    context.strokeStyle = "rgb(24, 125, 142)";
    context.lineWidth = 1.75;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.beginPath();

    let hasPoint = false;
    for (let binIndex = 1; binIndex < valuesDb.length; binIndex += 1) {
      const frequencyHz = frequencyForFftBin(binIndex, sampleRate, fftSize);
      if (frequencyHz < SPECTRUM_DISPLAY_MIN_HZ) continue;
      if (frequencyHz > maxHz) break;

      const x =
        padding.left +
        frequencyToLogRatio(frequencyHz, SPECTRUM_DISPLAY_MIN_HZ, maxHz) *
          width;
      const y =
        padding.top +
        (1 - dbToDisplayRatio(valuesDb[binIndex] ?? -100)) * height;
      if (!hasPoint) {
        context.moveTo(x, y);
        hasPoint = true;
      } else {
        context.lineTo(x, y);
      }
    }

    if (hasPoint) context.stroke();
    context.restore();
  }
}

function writeSpectrogramPixel(
  data: Uint8ClampedArray,
  pixelIndex: number,
  intensity: number,
): void {
  const offset = pixelIndex * 4;
  const t = Math.min(1, Math.max(0, intensity));

  // Interpolate from the instrument-field neutral to the same semantic signal
  // teal used by the spectrum trace. Alpha is intentionally independent of
  // intensity so weak real FFT bins are not attenuated twice.
  data[offset] = Math.round(238 - 214 * t);
  data[offset + 1] = Math.round(240 - 115 * t);
  data[offset + 2] = Math.round(233 - 91 * t);
  data[offset + 3] = SPECTROGRAM_PIXEL_ALPHA;
}

export class SpectrogramCanvas {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  #image: ImageData | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("SpectrogramCanvas requires a 2D canvas context");
    this.#canvas = canvas;
    this.#context = context;
  }

  clear(): void {
    const geometry = syncCanvas(this.#canvas);
    this.#context.setTransform(1, 0, 0, 1, 0, 0);
    this.#context.clearRect(0, 0, geometry.pixelWidth, geometry.pixelHeight);
    this.#image?.data.fill(0);
  }

  draw(
    columns: readonly SpectrogramColumn[],
    nowMs: number,
    sampleRate: number,
    fftSize: number,
  ): void {
    const geometry = syncCanvas(this.#canvas);
    const context = this.#context;
    context.setTransform(1, 0, 0, 1, 0, 0);

    const image = this.#getImage(geometry.pixelWidth, geometry.pixelHeight);
    image.data.fill(0);
    const maxHz = getSpectrumDisplayMaxHz(sampleRate);
    const columnPixelWidth = Math.max(
      1,
      Math.ceil(geometry.pixelWidth / SPECTROGRAM_COLUMN_CAPACITY),
    );
    const binIndexByY = new Uint32Array(geometry.pixelHeight);

    for (let y = 0; y < geometry.pixelHeight; y += 1) {
      const frequencyRatio = 1 - y / Math.max(1, geometry.pixelHeight - 1);
      const frequencyHz = frequencyFromLogRatio(
        frequencyRatio,
        SPECTRUM_DISPLAY_MIN_HZ,
        maxHz,
      );
      binIndexByY[y] = Math.min(
        fftSize / 2 - 1,
        Math.max(0, Math.round((frequencyHz / sampleRate) * fftSize)),
      );
    }

    for (const column of columns) {
      if (column.valuesDb.length !== fftSize / 2) continue;
      const xRatio = spectrogramTimestampToRatio(column.timestampMs, nowMs);
      const xStart = Math.min(
        geometry.pixelWidth - 1,
        Math.max(0, Math.round(xRatio * (geometry.pixelWidth - 1))),
      );

      for (let y = 0; y < geometry.pixelHeight; y += 1) {
        const binIndex = binIndexByY[y] ?? 0;
        const intensity = spectrogramDbToIntensity(
          column.valuesDb[binIndex] ?? -100,
        );

        for (
          let x = xStart;
          x < Math.min(geometry.pixelWidth, xStart + columnPixelWidth);
          x += 1
        ) {
          writeSpectrogramPixel(
            image.data,
            y * geometry.pixelWidth + x,
            intensity,
          );
        }
      }
    }

    context.putImageData(image, 0, 0);
  }

  #getImage(pixelWidth: number, pixelHeight: number): ImageData {
    if (
      !this.#image ||
      this.#image.width !== pixelWidth ||
      this.#image.height !== pixelHeight
    ) {
      this.#image = this.#context.createImageData(pixelWidth, pixelHeight);
    }
    return this.#image;
  }
}
