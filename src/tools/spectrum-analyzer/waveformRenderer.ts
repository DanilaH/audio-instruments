import { getWaveformCanvasPixelRatio } from "../../components/visualizations/WaveformCanvas";

export class AnalyzerWaveformCanvas {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("AnalyzerWaveformCanvas requires a 2D canvas context");
    }
    this.#canvas = canvas;
    this.#context = context;
  }

  clear(): void {
    const { pixelWidth, pixelHeight } = this.#syncSize();
    this.#context.setTransform(1, 0, 0, 1, 0, 0);
    this.#context.clearRect(0, 0, pixelWidth, pixelHeight);
  }

  draw(samples: Float32Array): void {
    const geometry = this.#syncSize();
    const context = this.#context;
    context.setTransform(geometry.pixelRatio, 0, 0, geometry.pixelRatio, 0, 0);
    context.clearRect(0, 0, geometry.cssWidth, geometry.cssHeight);

    const middleY = geometry.cssHeight / 2;
    context.strokeStyle = "rgba(31, 88, 97, 0.14)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, middleY);
    context.lineTo(geometry.cssWidth, middleY);
    context.stroke();

    if (samples.length < 2) return;

    context.strokeStyle = "rgb(24, 125, 142)";
    context.lineWidth = 1.75;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.beginPath();

    for (let index = 0; index < samples.length; index += 1) {
      const x = (index / (samples.length - 1)) * geometry.cssWidth;
      const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
      const y = middleY - sample * geometry.cssHeight * 0.42;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }

    context.stroke();
  }

  #syncSize(): {
    cssWidth: number;
    cssHeight: number;
    pixelWidth: number;
    pixelHeight: number;
    pixelRatio: number;
  } {
    const rect = this.#canvas.getBoundingClientRect();
    const pixelRatio = getWaveformCanvasPixelRatio(
      window.devicePixelRatio || 1,
    );
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const pixelWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(cssHeight * pixelRatio));

    if (
      this.#canvas.width !== pixelWidth ||
      this.#canvas.height !== pixelHeight
    ) {
      this.#canvas.width = pixelWidth;
      this.#canvas.height = pixelHeight;
    }

    return { cssWidth, cssHeight, pixelWidth, pixelHeight, pixelRatio };
  }
}
