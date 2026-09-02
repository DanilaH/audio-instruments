from pathlib import Path

noise = r'''---
import LevelControl from "../../components/controls/LevelControl.astro";
import ToolStatus from "../../components/feedback/ToolStatus.astro";
import SonicInstrument from "../../components/layout/SonicInstrument.astro";
import {
  NOISE_GENERATOR_INITIAL_KIND,
  NOISE_GENERATOR_INITIAL_TIMER_MINUTES,
  NOISE_GENERATOR_KINDS,
  NOISE_GENERATOR_TIMER_MINUTES,
} from "./config";

const kindLabel = (kind: string) =>
  `${kind[0]?.toUpperCase() ?? ""}${kind.slice(1)}`;
const timerLabel = (minutes: number) =>
  minutes === 0 ? "Off" : `${minutes} min`;
---

<div
  data-noise-generator
  data-noise-kind={NOISE_GENERATOR_INITIAL_KIND}
  data-noise-visual="idle"
>
  <SonicInstrument
    label="Noise Generator controls and reference-noise visualization"
    class="noise-sheet"
  >
    <div class="noise-bar">
      <ToolStatus id="noise-generator-status" label="Ready" state="idle" />
      <div class="noise-readout" aria-label="Generated noise reference">
        <span>Generated reference</span>
        <strong data-noise-kind-readout>White noise</strong>
        <small data-noise-timer-readout>Timer off</small>
      </div>
    </div>

    <section class="noise-field" aria-label="Reference noise visualization">
      <div class="noise-field__heading">
        <div>
          <span>Local reference buffer</span>
          <strong>Noise source state</strong>
        </div>
        <p>44.1 kHz · 8 s loop · mono source to L/R</p>
      </div>

      <div class="noise-stage" aria-hidden="true">
        <span class="noise-stage__axis noise-stage__axis--top"></span>
        <span class="noise-stage__axis noise-stage__axis--middle"></span>
        <span class="noise-stage__axis noise-stage__axis--bottom"></span>
        <span class="noise-stage__grain noise-stage__grain--one"></span>
        <span class="noise-stage__grain noise-stage__grain--two"></span>
        <span class="noise-stage__grain noise-stage__grain--three"></span>
        <span class="noise-stage__cursor"></span>
      </div>

      <p class="noise-field__note">
        Reference visualization only. It does not show a spectrum, acoustic
        measurement, loudness or laboratory spectral analysis.
      </p>
    </section>

    <section class="noise-rail" aria-label="Noise Generator settings and transport">
      <div class="noise-kinds">
        <span class="noise-rail__label">Noise type</span>
        <div class="noise-selector noise-selector--kinds">
          {
            NOISE_GENERATOR_KINDS.map((kind) => (
              <button
                type="button"
                data-noise-kind={kind}
                aria-pressed={kind === NOISE_GENERATOR_INITIAL_KIND}
              >
                <span
                  class={`noise-dot noise-dot--${kind}`}
                  aria-hidden="true"
                />
                {kindLabel(kind)}
              </button>
            ))
          }
        </div>
      </div>

      <div class="noise-timer">
        <span class="noise-rail__label">Timer</span>
        <div class="noise-selector noise-selector--timer">
          {
            NOISE_GENERATOR_TIMER_MINUTES.map((minutes) => (
              <button
                type="button"
                data-noise-timer={minutes}
                aria-pressed={
                  minutes === NOISE_GENERATOR_INITIAL_TIMER_MINUTES
                }
              >
                {timerLabel(minutes)}
              </button>
            ))
          }
        </div>
        <div class="noise-long-reminder-slot">
          <p class="noise-long-reminder" data-noise-long-reminder hidden>
            <i class="ph ph-timer" aria-hidden="true"></i>
            Long playback: keep device/headphone volume at a comfortable level.
          </p>
        </div>
      </div>

      <div class="noise-output">
        <span class="noise-rail__label">Output</span>
        <LevelControl
          id="noise-generator-level"
          valueDb={-24}
          minDb={-60}
          maxDb={-12}
        />
        <div class="noise-actions">
          <button type="button" class="noise-play" data-noise-play>
            <i class="ph ph-play" aria-hidden="true"></i>
            Play noise
          </button>
          <button type="button" class="noise-stop" data-noise-stop disabled>
            <span class="transport-stop-shape" aria-hidden="true"></span>
            Stop
          </button>
        </div>
      </div>
    </section>

    <div class="noise-state-strip noise-safety">
      <strong>Comfort level</strong>
      <div>
        <p>
          Start with your device/headphone volume low. Increase it only to a
          comfortable listening level. Do not turn the volume up to compensate
          for a tone you cannot hear.
        </p>
        <small>
          Generated digital noise only; Browser Audio Lab cannot measure the
          physical loudness reaching your ears.
        </small>
      </div>
    </div>

    <div class="noise-feedback-slot">
      <p class="noise-error" data-noise-error role="alert" hidden></p>
    </div>
  </SonicInstrument>
</div>

<script>
  import { NoiseGeneratorController } from "./NoiseGeneratorController";

  const root = document.querySelector<HTMLElement>("[data-noise-generator]");
  let controller: NoiseGeneratorController | null = null;

  const mount = () => {
    if (!root || controller) return;
    controller = new NoiseGeneratorController(root);
  };

  const teardown = () => {
    const current = controller;
    controller = null;
    if (current) void current.dispose();
  };

  window.addEventListener("pagehide", teardown);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) mount();
  });

  mount();
</script>

<style>
  .noise-bar {
    display: flex;
    min-height: 54px;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 8px 18px;
    border-bottom: 1px solid var(--sonic-border-soft);
  }

  .noise-readout {
    display: grid;
    grid-template-columns: auto auto;
    align-items: baseline;
    gap: 1px 10px;
    text-align: right;
  }

  .noise-readout > span,
  .noise-field__heading span,
  .noise-rail__label {
    color: var(--sonic-muted);
    font-size: 0.67rem;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .noise-readout > span {
    grid-row: 1 / 3;
    align-self: center;
  }

  .noise-readout strong {
    font-size: 1.08rem;
    line-height: 1;
  }

  .noise-readout small {
    color: var(--sonic-muted);
    font-size: 0.68rem;
  }

  .noise-field {
    display: grid;
    grid-template-rows: auto minmax(100px, 1fr) auto;
    gap: 7px;
    min-height: 216px;
    padding: 14px 20px 10px;
    border-bottom: 1px solid var(--sonic-border);
    background: var(--sonic-field);
  }

  .noise-field__heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 18px;
  }

  .noise-field__heading > div {
    display: grid;
    gap: 2px;
  }

  .noise-field__heading strong {
    font-size: 0.88rem;
  }

  .noise-field__heading p,
  .noise-field__note {
    margin: 0;
    color: var(--sonic-muted);
    font-size: 0.7rem;
    line-height: 1.35;
  }

  .noise-stage {
    position: relative;
    align-self: center;
    width: min(100%, 820px);
    height: 82px;
    margin-inline: auto;
    overflow: hidden;
    border-top: 1px solid var(--sonic-border);
    border-bottom: 1px solid var(--sonic-border);
    background: rgb(243 240 232 / 0.28);
  }

  .noise-stage__axis,
  .noise-stage__grain,
  .noise-stage__cursor {
    position: absolute;
    left: 0;
    right: 0;
  }

  .noise-stage__axis {
    height: 1px;
    background: rgb(24 52 59 / 0.09);
  }

  .noise-stage__axis--top {
    top: 25%;
  }

  .noise-stage__axis--middle {
    top: 50%;
  }

  .noise-stage__axis--bottom {
    top: 75%;
  }

  .noise-stage__grain {
    inset-block: 0;
    opacity: 0.35;
    background-size: 17px 13px, 29px 23px;
  }

  .noise-stage__grain--one {
    background-image:
      radial-gradient(circle, rgb(24 52 59 / 0.34) 0 1px, transparent 1.25px),
      radial-gradient(circle, rgb(24 52 59 / 0.18) 0 1px, transparent 1.25px);
    background-position: 0 0, 8px 5px;
  }

  .noise-stage__grain--two {
    opacity: 0.22;
    background-image: repeating-linear-gradient(
      173deg,
      transparent 0 6px,
      rgb(24 52 59 / 0.3) 7px,
      transparent 8px 15px
    );
  }

  .noise-stage__grain--three {
    opacity: 0.16;
    background-image: repeating-linear-gradient(
      8deg,
      transparent 0 10px,
      rgb(24 52 59 / 0.26) 11px,
      transparent 12px 22px
    );
  }

  .noise-stage__cursor {
    top: 0;
    bottom: 0;
    left: 50%;
    right: auto;
    width: 1px;
    background: var(--sonic-current);
    opacity: 0.48;
  }

  [data-noise-kind="pink"] .noise-stage__grain--one {
    opacity: 0.26;
  }

  [data-noise-kind="brown"] .noise-stage__grain--one {
    opacity: 0.2;
  }

  [data-noise-kind="brown"] .noise-stage__grain--two {
    opacity: 0.13;
  }

  [data-noise-visual="playing"] .noise-stage__grain--one {
    animation: noise-drift-one 1.8s steps(6, end) infinite;
  }

  [data-noise-visual="playing"] .noise-stage__grain--two {
    animation: noise-drift-two 2.6s linear infinite alternate;
  }

  @keyframes noise-drift-one {
    from {
      background-position: 0 0, 8px 5px;
    }
    to {
      background-position: 17px 13px, -21px 28px;
    }
  }

  @keyframes noise-drift-two {
    from {
      transform: translateX(-5px);
    }
    to {
      transform: translateX(5px);
    }
  }

  .noise-field__note {
    text-align: center;
  }

  .noise-rail {
    display: grid;
    grid-template-columns: minmax(250px, 0.95fr) minmax(310px, 1.1fr) minmax(290px, 1fr);
    min-height: 184px;
    border-bottom: 1px solid var(--sonic-border-soft);
  }

  .noise-rail > div {
    min-width: 0;
    padding: 11px 13px;
  }

  .noise-rail > div + div {
    border-left: 1px solid var(--sonic-border-soft);
  }

  .noise-kinds,
  .noise-timer,
  .noise-output {
    display: grid;
    align-content: center;
    gap: 7px;
  }

  .noise-selector {
    display: grid;
    gap: 5px;
  }

  .noise-selector--kinds {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .noise-selector--timer {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .noise-selector button,
  .noise-play,
  .noise-stop {
    min-height: 44px;
    border: 1px solid var(--sonic-border);
    border-radius: var(--sonic-control-radius);
    background: transparent;
    color: var(--sonic-ink);
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  .noise-selector button {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding-inline: 7px;
    color: var(--sonic-muted);
    font-size: 0.76rem;
  }

  .noise-selector button[aria-pressed="true"] {
    border-color: var(--sonic-signal);
    background: rgb(39 127 138 / 0.08);
    color: #0b6570;
  }

  .noise-dot {
    width: 8px;
    height: 8px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: #687a7d;
  }

  .noise-dot--pink {
    background: #955f69;
  }

  .noise-dot--brown {
    background: #806545;
  }

  .noise-long-reminder-slot {
    min-height: 42px;
  }

  .noise-long-reminder {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 7px 8px;
    border: 1px solid rgb(179 123 31 / 0.24);
    border-radius: var(--sonic-control-radius);
    background: rgb(179 123 31 / 0.07);
    color: var(--sonic-muted);
    font-size: 0.68rem;
    line-height: 1.3;
  }

  .noise-long-reminder[hidden],
  .noise-error[hidden] {
    display: none;
  }

  .noise-output :global(.level-control) {
    gap: 5px;
  }

  .noise-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(94px, 0.45fr);
    gap: 6px;
  }

  .noise-play,
  .noise-stop {
    min-height: 48px;
  }

  .noise-play {
    border-color: var(--sonic-ink);
    background: var(--sonic-ink);
    color: var(--sonic-sheet);
  }

  .transport-stop-shape {
    display: inline-block;
    width: 9px;
    height: 9px;
    margin-right: 7px;
    border-radius: 1px;
    background: currentColor;
  }

  .noise-state-strip {
    display: grid;
    grid-template-columns: 106px minmax(0, 1fr);
    gap: 12px;
    padding: 8px 18px;
    color: var(--sonic-muted);
  }

  .noise-state-strip strong {
    color: var(--sonic-ink);
    font-size: 0.72rem;
  }

  .noise-state-strip div {
    display: grid;
    gap: 2px;
  }

  .noise-state-strip p,
  .noise-state-strip small {
    margin: 0;
    font-size: 0.69rem;
    line-height: 1.35;
  }

  .noise-feedback-slot:empty {
    display: none;
  }

  .noise-error {
    margin: 8px 18px;
    padding: 9px 11px;
    border: 1px solid rgb(149 80 59 / 0.28);
    border-radius: var(--sonic-control-radius);
    background: rgb(149 80 59 / 0.07);
    color: #773927;
    font-size: 0.76rem;
  }

  button:disabled,
  input:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  @media (min-width: 901px) and (max-height: 820px) {
    .noise-bar {
      min-height: 48px;
      padding-block: 6px;
    }

    .noise-field {
      grid-template-rows: auto 72px auto;
      min-height: 0;
      gap: 4px;
      padding: 8px 16px 6px;
    }

    .noise-stage {
      height: 58px;
    }

    .noise-rail {
      min-height: 166px;
    }

    .noise-rail > div {
      padding-block: 7px;
    }

    .noise-state-strip {
      padding-block: 6px;
    }
  }

  @media (max-width: 900px) {
    .noise-field {
      min-height: 210px;
    }

    .noise-rail {
      grid-template-columns: 1fr 1fr;
    }

    .noise-output {
      grid-column: 1 / -1;
      border-top: 1px solid var(--sonic-border-soft);
      border-left: 0 !important;
    }
  }

  @media (max-width: 560px) {
    .noise-bar {
      align-items: flex-start;
      padding: 8px 12px;
    }

    .noise-readout {
      grid-template-columns: 1fr;
      justify-items: end;
      gap: 1px;
    }

    .noise-readout > span,
    .noise-field__heading p {
      display: none;
    }

    .noise-field {
      grid-template-rows: auto 74px auto;
      min-height: 0;
      padding: 9px 12px 7px;
    }

    .noise-stage {
      height: 54px;
    }

    .noise-field__note {
      text-align: left;
    }

    .noise-rail {
      grid-template-columns: 1fr;
    }

    .noise-rail > div {
      padding: 9px 11px;
    }

    .noise-rail > div + div {
      border-top: 1px solid var(--sonic-border-soft);
      border-left: 0;
    }

    .noise-output {
      grid-column: auto;
    }

    .noise-selector button {
      padding-inline: 4px;
      font-size: 0.72rem;
    }

    .noise-long-reminder-slot {
      min-height: 44px;
    }

    .noise-state-strip {
      grid-template-columns: 1fr;
      gap: 4px;
      padding: 8px 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [data-noise-visual="playing"] .noise-stage__grain--one,
    [data-noise-visual="playing"] .noise-stage__grain--two {
      animation: none;
    }
  }
</style>
'''

