# Sonic Field — Cold Implementation Review #1

**Date:** 2026-09-01  
**PR:** #78 — `feat: establish Sonic Field foundation`  
**Branch:** `feat/sonic-field-foundation-stress-trio`

## Review posture

Reviewed the production migration as if it were external code, against:

- the accepted Sonic Field identity and anti-regression rules;
- the stress-trio controller/audio contracts;
- desktop and mobile viewport budgets;
- accessibility/focus semantics;
- fake-data restrictions;
- staged-rollout boundaries;
- real runtime screenshots rather than generated visual evidence.

## Browser evidence before review

Final runtime validation after the compact Spectrum fix and Headphone perceptual fix:

- Firefox stress-trio layout contracts: green;
- WebKit stress-trio layout contracts: green;
- Chromium runtime screenshot capture: green;
- representative screenshots inspected at 1366×768, 1440×900, 1280×720 and 390×844.

The screenshot pass found one real perceptual defect before the formal review: the Headphone channel hint remained visible under advanced panels because both layers were absolutely positioned. The production CSS now hides the channel hint for Phase / Sweep / Bass without changing controller or audio behavior.

## Findings

### F1 — Missing permanent regression guard for Headphone advanced-panel exclusivity

**Severity:** medium  
**Status:** fixed

The screenshot pass proved that the existing geometry/anchor checks could still be green while two internal layers overlapped. After fixing the visual defect, there was no permanent automated assertion that selecting Phase / Sweep / Bass removes the channel hint from the visible composition.

**Resolution:** added a product-level Playwright invariant to `tests/browser/sonic-field-production-layout.spec.ts`:

- channel hint is visible in the normal channel state;
- after selecting each advanced mode, channel hint is hidden;
- the matching advanced panel is visible.

This guards the exact perceptual failure without coupling the test to obsolete layout classes.

## Reviewed non-findings / accepted risks

### Shared components do not half-migrate legacy tools

`LevelControl`, `ModePills`, `ToolStatus` and `CapabilityNotice` consume Sonic Field variables through fallbacks. Outside a Sonic Field token scope, legacy tools retain their existing visual tokens.

### Global ToolShell compaction is intentional

The compact page header affects tool pages beyond the stress trio, but this is an accepted cross-tool fix for oversized vertical chrome. Full CI remains responsible for catching route-wide regressions before merge.

### Global focus token change is intentional and semantic

The legacy purple focus token was removed. Keyboard focus remains a dedicated token and is not mapped to amber/current-state semantics. The selected teal focus value has strong contrast against the current light surfaces.

### No fake production measurements introduced

Spectrum keeps the real renderer canvas. Hearing does not show a fabricated live-current marker. Structural guides are static and do not claim measured values.

### Controller/audio topology preserved

Headphone still exposes exactly six `[data-headphone-mode]` controls and three advanced panels. The perceptual fix is CSS-only. Spectrum and Hearing migrations do not rewrite their audio engines for layout convenience.

## Review #1 verdict

**APPROVED AFTER F1 FIX AND TARGETED VALIDATION.**

Next gate: remove temporary review QA workflow, then perform Cold Implementation Review #2 from the final diff before authorizing full CI.
