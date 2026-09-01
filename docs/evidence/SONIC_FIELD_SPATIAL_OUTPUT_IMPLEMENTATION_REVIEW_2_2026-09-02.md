# Sonic Field Spatial Output — Cold Implementation Review #2

**Date:** 2026-09-02  
**PR:** #80 — `feat: migrate Sonic Field spatial output family`  
**Branch:** `feat/sonic-field-spatial-output-family`

## Method

Fresh pass over the PR after Review #1 remediation and removal of temporary implementation, screenshot and review harnesses.

Reviewed specifically for:

- scope creep beyond Speaker / Stereo / Surround / Phase;
- controller or audio-service rewrites hidden inside visual migration;
- stale selectors and tests that no longer cover the migrated controls;
- weakened desktop/mobile geometry gates;
- touch-target and pressed/disabled-state regressions;
- misleading measurement or physical-routing claims;
- reduced-motion regressions;
- implementation-detail checks replacing user-facing invariants;
- temporary QA residue.

## Evidence considered

- four-tool strict viewport acceptance: 60/60 across Chromium, Firefox and WebKit;
- representative Chromium screenshot QA across 16 route/viewport states: green and visually inspected;
- Review #1 Speaker/Stereo remediation behavior + layout suites: green across Chromium, Firefox and WebKit;
- Review #1 perceptual re-check at 1280×720 and 390×844: green and visually inspected;
- final PR contains permanent product-level regression tests for the issues found during hardening.

## Finding

### F1 — Shared touch-target regression test still referenced legacy Speaker structure and omitted the new spatial controls

**Severity:** medium  
**Status:** fixed

`tests/browser/tool-touch-targets.spec.ts` still used the legacy Speaker selector `.speaker-field input`. The PR2 migration moved sweep inputs into `.speaker-field-input` and introduced direct spatial controls across all four migrated output tools. Leaving the old selector would both fail full CI for the wrong structural reason and leave the newly introduced buttons outside the common 44px accessibility contract.

**Resolution:** updated the permanent shared touch-target cases to cover the real PR2 controls:

- Speaker: spatial channel nodes, mode buttons, panel actions, sweep inputs and Stop;
- Stereo: direct Left / Center / Right targets, pan actions and Stop;
- Surround: spatial channel nodes, mode selector, primary actions, pan actions and Stop;
- Phase: mode/utility action buttons.

The assertion floor remains 44px. No tolerance or threshold was reduced.

## Validation of F1

A dedicated temporary cross-engine review workflow ran:

- `tests/browser/tool-touch-targets.spec.ts`;
- `tests/browser/sonic-field-spatial-output-production-layout.spec.ts`;
- `tests/browser/speaker-layout.spec.ts`;
- `tests/browser/stereo-phase-layout.spec.ts`;
- `tests/browser/surround-layout.spec.ts`;

in Chromium, Firefox and WebKit after a clean production build. The full targeted review job passed.

The temporary workflow was then removed from the PR.

## Explicit checks

### Scope

Production changes remain limited to Speaker Test, Stereo Test, Surround Sound Test and Phase Test. The shared touch-target spec changes only to keep the existing accessibility contract aligned with those migrated controls.

### Behavior / controller contracts

Speaker audio behavior is unchanged; new controller logic only makes always-visible spatial channel controls accurately reflect whether Channel mode can accept them. Stereo preserves the existing static/pan audio operations; the new timer is a 240ms post-playback visual return and does not extend audio playback.

### Layout contracts

Desktop thresholds remain unchanged:

- 1366×768: at least 24px bottom air;
- 1440×900: at least 24px bottom air;
- 1280×720: at least 16px bottom air.

Mobile remains a no-horizontal-overflow contract at 320×844 and 390×844; it is not forced into artificial one-screen fit.

### Accessibility / semantics

New direct controls are native buttons. Speaker channel targets now communicate unavailable modes through `disabled`. Stereo's neutral center no longer emits a false pressed selection. The shared 44px touch-target test now covers all four migrated tool families.

### Data and routing honesty

No fake measurement values were added. Surround explicitly describes channel nodes as requested digital routing targets and keeps physical placement/wiring outside its claims. Stereo/Phase visual fields are relationship cues rather than measurement displays.

### Repository hygiene

Temporary implementation, cross-engine, screenshot, cold-review and touch-review workflow/spec files have been removed. Only production code, permanent regression tests and review evidence remain.

## Review #2 verdict

**APPROVED FOR AUTHORIZED FULL CI.**

Next gate:

1. mark PR #80 Ready for review;
2. add `full-ci-approved`;
3. require full-validation success across formatting, lint, Astro/TypeScript, unit/service tests, indexing and the complete Chromium/Firefox/WebKit browser suite;
4. require merge-gate success;
5. squash merge only if the final head remains unchanged and all required checks are green.