sound = r'''---
import ToolStatus from "../../components/feedback/ToolStatus.astro";
import SonicInstrument from "../../components/layout/SonicInstrument.astro";
---

<div data-sound-test data-active-channel="none">
  <SonicInstrument label="Sound Test output controls" class="sound-sheet">
    <div class="sound-bar">
      <ToolStatus id="sound-status" label="Ready" state="idle" />
      <div class="sound-readout" aria-label="Generated channel reference">
        <span>Reference burst</span>
        <strong>500 Hz</strong>
        <small>700 ms sine</small>
      </div>
    </div>

    <section class="sound-field" aria-label="Stereo channel activity">
      <div class="sound-field__heading">
        <div>
          <span>Digital channel target</span>
          <strong>Hard-routed stereo reference</strong>
        </div>
        <p>Left · Both · Right</p>
      </div>

      <div class="sound-stage" aria-hidden="true">
        <div class="sound-node sound-node--left">
          <span class="sound-node__ring"></span>
          <strong>L</strong>
          <small>Left</small>
        </div>
        <div class="sound-stage__path">
          <span></span>
          <i class="ph ph-wave-sine"></i>
          <span></span>
        </div>
        <div class="sound-node sound-node--right">
          <span class="sound-node__ring"></span>
          <strong>R</strong>
          <small>Right</small>
        </div>
      </div>

      <p class="sound-field__note">
        Active channel: <strong data-active-channel-label>None</strong>. This is
        the requested digital route; the browser cannot verify physical speaker
        output.
      </p>
    </section>

    <section class="sound-rail" aria-label="Sound Test actions">
      <div class="sound-channels">
        <span class="sound-rail__label">Single burst</span>
        <div class="channel-actions">
          <button type="button" data-sound-channel="left">
            <i class="ph ph-speaker-simple-low" aria-hidden="true"></i>
            Left
          </button>
          <button type="button" data-sound-channel="both">
            <i class="ph ph-speaker-high" aria-hidden="true"></i>
            Both
          </button>
          <button type="button" data-sound-channel="right">
            <i class="ph ph-speaker-simple-high" aria-hidden="true"></i>
            Right
          </button>
        </div>
      </div>

      <div class="sound-sequence">
        <span class="sound-rail__label">Guided sequence</span>
        <div class="sound-sequence__copy">
          <strong>Left → Both → Right</strong>
          <small>700 ms burst · 300 ms gap</small>
        </div>
        <button type="button" class="sequence-button" data-sound-sequence>
          <i class="ph ph-play" aria-hidden="true"></i>
          Run sequence
        </button>
      </div>

      <div class="sound-output">
        <span class="sound-rail__label">Transport</span>
        <div class="sound-output__reference">
          <strong>Same source</strong>
          <small>500 Hz in every channel step</small>
        </div>
        <button type="button" class="stop-button" data-sound-stop disabled>
          <span class="transport-stop-shape" aria-hidden="true"></span>
          Stop
        </button>
      </div>
    </section>

    <div class="sound-state-strip sound-safety">
      <strong>Low volume</strong>
      <div>
        <p>
          Start with your device/headphone volume low. Increase it only to a
          comfortable listening level. Do not turn the volume up to compensate
          for a tone you cannot hear.
        </p>
        <small>
          Use your ears to confirm the expected channel; Browser Audio Lab does
          not detect which physical speaker produced sound.
        </small>
      </div>
    </div>

    <div class="sound-feedback-slot">
      <p class="sound-error" data-sound-error role="alert" hidden></p>
    </div>
  </SonicInstrument>
</div>

<script>
  import { SoundTestController } from "./SoundTestController";

  const root = document.querySelector<HTMLElement>("[data-sound-test]");
  let controller: SoundTestController | null = null;

  const mount = () => {
    if (!root || controller) return;
    controller = new SoundTestController(root);
  };

  const teardown = () => {
    const current = controller;
    controller = null;
    if (current) void current.dispose();
  };

  window.addEventListener("pagehide", teardown);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) mount();
  });

  mount();
</script>

<style>
  .sound-bar {
    display: flex;
    min-height: 54px;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 8px 18px;
    border-bottom: 1px solid var(--sonic-border-soft);
  }

  .sound-readout {
    display: grid;
    grid-template-columns: auto auto;
    align-items: baseline;
    gap: 1px 10px;
    text-align: right;
  }

  .sound-readout > span,
  .sound-field__heading span,
  .sound-rail__label {
    color: var(--sonic-muted);
    font-size: 0.67rem;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .sound-readout > span {
    grid-row: 1 / 3;
    align-self: center;
  }

  .sound-readout strong {
    font-size: 1.12rem;
    line-height: 1;
  }

  .sound-readout small {
    color: var(--sonic-muted);
    font-size: 0.68rem;
  }

  .sound-field {
    display: grid;
    grid-template-rows: auto minmax(116px, 1fr) auto;
    gap: 7px;
    min-height: 224px;
    padding: 14px 20px 10px;
    border-bottom: 1px solid var(--sonic-border);
    background: var(--sonic-field);
  }

  .sound-field__heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 18px;
  }

  .sound-field__heading > div {
    display: grid;
    gap: 2px;
  }

  .sound-field__heading strong {
    font-size: 0.88rem;
  }

  .sound-field__heading p,
  .sound-field__note {
    margin: 0;
    color: var(--sonic-muted);
    font-size: 0.7rem;
    line-height: 1.35;
  }

  .sound-stage {
    display: grid;
    grid-template-columns: minmax(96px, 150px) minmax(120px, 1fr) minmax(96px, 150px);
    align-items: center;
    gap: clamp(18px, 4vw, 44px);
    width: min(100%, 760px);
    margin-inline: auto;
  }

  .sound-node {
    position: relative;
    display: grid;
    min-height: 96px;
    place-items: center;
    align-content: center;
    gap: 1px;
    border: 1px solid var(--sonic-border);
    border-radius: 8px;
    background: rgb(243 240 232 / 0.58);
    color: var(--sonic-muted);
    transition:
      border-color 150ms ease,
      color 150ms ease,
      box-shadow 150ms ease;
  }

  .sound-node strong {
    position: relative;
    z-index: 2;
    font-size: clamp(1.45rem, 3vw, 2.3rem);
    line-height: 1;
  }

  .sound-node small {
    position: relative;
    z-index: 2;
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .sound-node__ring {
    position: absolute;
    width: 52px;
    height: 52px;
    border: 7px solid currentColor;
    border-radius: 50%;
    opacity: 0.09;
  }

  .sound-stage__path {
    display: grid;
    grid-template-columns: 1fr 40px 1fr;
    align-items: center;
    color: var(--sonic-signal);
  }

  .sound-stage__path span {
    height: 1px;
    background: var(--sonic-border);
  }

  .sound-stage__path i {
    display: grid;
    width: 40px;
    height: 40px;
    place-items: center;
    border: 1px solid var(--sonic-border);
    border-radius: 50%;
    background: var(--sonic-sheet);
  }

  [data-active-channel="left"] .sound-node--left,
  [data-active-channel="both"] .sound-node--left,
  [data-active-channel="right"] .sound-node--right,
  [data-active-channel="both"] .sound-node--right {
    border-color: var(--sonic-signal);
    color: #0b6570;
    box-shadow: 0 0 0 1px rgb(39 127 138 / 0.12);
  }

  [data-active-channel="left"] .sound-node--left .sound-node__ring,
  [data-active-channel="both"] .sound-node--left .sound-node__ring,
  [data-active-channel="right"] .sound-node--right .sound-node__ring,
  [data-active-channel="both"] .sound-node--right .sound-node__ring {
    opacity: 0.28;
  }

  .sound-field__note {
    text-align: center;
  }

  .sound-field__note strong {
    color: var(--sonic-ink);
  }

  .sound-rail {
    display: grid;
    grid-template-columns: minmax(300px, 1.15fr) minmax(300px, 1fr) minmax(220px, 0.72fr);
    min-height: 160px;
    border-bottom: 1px solid var(--sonic-border-soft);
  }

  .sound-rail > div {
    min-width: 0;
    padding: 11px 13px;
  }

  .sound-rail > div + div {
    border-left: 1px solid var(--sonic-border-soft);
  }

  .sound-channels,
  .sound-sequence,
  .sound-output {
    display: grid;
    align-content: center;
    gap: 7px;
  }

  .channel-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 5px;
  }

  .channel-actions button,
  .sequence-button,
  .stop-button {
    min-height: 44px;
    border: 1px solid var(--sonic-border);
    border-radius: var(--sonic-control-radius);
    background: transparent;
    color: var(--sonic-ink);
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  .channel-actions button {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding-inline: 7px;
  }

  .sequence-button,
  .stop-button {
    min-height: 48px;
  }

  .sequence-button {
    border-color: var(--sonic-ink);
    background: var(--sonic-ink);
    color: var(--sonic-sheet);
  }

  .sound-sequence__copy,
  .sound-output__reference {
    display: grid;
    gap: 2px;
  }

  .sound-sequence__copy strong,
  .sound-output__reference strong {
    font-size: 0.78rem;
  }

  .sound-sequence__copy small,
  .sound-output__reference small {
    color: var(--sonic-muted);
    font-size: 0.68rem;
    line-height: 1.3;
  }

  .transport-stop-shape {
    display: inline-block;
    width: 9px;
    height: 9px;
    margin-right: 7px;
    border-radius: 1px;
    background: currentColor;
  }

  .sound-state-strip {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr);
    gap: 12px;
    padding: 8px 18px;
    color: var(--sonic-muted);
  }

  .sound-state-strip strong {
    color: var(--sonic-ink);
    font-size: 0.72rem;
  }

  .sound-state-strip div {
    display: grid;
    gap: 2px;
  }

  .sound-state-strip p,
  .sound-state-strip small {
    margin: 0;
    font-size: 0.69rem;
    line-height: 1.35;
  }

  .sound-feedback-slot:empty {
    display: none;
  }

  .sound-error {
    margin: 8px 18px;
    padding: 9px 11px;
    border: 1px solid rgb(149 80 59 / 0.28);
    border-radius: var(--sonic-control-radius);
    background: rgb(149 80 59 / 0.07);
    color: #773927;
    font-size: 0.76rem;
  }

  .sound-error[hidden] {
    display: none;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  @media (min-width: 901px) and (max-height: 820px) {
    .sound-bar {
      min-height: 48px;
      padding-block: 6px;
    }

    .sound-field {
      grid-template-rows: auto 86px auto;
      min-height: 0;
      gap: 4px;
      padding: 8px 16px 6px;
    }

    .sound-node {
      min-height: 72px;
    }

    .sound-node__ring {
      width: 42px;
      height: 42px;
      border-width: 6px;
    }

    .sound-rail {
      min-height: 142px;
    }

    .sound-rail > div {
      padding-block: 7px;
    }

    .sound-state-strip {
      padding-block: 6px;
    }
  }

  @media (max-width: 900px) {
    .sound-field {
      min-height: 220px;
    }

    .sound-rail {
      grid-template-columns: 1fr 1fr;
    }

    .sound-output {
      grid-column: 1 / -1;
      border-top: 1px solid var(--sonic-border-soft);
      border-left: 0 !important;
    }
  }

  @media (max-width: 560px) {
    .sound-bar {
      align-items: flex-start;
      padding: 8px 12px;
    }

    .sound-readout {
      grid-template-columns: 1fr;
      justify-items: end;
      gap: 1px;
    }

    .sound-readout > span,
    .sound-field__heading p {
      display: none;
    }

    .sound-field {
      grid-template-rows: auto 82px auto;
      min-height: 0;
      padding: 9px 12px 7px;
    }

    .sound-stage {
      grid-template-columns: 74px minmax(70px, 1fr) 74px;
      gap: 8px;
    }

    .sound-node {
      min-height: 68px;
    }

    .sound-node__ring {
      width: 38px;
      height: 38px;
      border-width: 5px;
    }

    .sound-stage__path {
      grid-template-columns: 1fr 30px 1fr;
    }

    .sound-stage__path i {
      width: 30px;
      height: 30px;
    }

    .sound-field__note {
      text-align: left;
    }

    .sound-rail {
      grid-template-columns: 1fr;
    }

    .sound-rail > div {
      padding: 9px 11px;
    }

    .sound-rail > div + div {
      border-top: 1px solid var(--sonic-border-soft);
      border-left: 0;
    }

    .sound-output {
      grid-column: auto;
    }

    .channel-actions button {
      padding-inline: 4px;
      font-size: 0.74rem;
    }

    .sound-state-strip {
      grid-template-columns: 1fr;
      gap: 4px;
      padding: 8px 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sound-node {
      transition: none;
    }
  }
</style>
'''

