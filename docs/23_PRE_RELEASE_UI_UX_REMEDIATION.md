# 23 — Pre-release UI/UX Remediation

Status: **implementation required before production rollout**

Baseline audited: `main@504c1722169943f2d806666427f2a965aadc20eb`

Source evidence: independent Chromium pre-release audit performed on 2026-09-03 across all 16 public tool routes at `1366×768`, `1280×720`, `390×844`, and `320×844`, plus representative mode/settings transitions.

## Purpose

Close the concrete UI/UX defects and low-value implementation-facing surface found by the pre-release audit without reopening the Sonic Field visual system or broadening product scope.

This is a **focused remediation pass**, not a redesign.

## Audit baseline

The audit established the following baseline facts:

- all 16 public tool routes rendered;
- 64 default layout snapshots were captured across four target viewports;
- 80 representative state/settings transitions were exercised;
- no horizontal overflow was observed in captured default or transition states;
- no page/console runtime errors were recorded in the focused capture;
- most tested mode/settings transitions kept document/instrument geometry stable;
- one material state-dependent geometry defect was confirmed in Bass Test;
- one deterministic visual overlap was confirmed in Pitch Detector;
- several tools expose avoidable empty reserved space or implementation-facing copy in the primary task surface.

These findings do not replace real-device audio validation. They concern browser UI rendering, interaction geometry, information hierarchy, copy, and runtime smoke only.

## Scope boundaries

### In scope

1. Pitch Detector default-state overlap.
2. Bass Test desktop mode-switch layout shift.
3. Surround Sound Test narrow-mobile idle whitespace and primary API/implementation copy.
4. Spectrum Analyzer narrow-mobile idle reserved gap.
5. Hearing Frequency Test developer-facing reserved-band sentence.
6. Phase / Polarity Test implementation-facing primary copy.
7. Decibel Meter collapsed calibration footprint on desktop.
8. Microphone Test primary permission/processing copy.
9. Noise Generator low-value implementation metadata in the primary visualization heading.
10. Speaker Test low-value `requested digital routing` / implementation wording where it can be simplified without weakening measurement honesty.
11. Targeted browser regressions required to prevent the confirmed Pitch/Bass geometry defects from returning.

### Explicitly out of scope

- new tools or new audio features;
- general Sonic Field redesign;
- homepage redesign;
- new animation/microinteraction systems;
- decorative Rive/grain/texture work;
- changing audio engine semantics to make the UI easier to style;
- weakening measurement-honesty disclosures;
- removing domain-relevant technical controls such as Hz/kHz, dBFS, FFT size, bin width, polarity, calibration status, or latency offset merely because they are technical;
- production domain, DNS, VPS, analytics, GSC, or indexing activation;
- claiming physical/acoustic validation from browser-only evidence.

## Product principle for this pass

Primary tool UI should answer:

1. What am I testing/measuring?
2. What should I do next?
3. What result/state am I looking at?
4. What limitation materially affects interpretation?

Implementation mechanics belong in secondary explanation/details unless the user needs them to operate or correctly interpret the tool.

Do not trade layout stability for giant blank placeholders. Where geometry must remain stable, use the smallest defensible reservation or a useful idle state rather than an unexplained empty block.

---

# Required remediations

## R1 — Pitch Detector: remove deterministic desktop overlap

### Problem

At `1366×768`, the primary result block overlaps/collides with the field heading before microphone permission or live pitch data is involved.

### Required behavior

- `DETECTED NOTE` / note-result content must not intersect the field heading or neighboring result strip at supported desktop viewports.
- Preserve the note-result hierarchy and measurement semantics.
- Do not hide/crop overflowing content as the fix.

### Preferred implementation direction

Resize/reflow the result slot so its intrinsic content fits, or reduce excessive result typography/gaps. Avoid arbitrary viewport-specific offsets.

### Acceptance criteria

- no bounding-box intersection between field heading and primary result block at `1366×768` and `1280×720`;
- no horizontal overflow at `390×844` or `320×844`;
- idle/default state and active result state remain legible;
- controller/audio behavior unchanged.

### Regression evidence

