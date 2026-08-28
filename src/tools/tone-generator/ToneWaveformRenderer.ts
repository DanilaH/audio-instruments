export type ToneWaveform = "sine" | "square" | "triangle" | "sawtooth";

export interface ToneWaveformState {
  readonly waveform: ToneWaveform;
  readonly frequencyHz: number;
  readonly active: boolean;
}

export function sampleToneWaveform(
  waveform: ToneWaveform,
  phase: number,
): number {
  const normalizedPhase = phase - Math.floor(phase);
  const angle = normalizedPhase * Math.PI * 2;

  switch (waveform) {
    case "sine":
      return Math.sin(angle);
    case "square":
      return Math.sin(angle) >= 0 ? 1 : -1;
    case "triangle":
      return (2 / Math.PI) * Math.asin(Math.sin(angle));
    case "sawtooth":
      return 2 * (normalizedPhase - Math.floor(normalizedPhase + 0.5));
  }
}

function getVisualCycles(frequencyHz: number): number {
  const safeFrequency = Math.max(20, Math.min(20_000, frequencyHz));
  const normalized = Math.log10(safeFrequency / 20) / Math.log10(1_000);
  return 1.3 + normalized * 3.7;
}

export class ToneWaveformRenderer {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  readonly #motionQuery: MediaQueryList;

  #state: ToneWaveformState = {
    waveform: "sine",
    frequencyHz: 440,
    active: false,
  };
  #frameId: number | null = null;
  #phase = 0;
  #previousTimestamp: number | null = null;
  #disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("ToneWaveformRenderer requires a 2D canvas context");
    }

    this.#canvas = canvas;
    this.#context = context;
    this.#motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.#motionQuery.addEventListener("change", this.#handleMotionChange);
    this.#draw();
  }

  setState(state: ToneWaveformState): void {
    this.#assertUsable();
    this.#state = state;

    if (state.active && !this.#motionQuery.matches) {
      this.#startLoop();
      return;
    }

    this.#stopLoop();
    this.#draw();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#stopLoop();
    this.#motionQuery.removeEventListener("change", this.#handleMotionChange);
  }

  readonly #handleMotionChange = () => {
    if (this.#disposed) return;
    if (this.#state.active && !this.#motionQuery.matches) {
      this.#startLoop();
    } else {
      this.#stopLoop();
      this.#draw();
    }
  };

  #startLoop(): void {
    if (this.#frameId !== null) return;

    const frame = (timestamp: number) => {
      if (this.#disposed || !this.#state.active || this.#motionQuery.matches) {
        this.#frameId = null;
        return;
      }

      if (this.#previousTimestamp !== null) {
        const deltaSeconds = Math.min(0.05, (timestamp - this.#previousTimestamp) / 1000);
        this.#phase = (this.#phase + deltaSeconds * 0.42) % 1;
      }
      this.#previousTimestamp = timestamp;
      this.#draw();
      this.#frameId = requestAnimationFrame(frame);
    };

    this.#previousTimestamp = null;
    this.#frameId = requestAnimationFrame(frame);
  }

  #stopLoop(): void {
    if (this.#frameId !== null) {
      cancelAnimationFrame(this.#frameId);
      this.#frameId = null;
    }
    this.#previousTimestamp = null;
  }

  #draw(): void {
    const { width, height } = this.#syncSize();
    const context = this.#context;
    context.clearRect(0, 0, width, height);

    const reducedMotion = this.#motionQuery.matches;
    const trails = this.#state.active && !reducedMotion
      ? [
          { offset: -0.055, alpha: 0.08, blur: 12 },
          { offset: -0.035, alpha: 0.13, blur: 9 },
          { offset: -0.018, alpha: 0.2, blur: 6 },
          { offset: 0, alpha: 0.92, blur: 3 },
        ]
      : [{ offset: 0, alpha: 0.9, blur: 0 }];

    for (const trail of trails) {
      this.#drawPath(width, height, this.#phase + trail.offset, trail.alpha, trail.blur);
    }
  }

  #drawPath(
    width: number,
    height: number,
    phaseOffset: number,
    alpha: number,
    blur: number,
  ): void {
    const context = this.#context;
    const cycles = getVisualCycles(this.#state.frequencyHz);
    const horizontalPadding = Math.min(36, width * 0.08);
    const drawableWidth = Math.max(1, width - horizontalPadding * 2);
    const amplitude = Math.max(18, height * 0.27);
    const centerY = height / 2;
    const points = Math.max(120, Math.round(drawableWidth / 3));

    context.save();
    context.beginPath();
    context.lineWidth = 3;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.strokeStyle = `rgb(93 74 232 / ${alpha})`;
    context.shadowColor = `rgb(143 124 255 / ${Math.min(0.4, alpha)})`;
    context.shadowBlur = blur;

    for (let index = 0; index <= points; index += 1) {
      const progress = index / points;
      const x = horizontalPadding + progress * drawableWidth;
      const sample = sampleToneWaveform(
        this.#state.waveform,
        progress * cycles + phaseOffset,
      );
      const y = centerY - sample * amplitude;

      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }

    context.stroke();
    context.restore();
  }

  #syncSize(): { width: number; height: number } {
    const rect = this.#canvas.getBoundingClientRect();
    const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);

    if (this.#canvas.width !== pixelWidth || this.#canvas.height !== pixelHeight) {
      this.#canvas.width = pixelWidth;
      this.#canvas.height = pixelHeight;
    }

    this.#context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    return { width, height };
  }

  #assertUsable(): void {
    if (this.#disposed) {
      throw new Error("Cannot use a disposed ToneWaveformRenderer");
    }
  }
}