layout_spec = r'''import { expect, test, type Page } from "@playwright/test";

const primaryDesktopViewports = [
  { width: 1_366, height: 768, bottomAir: 24 },
  { width: 1_440, height: 900, bottomAir: 24 },
] as const;

const compactDesktopViewport = {
  width: 1_280,
  height: 720,
  bottomAir: 16,
} as const;

const mobileViewports = [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
] as const;

type GeneratedRoute =
  | "/tone-generator"
  | "/frequency-sweep"
  | "/bass-test"
  | "/noise-generator"
  | "/sound-test";

async function installGeneratedSignalAudioContext(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class FakeParam {
      value = 1;
      cancelAndHoldAtTime() {
        return this;
      }
      cancelScheduledValues() {
        return this;
      }
      setValueAtTime(value: number) {
        this.value = value;
        return this;
      }
      linearRampToValueAtTime(value: number) {
        this.value = value;
        return this;
      }
      exponentialRampToValueAtTime(value: number) {
        this.value = value;
        return this;
      }
    }

    class FakeNode {
      connect(destination: unknown) {
        return destination;
      }
      disconnect() {}
    }

    class FakeGain extends FakeNode {
      gain = new FakeParam();
    }

    class FakeOscillator extends FakeNode {
      frequency = new FakeParam();
      type = "sine";
      start() {}
      stop() {}
      addEventListener() {}
    }

    class FakeAudioBuffer {
      readonly channel: Float32Array;
      constructor(
        readonly numberOfChannels: number,
        readonly length: number,
        readonly sampleRate: number,
      ) {
        this.channel = new Float32Array(length);
      }
      getChannelData() {
        return this.channel;
      }
    }

    class FakeBufferSource extends FakeNode {
      buffer: AudioBuffer | null = null;
      loop = false;
      start() {}
      stop() {}
      addEventListener() {}
    }

    class FakeAudioContext {
      currentTime = 10;
      sampleRate = 48_000;
      state = "suspended";
      destination = new FakeNode();
      async resume() {
        this.state = "running";
      }
      async close() {
        this.state = "closed";
      }
      createGain() {
        return new FakeGain();
      }
      createOscillator() {
        return new FakeOscillator();
      }
      createChannelMerger() {
        return new FakeNode();
      }
      createBuffer(
        numberOfChannels: number,
        length: number,
        sampleRate: number,
      ) {
        return new FakeAudioBuffer(numberOfChannels, length, sampleRate);
      }
      createBufferSource() {
        return new FakeBufferSource();
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: FakeAudioContext,
    });
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
}

async function openActiveState(
  page: Page,
  route: GeneratedRoute,
): Promise<void> {
  await installGeneratedSignalAudioContext(page);
  await page.goto(route);

  switch (route) {
    case "/tone-generator":
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page.locator("#tone-status")).toContainText("Playing");
      return;
    case "/frequency-sweep":
      await page.getByRole("button", { name: "Play sweep", exact: true }).click();
      await expect(page.locator("#frequency-sweep-status")).toHaveAttribute(
        "data-state",
        "playing",
      );
      return;
    case "/bass-test":
      await page.locator('[data-bass-mode="sweep"]').click();
      await page.locator("[data-bass-sweep-play]").click();
      await expect(page.locator("#bass-status")).toContainText(
        "Slow bass sweep running",
      );
      return;
    case "/noise-generator":
      await page.locator("[data-noise-play]").click();
      await expect(page.locator("#noise-generator-status")).toContainText(
        "White noise",
      );
      return;
    case "/sound-test":
      await page.locator('[data-sound-channel="left"]').click();
      await expect(page.locator("#sound-status")).toContainText("Playing Left");
      return;
  }
}

async function expectDesktopSheetFits(
  page: Page,
  viewport: { width: number; height: number; bottomAir: number },
): Promise<void> {
  const sheet = page.locator("[data-sonic-instrument]");
  await expect(sheet).toBeVisible();
  const bounds = await sheet.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
    };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(
    viewport.height - viewport.bottomAir,
  );
  await expectNoHorizontalOverflow(page);
}

function fieldSelector(route: GeneratedRoute): string {
  switch (route) {
    case "/tone-generator":
      return ".tone-field";
    case "/frequency-sweep":
      return ".sweep-field";
    case "/bass-test":
      return ".bass-field";
    case "/noise-generator":
      return ".noise-field";
    case "/sound-test":
      return ".sound-field";
  }
}

function actionSelector(route: GeneratedRoute): string {
  switch (route) {
    case "/tone-generator":
      return "#tone-play-stop";
    case "/frequency-sweep":
      return "[data-sweep-stop]";
    case "/bass-test":
      return "[data-bass-sweep-play]";
    case "/noise-generator":
      return "[data-noise-play]";
    case "/sound-test":
      return '[data-sound-channel="left"]';
  }
}

const routes: GeneratedRoute[] = [
  "/tone-generator",
  "/frequency-sweep",
  "/bass-test",
  "/noise-generator",
  "/sound-test",
];

for (const viewport of [...primaryDesktopViewports, compactDesktopViewport]) {
  for (const route of routes) {
    test(`${route} active state fits ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openActiveState(page, route);
      await expectDesktopSheetFits(page, viewport);
    });
  }
}

for (const viewport of mobileViewports) {
  for (const route of routes) {
    test(`${route} active state has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openActiveState(page, route);
      await expectNoHorizontalOverflow(page);

      const field = page.locator(fieldSelector(route));
      const action = page.locator(actionSelector(route));
      const fieldBox = await field.boundingBox();
      const actionBox = await action.boundingBox();
      expect(fieldBox).not.toBeNull();
      expect(actionBox).not.toBeNull();
      if (fieldBox && actionBox) {
        expect(actionBox.y).toBeGreaterThan(fieldBox.y);
      }
    });
  }
}

test("Sound Test active channel styling keeps speaker anchors fixed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1_366, height: 768 });
  await installGeneratedSignalAudioContext(page);
  await page.goto("/sound-test");

  const before = await page.locator(".sound-node").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  );
  await page.locator('[data-sound-channel="left"]').click();
  await expect(page.locator("[data-sound-test]")).toHaveAttribute(
    "data-active-channel",
    "left",
  );
  const after = await page.locator(".sound-node").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  );
  expect(after).toEqual(before);
});
'''

Path("src/tools/noise-generator/NoiseGenerator.astro").write_text(noise)
Path("src/tools/sound-test/SoundTest.astro").write_text(sound)
Path("tests/browser/sonic-field-generated-signal-production-layout.spec.ts").write_text(
    layout_spec
)

# Extend permanent 44px guards for generated-signal transport controls while
# preserving existing selectors and unrelated contracts.
touch_path = Path("tests/browser/tool-touch-targets.spec.ts")
touch = touch_path.read_text()
touch = touch.replace(
    '{ path: "/noise-generator", selectors: [".noise-selector button"] },',
    '{\n    path: "/noise-generator",\n    selectors: [".noise-selector button", ".noise-play", ".noise-stop"],\n  },\n  {\n    path: "/sound-test",\n    selectors: [".channel-actions button", ".sequence-button", ".stop-button"],\n  },',
)
touch_path.write_text(touch)
