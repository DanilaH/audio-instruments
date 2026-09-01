# Sonic Field Production Plan — Cold Review #2

Date: 2026-09-01

Reviewed artifact:

- revised `docs/21_SONIC_FIELD_PRODUCTION_MIGRATION.md`
- revised plan commit: `e520e8510728a337f7b7bf9ab4266c71b4421695`
- first review: `docs/evidence/SONIC_FIELD_PRODUCTION_PLAN_REVIEW_2026-09-01.md`
- production baseline: `main@68fef62d5371efe5af662f09d3f53c0c53b7a333`

Review mode: second independent cold read after all Review #1 findings were resolved. No production migration code was implemented between the two plan reviews.

## Review #1 resolution check

| Finding | Result |
| --- | --- |
| R1 conflicting `04_VISUAL_SYSTEM.md` | Resolved: PR1 explicitly replaces the superseded visual contract and updates relevant `05_UX_UI.md` rules. |
| R2 Headphone six-mode topology | Resolved: behaviour-hook preservation is explicit; visual L/Both/R replace old channel mode controls. |
| R3 vague challenge states | Resolved: Headphone channel/Sweep, Spectrum active Spectrogram, Hearing Guided answer state are named. |
| R4 low-height desktop coverage | Resolved: 1280×720 added as compact-desktop stress viewport with an explicit non-distortion/exception rule. |
| R5 Stop-glyph verification too late | Resolved: PR1 verifies the first migrated transport controls cross-browser and fixes the shared path if reproducible. |
| R6 purple focus token survives | Resolved: PR1 replaces it with a non-purple contrast-validated focus treatment. |
| R7 synthetic signal-looking production decoration | Resolved: measurement/data-visualization honesty boundary is explicit. |
| R8 native audio control variance | Resolved: PR4 reserves the recording/playback region against Chromium/Firefox/WebKit while keeping native controls by default. |
| R9 PR1 size risk | Resolved: rationale and stop/split condition are explicit. |
| R10 behaviour selector drift | Resolved: IDs/data hooks are protected by default and deliberate changes require controller/test updates in the same unit. |

## Feasibility verification

The Spectrum challenge-state requirement is implementable with existing repository patterns. `tests/browser/spectrum-analyzer.spec.ts` already installs a controlled browser harness with fake `AudioContext`, analyser frames, media devices, stream and track settings. PR1 can reuse/refactor that strategy rather than asking CI for a real microphone.

The 1280×720 requirement is intentionally a stress target, not permission to crush the UI. The plan explicitly prioritizes readable/touchable controls and requires a documented exception if a tool cannot satisfy the stress viewport without harming the primary workflow.

The PR1 scope remains near the upper reviewable limit but is coherent: the shared system must be tested against spatial playback, realtime analysis and a guided temporal flow before the project commits to rolling it across the other thirteen tools. The split condition is sufficient protection against scope creep.

## Minor wording note — non-blocking

The palette shorthand currently groups the word `focus` with amber. Production implementation must interpret keyboard focus separately from signal/data focus:

- amber = current position / sweep / playhead / other audio-state emphasis;
- keyboard focus = dedicated semantic, non-purple, high-contrast focus treatment.

PR1’s canonical `04_VISUAL_SYSTEM.md` update must state this unambiguously.

## Verdict

**APPROVED FOR IMPLEMENTATION.**

No blocking plan defects remain.

Proceed with PR1 (`Foundation + stress trio`) using the repository’s standard workflow. Do not widen PR1 beyond its documented stop condition.
