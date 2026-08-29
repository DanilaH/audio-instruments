import { AudioOutputEngine } from "../../browser/audio-output/AudioOutputEngine";
import { AudioSession } from "../../browser/audio-session/AudioSession";
import {
  AV_SYNC_SCHEDULE_HORIZON_MS,
  AV_SYNC_SCHEDULER_TICK_MS,
  AV_SYNC_VISUAL_ARM_LEAD_MS,
  AV_SYNC_VISUAL_PULSE_MS,
  browserReportedLatencyMs,
  createAvSyncCycleTiming,
  normalizeAvSyncOffsetMs,
  type AvSyncAnchors,
} from "./avSyncTimeline";

const AV_SYNC_CLICK_FREQUENCY_HZ = 1_000;
const AV_SYNC_CLICK_DURATION_SECONDS = 0.1;

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Audio Latency tool is missing required element: ${selector}`);
  }
  return element;
}

function requireElements<T extends Element>(
  root: ParentNode,
  selector: string,
): readonly T[] {
  const elements = [...root.querySelectorAll<T>(selector)];
  if (elements.length === 0) {
    throw new Error(`Audio Latency tool is missing required elements: ${selector}`);
  }
  return elements;
}

function formatSignedOffset(offsetMs: number): string {
  if (offsetMs > 0) return `+${offsetMs} ms`;
  if (offsetMs < 0) return `−${Math.abs(offsetMs)} ms`;
  return "0 ms";
}

function formatReportedLatency(valueSeconds: unknown): string {
  const milliseconds = browserReportedLatencyMs(valueSeconds);
  return milliseconds === null
    ? "Not reported by this browser"
    : `${milliseconds.toFixed(1)} ms`;
}

export class AudioLatencyController {
  readonly #root: HTMLElement;
  readonly #listeners = new AbortController();
  readonly #startButton: HTMLButtonElement;
  readonly #stopButton: HTMLButtonElement;
  readonly #offsetInput: HTMLInputElement;
  readonly #offsetValues: readonly HTMLElement[];
  readonly #resultValue: HTMLElement;
  readonly #pulse: HTMLElement;
  readonly #baseLatency: HTMLElement;
  readonly #outputLatency: HTMLElement;
  readonly #status: HTMLElement;
  readonly #statusLabel: HTMLElement;
  readonly #errorMessage: HTMLElement;

  #session: AudioSession | null = null;
  #output: AudioOutputEngine | null = null;
  #context: AudioContext | null = null;
  #anchors: AvSyncAnchors | null = null;
  #schedulerTimer: number | null = null;
  #visualArmTimeouts = new Set<number>();
  #visualRafs = new Set<number>();
  #pulseTimeout: number | null = null;
  #nextAudioCycle = 0;
  #nextVisualCycle = 0;
  #active = false;
  #starting = false;
  #disposed = false;
  #runToken = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#startButton = requireElement(root, "[data-latency-start]");
    this.#stopButton = requireElement(root, "[data-latency-stop]");
    this.#offsetInput = requireElement(root, "[data-latency-offset]");
    this.#offsetValues = requireElements(root, "[data-latency-offset-value]");
    this.#resultValue = requireElement(root, "[data-latency-result]");
    this.#pulse = requireElement(root, "[data-latency-pulse]");
    this.#baseLatency = requireElement(root, "[data-latency-base]");
    this.#outputLatency = requireElement(root, "[data-latency-output]");
    this.#status = requireElement(root, "#audio-latency-status");
    this.#statusLabel = requireElement(this.#status, "[data-status-label]");
    this.#errorMessage = requireElement(root, "[data-latency-error]");

    this.#bindEvents();
    this.#renderOffset();
    this.#renderControls();
  }

  get isActive(): boolean {
    return this.#active;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.abort();
    this.#runToken += 1;
    this.#starting = false;
    this.#active = false;
    this.#cancelSequenceScheduling();

    const session = this.#session;
    this.#session = null;
    this.#output = null;
    this.#context = null;
    if (session) await session.dispose();
  }

  #bindEvents(): void {
    const signal = this.#listeners.signal;
    this.#startButton.addEventListener("click", () => void this.#start(), {
      signal,
    });
    this.#stopButton.addEventListener("click", () => this.#stop("Stopped"), {
      signal,
    });
    this.#offsetInput.addEventListener("input", () => this.#handleOffsetChange(), {
      signal,
    });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden && (this.#active || this.#starting)) {
          this.#stop("Stopped while tab was hidden");
        }
      },
      { signal },
    );
  }

  async #ensureAudio(token: number): Promise<{
    context: AudioContext;
    output: AudioOutputEngine;
  }> {
    if (this.#session && this.#context && this.#output) {
      const context = await this.#session.getContext();
      this.#renderReportedLatencies(context);
      return { context, output: this.#output };
    }

    const session = new AudioSession();
    try {
      const context = await session.getContext();
      const output = new AudioOutputEngine(context);
      session.register(output);

      if (!this.#isCurrent(token)) {
        await session.dispose();
        throw new DOMException("Audio Latency Start was superseded", "AbortError");
      }

      this.#session = session;
      this.#context = context;
      this.#output = output;
      this.#renderReportedLatencies(context);
      return { context, output };
    } catch (error) {
      await session.dispose().catch((disposeError) => {
        console.error("Audio Latency failed-session cleanup failed", disposeError);
      });
      throw error;
    }
  }

  async #start(): Promise<void> {
    if (this.#disposed || this.#active || this.#starting) return;
    const token = ++this.#runToken;
    this.#starting = true;
    this.#hideError();
    this.#setStatus("ready", "Starting AV sync loop…");
    this.#renderControls();

    try {
      await this.#ensureAudio(token);
      if (!this.#isCurrent(token)) return;

      this.#starting = false;
      this.#active = true;
      this.#beginSequence();
      this.#setStatus("playing", "AV sync loop active");
      this.#renderControls();
    } catch (error) {
      if (!this.#isCurrent(token)) return;
      this.#starting = false;
      this.#active = false;
      console.error("Audio Latency tool failed to start", error);
      this.#setStatus("error", "Audio output unavailable");
      this.#showError(
        "The browser could not start the audio context. Check audio output availability and try again.",
      );
      this.#renderControls();
    }
  }

  #handleOffsetChange(): void {
    const normalized = normalizeAvSyncOffsetMs(Number(this.#offsetInput.value));
    this.#offsetInput.value = String(normalized);
    this.#renderOffset();

    if (this.#active) {
      this.#cancelSequenceScheduling();
      this.#beginSequence();
    }
  }

  #beginSequence(): void {
    const context = this.#context;
    if (!context || !this.#output || !this.#active) return;

    this.#anchors = {
      perfAnchorMs: performance.now(),
      audioAnchorSec: context.currentTime,
    };
    this.#nextAudioCycle = 0;
    this.#nextVisualCycle = 0;
    this.#scheduleLookahead();
    this.#schedulerTimer = window.setInterval(
      () => this.#scheduleLookahead(),
      AV_SYNC_SCHEDULER_TICK_MS,
    );
  }

  #scheduleLookahead(): void {
    const context = this.#context;
    const output = this.#output;
    const anchors = this.#anchors;
    if (!this.#active || !context || !output || !anchors) return;

    const offsetMs = normalizeAvSyncOffsetMs(Number(this.#offsetInput.value));
    const audioHorizonSec =
      context.currentTime + AV_SYNC_SCHEDULE_HORIZON_MS / 1_000;

    while (true) {
      const timing = createAvSyncCycleTiming(
        anchors,
        this.#nextAudioCycle,
        offsetMs,
      );
      if (timing.audioTargetContextSec > audioHorizonSec) break;

      if (timing.audioTargetContextSec > context.currentTime) {
        try {
          output.startMonoOscillator({
            frequencyHz: AV_SYNC_CLICK_FREQUENCY_HZ,
            waveform: "sine",
            startTime: timing.audioTargetContextSec,
            durationSeconds: AV_SYNC_CLICK_DURATION_SECONDS,
          });
        } catch (error) {
          console.error("Audio Latency click scheduling failed", error);
          this.#stop("Audio scheduling stopped");
          this.#showError(
            "A future audio click could not be scheduled. Stop and start the sync loop again.",
          );
          return;
        }
      }
      this.#nextAudioCycle += 1;
    }

    const visualHorizonMs = performance.now() + AV_SYNC_SCHEDULE_HORIZON_MS;
    while (true) {
      const timing = createAvSyncCycleTiming(
        anchors,
        this.#nextVisualCycle,
        offsetMs,
      );
      if (timing.visualTargetPerfMs > visualHorizonMs) break;
      this.#armVisualPulse(timing.visualTargetPerfMs);
      this.#nextVisualCycle += 1;
    }
  }

  #armVisualPulse(targetPerfMs: number): void {
    const armDelayMs = Math.max(
      0,
      targetPerfMs - performance.now() - AV_SYNC_VISUAL_ARM_LEAD_MS,
    );

    const timeoutId = window.setTimeout(() => {
      this.#visualArmTimeouts.delete(timeoutId);
      if (!this.#active) return;

      const frame = () => {
        this.#visualRafs.delete(rafId);
        if (!this.#active) return;
        if (performance.now() >= targetPerfMs) {
          this.#triggerVisualPulse();
          return;
        }
        rafId = window.requestAnimationFrame(frame);
        this.#visualRafs.add(rafId);
      };

      let rafId = window.requestAnimationFrame(frame);
      this.#visualRafs.add(rafId);
    }, armDelayMs);

    this.#visualArmTimeouts.add(timeoutId);
  }

  #triggerVisualPulse(): void {
    if (!this.#active) return;
    this.#pulse.dataset.active = "true";
    if (this.#pulseTimeout !== null) window.clearTimeout(this.#pulseTimeout);
    this.#pulseTimeout = window.setTimeout(() => {
      this.#pulseTimeout = null;
      delete this.#pulse.dataset.active;
    }, AV_SYNC_VISUAL_PULSE_MS);
  }

  #cancelSequenceScheduling(): void {
    if (this.#schedulerTimer !== null) {
      window.clearInterval(this.#schedulerTimer);
      this.#schedulerTimer = null;
    }

    for (const timeoutId of this.#visualArmTimeouts) {
      window.clearTimeout(timeoutId);
    }
    this.#visualArmTimeouts.clear();

    for (const rafId of this.#visualRafs) {
      window.cancelAnimationFrame(rafId);
    }
    this.#visualRafs.clear();

    if (this.#pulseTimeout !== null) {
      window.clearTimeout(this.#pulseTimeout);
      this.#pulseTimeout = null;
    }
    delete this.#pulse.dataset.active;

    this.#output?.stop();
    this.#anchors = null;
    this.#nextAudioCycle = 0;
    this.#nextVisualCycle = 0;
  }

  #stop(label: string): void {
    if (this.#disposed || (!this.#active && !this.#starting)) return;
    this.#runToken += 1;
    this.#starting = false;
    this.#active = false;
    this.#cancelSequenceScheduling();
    this.#setStatus("idle", label);
    this.#renderControls();
  }

  #renderReportedLatencies(context: AudioContext): void {
    this.#baseLatency.textContent = formatReportedLatency(context.baseLatency);
    const outputLatency = (context as AudioContext & { outputLatency?: number })
      .outputLatency;
    this.#outputLatency.textContent = formatReportedLatency(outputLatency);
  }

  #renderOffset(): void {
    const offsetMs = normalizeAvSyncOffsetMs(Number(this.#offsetInput.value));
    const label = formatSignedOffset(offsetMs);
    for (const element of this.#offsetValues) {
      element.textContent = label;
    }
    this.#resultValue.textContent = `Your selected sync offset: ${label}`;
  }

  #renderControls(): void {
    this.#startButton.disabled = this.#active || this.#starting || this.#disposed;
    this.#stopButton.disabled = !this.#active && !this.#starting;
    this.#root.dataset.latencyState = this.#active ? "playing" : "idle";
  }

  #setStatus(state: string, label: string): void {
    this.#status.dataset.state = state;
    this.#statusLabel.textContent = label;
  }

  #hideError(): void {
    this.#errorMessage.hidden = true;
    this.#errorMessage.textContent = "";
  }

  #showError(message: string): void {
    this.#errorMessage.textContent = message;
    this.#errorMessage.hidden = false;
  }

  #isCurrent(token: number): boolean {
    return !this.#disposed && token === this.#runToken;
  }
}