Add a browser geometry assertion covering non-intersection at desktop.

---

## R2 — Bass Test: remove desktop mode-switch layout shift

### Problem

At `1366×768`, switching from `Single tone` to either `Slow sweep` or `Preset sequence` reduces instrument, rail, and document height by approximately 18 px.

### Required behavior

Switching among the three Bass modes must not move content below the instrument on desktop.

### Preferred implementation direction

Reserve the maximum real desktop mode-panel footprint, or otherwise normalize panel geometry. Do not use hidden overflow and do not create a visibly oversized empty region.

### Acceptance criteria

At `1366×768` and `1280×720`:

- `Single tone`, `Slow sweep`, and `Preset sequence` keep document/instrument height within 1 px of one another;
- controls remain vertically balanced;
- no mode content is clipped;
- mobile geometry remains no worse than the audited baseline.

### Regression evidence

Add a browser runtime-layout test that measures all three modes.

---

## R3 — Surround Sound Test: compact mobile idle state and simplify primary copy

### Problem

Before capability negotiation, narrow mobile exposes a large empty reserved action area between capability check and Level. The same primary task surface uses implementation/API language such as `maxChannelCount`, `exact destination readback`, `confirmed browser graph`, and `requested digital routing`.

### Required behavior

- no conspicuous blank block that reads as missing/unfinished UI at `320×844` and `390×844`;
- post-negotiation mode switching remains layout-stable enough that the instrument does not visibly jump;
- primary copy describes the user task and truthful limitation, not browser graph implementation details;
- detailed API/capability explanation may remain in secondary help/details where useful.

### Preferred implementation direction

Keep a stable state slot but compact it on narrow mobile and provide a useful idle state while controls are unavailable. Use overlays/state replacement where appropriate rather than multiple vertically stacked reservations.

### Acceptance criteria

- idle narrow-mobile action area has purposeful visible content or materially reduced footprint;
- capability/mode controls fit without overlap after negotiation;
- no new horizontal overflow;
- existing surround stage geometry/stability regressions remain green;
- no claim is introduced that browser routing proves physical speaker wiring.

---

## R4 — Spectrum Analyzer: compact narrow-mobile idle reservation

### Problem

At `320×844`, hidden pre-capture input-device/selection/error slots produce a visibly empty block between FFT controls and metrics.

### Required behavior

- idle mobile state should not contain a large unexplained gap;
- active input-selection/error states still have sufficient space;
- FFT size, bin width, smoothing, display range, and other domain-relevant analyzer controls remain available.

### Preferred implementation direction

Collapse/overlay hidden state reservations until capture starts, or show one concise useful placeholder rather than blank space.

### Acceptance criteria

- materially smaller or purposeful idle gap at `320×844` and `390×844`;
- view and FFT-size switching keep document/instrument geometry stable within the audited behavior;
- no overflow/clipping in active input/error states.

---

## R5 — Hearing Frequency Test: replace internal layout-engineering sentence

### Problem

Primary UI currently explains that answer controls appear in a `reserved decision band` specifically to avoid moving the instrument.

### Required behavior

Keep the stable decision slot, but make the copy user-facing.

### Acceptance criteria

- no copy mentions a reserved band, layout stability, or implementation intent;
- concise wording tells the user what appears there and when;
- Guided ↔ Manual geometry remains stable.

---

## R6 — Phase / Polarity Test: remove implementation-facing primary copy

### Problem

Primary labels explain internal mechanics such as keeping a deterministic source running, not moving the visual stage, and changing the requested right-channel sign.

### Required behavior

Primary copy should frame the listening comparison while preserving the important distinction between in-phase and inverted polarity.

### Acceptance criteria

- primary task copy uses user-action/result language;
- deterministic-source/sign implementation detail is moved to secondary explanation or removed if redundant;
- no implication that the browser can verify physical speaker wiring;
- playback/controller semantics unchanged.

---

## R7 — Decibel Meter: reduce collapsed calibration footprint

### Problem

On desktop, the collapsed optional Reference calibration disclosure stretches into a large underfilled column.

### Required behavior

