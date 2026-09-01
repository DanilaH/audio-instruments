# Sonic Field Spatial Output — Cold Implementation Review #1

**Date:** 2026-09-02  
**PR:** #80 — `feat: migrate Sonic Field spatial output family`  
**Branch:** `feat/sonic-field-spatial-output-family`

## Review posture

Reviewed the PR2 spatial-output migration as external code against the accepted Sonic Field production rules and the existing audio behavior contracts.

Scope reviewed:

- Speaker Test;
- Stereo Test;
- Surround Sound Test;
- Phase Test;
- permanent layout/perceptual regression coverage required by those migrations.

Review focused on:

- controller/audio topology preservation;
- spatial controls matching the actions they visually represent;
- stable mode/capability/action geometry;
- truthful routing and measurement language;
- keyboard/touch semantics;
- reduced-motion behavior;
- desktop bottom-air contracts and mobile overflow behavior;
- temporary QA residue and scope creep.

## Browser evidence before the review

The final four-tool acceptance pass before cold review covered all four routes in Chromium, Firefox and WebKit:

- 1366×768 and 1440×900 with at least 24px bottom air;
- 1280×720 compact stress with at least 16px bottom air;
- 320×844 and 390×844 with no horizontal overflow.

The cross-engine acceptance matrix passed 60/60 cases after one real compact-layout defect was found and fixed in Surround Sound Test. The fix reduced only reserved compact field/stage space; the 16px gate and control sizes were not weakened.

Chromium perceptual QA then captured and visually inspected 16 representative screenshots across Speaker, Stereo, Surround and Phase. No remaining overlap, clipping or spatial-composition blocker was found.

## Findings

### F1 — Speaker spatial channel targets remained actionable-looking outside Channel mode

**Severity:** medium  
**Status:** fixed

PR2 moved Left / Both / Right from a dedicated Channel panel into the always-visible spatial field. The controller still accepted those actions only while `mode === "channel"`, so in Phase / Sweep / Bass the buttons looked actionable but clicks were silently ignored.

**Resolution:** `SpeakerTestController` now disables the three channel targets whenever the active mode is not Channel, while preserving their fixed spatial positions. A permanent browser regression test verifies:

- all three targets are enabled in Channel;
- all three are disabled in Phase, Sweep and Bass / rattle;
- returning to Channel re-enables them.

### F2 — Stereo neutral marker position was exposed as a selected Center playback action

**Severity:** medium  
**Status:** fixed

The visual marker intentionally rests at center when Stereo is idle. The first `aria-pressed` synchronization treated that neutral geometry as the actual `Center` playback command, so the UI could say `Digital target: None` while accessibility state reported Center as selected.

**Resolution:** the controller now distinguishes neutral visual center from the `center` playback action. Idle, Stop, errors and ordinary completion render the marker at center with no pressed playback action. The natural pan-return state also clears pressed actions before the 240ms visual return. A permanent regression test verifies neutral center + `None` + zero pressed actions.

## Targeted remediation validation

After F1/F2 remediation:

- production build: green;
- Speaker behavior + layout suites: green in Chromium, Firefox and WebKit;
- Stereo behavior + layout suites: green in Chromium, Firefox and WebKit;
- updated perceptual screenshots for Speaker Bass and Stereo idle: green at 1280×720 and 390×844 and visually inspected.

The screenshot re-check confirmed that disabled Speaker targets are visually legible without looking active, and that Stereo can remain geometrically centered without implying an active Center playback selection.

## Reviewed non-findings / accepted risks

### Audio topology remains intact

The migration does not replace the Speaker, Stereo, Surround or Phase audio engines for visual convenience. Controller changes are limited to presentation-state synchronization and Stereo's post-pan visual return.

### Routing claims remain bounded

Surround continues to distinguish requested digital routing from physical speaker verification. Experimental eight-channel output is not presented as universal 7.1.

### No synthetic measurements were introduced

The spatial fields are interaction/relationship representations. They do not claim measured acoustic position, physical wiring, level or frequency response.

### Reduced motion remains respected

Stereo's natural return becomes immediate under `prefers-reduced-motion: reduce`; Phase/Speaker visual transitions do not require motion to communicate state.

## Review #1 verdict

**APPROVED AFTER F1/F2 FIXES AND TARGETED CROSS-ENGINE VALIDATION.**

Next gate: perform a fresh Cold Implementation Review #2 from the cleaned final diff, including shared accessibility regression coverage, before authorizing full CI.
