export interface WaveformCanvasOptions {
  readonly strokeStyle?: string;
  readonly lineWidth?: number;
  readonly backgroundStyle?: string | null;
}

export type WaveformSampleReader = () => Float32Array | null;

export function getWaveformCanvasPixelRatio(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio)) return 1;
  return Math.min(2, Math.max(1, devicePixelRatio));
}

export class WaveformCanvas {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  readonly #options: Required<
    Omit<WaveformCanvasOptions, "backgroundStyle">
  > & {
    backgroundStyle: string | null;
  };

  #frameId: number | null = null;
  #disposed = false;

  constructor(canvas: HTMLCanvasElement, options: WaveformCanvasOptions = {}) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("WaveformCanvas requires a 2D canvas context");
    }

    this.#canvas = canvas;
    this.#context = context;
    this.#options = {
      strokeStyle: options.strokeStyle ?? "currentColor",
      lineWidth: options.lineWidth ?? 2,
      backgroundStyle: options.backgroundStyle ?? null,
    };
  }

  get isRunning(): boolean {
    return this.#frameId !== null;
  }

  draw(samples: Float32Array): void {
    this.#assertUsable();
    if (samples.length === 0) return;

    const { width, height } = this.#syncSize();
    const context = this.#context;

    context.clearRect(0, 0, width, height);
    if (this.#options.backgroundStyle) {
      context.fillStyle = this.#options.backgroundStyle;
      context.fillRect(0, 0, width, height);
    }

    context.beginPath();
    context.strokeStyle = this.#options.strokeStyle;
    context.lineWidth = this.#options.lineWidth;
    context.lineJoin = "round";
    context.lineCap = "round";

    const lastIndex = samples.length - 1;
    for (let index = 0; index < samples.length; index += 1) {
      const x = lastIndex === 0 ? width / 2 : (index / lastIndex) * width;
      const normalized = Math.max(-1, Math.min(1, samples[index] ?? 0));
      const y = (1 - normalized) * 0.5 * height;

      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }

    context.stroke();
  }

  start(readSamples: WaveformSampleReader): void {
    this.#assertUsable();
    this.stop();

    const render = () => {
      if (this.#disposed) return;

      const samples = readSamples();
      if (samples) this.draw(samples);
      this.#frameId = requestAnimationFrame(render);
    };

    this.#frameId = requestAnimationFrame(render);
  }

  stop(): void {
    if (this.#frameId === null) return;
    cancelAnimationFrame(this.#frameId);
    this.#frameId = null;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.stop();
    this.#disposed = true;
  }

  #syncSize(): { width: number; height: number } {
    const rect = this.#canvas.getBoundingClientRect();
    const pixelRatio = getWaveformCanvasPixelRatio(window.devicePixelRatio || 1);
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const pixelWidth = Math.round(cssWidth * pixelRatio);
    const pixelHeight = Math.round(cssHeight * pixelRatio);

    if (
      this.#canvas.width !== pixelWidth ||
      this.#canvas.height !== pixelHeight
    ) {
      this.#canvas.width = pixelWidth;
      this.#canvas.height = pixelHeight;
    }

    this.#context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    return { width: cssWidth, height: cssHeight };
  }

  #assertUsable(): void {
    if (this.#disposed) {
      throw new Error("Cannot use a disposed WaveformCanvas");
    }
  }
}