The collapsed state should read as an optional compact control, not a large empty panel. Expanded calibration must remain understandable and must preserve the existing `user-calibrated estimate` / non-certified measurement honesty.

### Acceptance criteria

- materially less empty area in collapsed desktop state;
- expanded calibration remains fully accessible and unclipped;
- default capture/result hierarchy remains dominant;
- no claim of true/certified SPL is introduced.

---

## R8 — Microphone Test: simplify primary processing/permission copy

### Problem

The main Start/permission surface exposes detailed browser-processing language including echo cancellation, noise suppression, automatic gain control, and `reported track settings remain authoritative`.

### Required behavior

- keep privacy/trust and meaningful processing limitation visible;
- move diagnostic detail to Capture details / secondary disclosure;
- primary Start flow remains concise.

### Acceptance criteria

- user still understands that processing is reduced only where supported and actual settings can vary;
- detailed track-setting language is not required to scan the primary action surface;
- capture behavior and constraints unchanged.

---

## R9 — Noise Generator: remove low-value implementation metadata from primary heading

### Problem

The primary visualization heading includes fixed implementation metadata such as `44.1 kHz · 8 s loop · mono source to L/R`.

### Required behavior

Keep information needed to choose/use the noise signal; move fixed buffer/sample-rate/routing implementation metadata out of the primary visualization hierarchy unless a specific item materially changes interpretation.

### Acceptance criteria

- noise type/timer controls remain clear;
- no measurement-honesty caveat is lost;
- implementation metadata no longer competes with the main task;
- tested type/timer transitions remain layout-stable.

---

## R10 — Speaker Test: simplify implementation wording

### Problem

Some primary copy uses `requested digital routing` / implementation terminology where user-facing channel language would be clearer.

### Required behavior

Simplify wording without claiming that browser-side routing confirms physical speaker wiring or device mapping.

### Acceptance criteria

- Left / Both / Right task remains immediately understandable;
- physical-output limitation remains explicit where needed;
- implementation jargon is reduced in the primary surface;
- existing mode-switch stability remains intact.

---

# Validation plan

## Targeted implementation checks

During development, use narrow checks for touched tools only. At minimum:

- Pitch desktop non-intersection geometry;
- Bass three-mode geometry equality;
- Surround idle + negotiated states at desktop and narrow mobile;
- Spectrum idle + active/input/error state on narrow mobile;
- Hearing Guided/Manual;
- Phase A/B states;
- Decibel calibration collapsed/expanded;
- Microphone pre-permission/capture-details states;
- Noise type/timer states;
- Speaker L/Both/R + advanced states.

## Required viewport matrix for focused visual review

- `1366×768`
- `1280×720`
- `390×844`
- `320×844`

## Required final regression expectations

- no horizontal overflow on touched tools;
- no new runtime console/page errors in focused browser smoke;
- no new material document/instrument height changes when switching tested modes/settings;
- touch targets remain at least 44 px where the existing product contract requires it;
- technical disclosures remain measurement-honest;
- no audio controller/service semantics are changed solely for presentation.

## Full repository gate

Only after Cold Review #2 approves the final diff:

1. apply `full-ci-approved`;
2. mark PR Ready;
3. run authoritative Full Validation per `15_DEVELOPMENT_WORKFLOW.md` / `16_CI_AND_REPOSITORY_GATES.md`;
4. require `full-validation` and `merge-gate` green before merge.

---

# Definition of done

This remediation unit is complete only when:

- R1–R10 are implemented or a cold review records a specific evidence-based reason to retain an audited behavior;
- Pitch and Bass dedicated regressions exist and pass;
- focused screenshots/geometry checks show the empty-space remediations actually improved narrow-mobile/desktop composition rather than merely moving the blank area elsewhere;
- primary copy no longer reads like implementation documentation in the audited locations;
- measurement honesty is preserved;
- Cold Review #1 findings are resolved;
- Cold Review #2 approves the updated diff;
- authoritative Full Validation passes;
- merge-gate passes;
- the PR is squash-merged to `main` and exact post-merge `main` SHA is recorded.

After this unit, return to P8 real rollout. Do not open a new visual-polish backlog unless new evidence establishes a release-relevant defect.
