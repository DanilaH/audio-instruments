# P8 Static Release Audit — 2026-08-30

## Purpose

This record closes the source-reviewable portions of the P8 release gate that can be evaluated without a production domain, a sitemap dependency installation, hosted CI execution, or physical browser/device access.

It is intentionally limited to:

```text
measurement / claims wording
final static metadata wording
public route / H1 identity
live-only related-link construction
privacy copy vs current local-processing/storage implementation
```

It does **not** certify runtime accessibility, visual geometry, browser support, real-device behavior, positive production indexing, analytics/privacy-provider compliance, deployment, Search Console, or green CI.

## Baseline

```text
repository: DanilaH/audio-instruments
reviewed main commit: dad7ec774659123a65fa279747c403e9d0db3ac3
P7 evidence: docs/evidence/P7_AUDIO_EVIDENCE_2026-08-30.md
measurement/safety source of truth: docs/08_MEASUREMENT_HONESTY_AND_SAFETY.md
release source of truth: docs/11_RELEASE_AND_ANALYTICS.md
```

No runtime source change was made as a result of this audit because no release-blocking static claims or metadata defect was found.

## Route cohort reviewed

All current public HTML routes were reviewed:

```text
/
/privacy
/sound-test
/speaker-test
/headphone-test
/stereo-test
/phase-test
/surround-sound-test
/bass-test
/tone-generator
/frequency-sweep
/noise-generator
/microphone-test
/spectrum-analyzer
/pitch-detector
/decibel-meter
/audio-latency-test
/hearing-frequency-test
```

The tool cohort matches the 16 `live` entries in `src/registry/tools.ts`.

## Measurement / claims audit

Result: **CLEAN for static source wording on the reviewed baseline**.

The review checked page titles/descriptions, tool-shell descriptions, visible result/status terminology, material limitation copy, homepage positioning, and the privacy surface against the evidence classes and prohibited claims in `08_MEASUREMENT_HONESTY_AND_SAFETY.md`.

### Generated audio and output diagnostics

Sound, Speaker, Headphone, Stereo, Phase, Surround, Bass, Tone, Frequency Sweep and Noise keep digital generation/routing separate from physical conclusions.

Observed boundaries include:

```text
requested/generated digital frequency and channel wording
browser/runtime frequency-limit caveats where relevant
listening/user-observed wording for rattle, resonance, imbalance and phase-image changes
no physical speaker/headphone health guarantee
no physical wiring diagnosis
5.1 semantics only after supported destination negotiation
raw/experimental wording for 8-channel output
stereo fallback described as stereo rather than surround verification
```

Generated-audio interfaces also retain the required low-system-volume guidance. Noise Generator retains a separate reminder for longer timed playback.

### Microphone Test

The public wording stays within browser capture evidence:

```text
live waveform
digital RMS / peak dBFS
reported capture settings
optional local recording
```

The interface explicitly distinguishes dBFS from calibrated SPL and does not claim that live microphone input is a physical acoustic meter.

### Spectrum Analyzer

The route consistently describes relative browser-stream FFT/frequency content and does not promote the visualization into calibrated acoustic response or musical pitch.

### Pitch Detector

The route and instrument describe a bounded monophonic YIN **estimate**, with confidence/stability behavior and no forced guessed result for weak/noisy/polyphonic input.

### Decibel Meter

The route remains dBFS-first.

The optional physical-level path is described only as:

```text
One-point reference calibration
Reference-calibrated level estimate
User-calibrated
```

The interface preserves the Z / Flat / Linear requirement for the external reference instrument, rejects A/C-weighted references in v1, and does not claim the browser microphone chain itself is truly Z-weighted or professionally calibrated.

### Audio Latency / AV Sync

The route keeps two evidence classes separate:

```text
browser-reported baseLatency / outputLatency estimates
user-selected perception-based AV sync offset
```

It explicitly rejects interpretation as exact end-to-end hardware, Bluetooth or headphone latency. The 5 ms offset step is control granularity, not an accuracy claim.

### Hearing Frequency Test

The route remains explicitly non-clinical.

The Guided result is a session observation, not an audiogram, hearing age, diagnosis, normal/abnormal classification, clinical threshold or complete hearing-range measurement. Hardware/browser capability limits remain separate from “not heard”.

### Homepage

Homepage framing remains compatible with the product honesty boundary. It describes browser audio testing/measurement tools while explicitly stating that the product should show what the browser actually knows without pretending to measure what it cannot.

Featured-tool copy also retains local microphone-recording and non-diagnostic listening boundaries.

## Final static metadata audit

Result: **CLEAN for the current route set and P7 intent ownership**.

Each public route has a non-empty page title and description. Tool titles/descriptions are semantically distinct rather than mechanically duplicated across synonym routes.

P7 evidence-backed wording is retained where justified:

```text
/tone-generator      Online Tone & Frequency Generator
/headphone-test      Online Headphone Test
/microphone-test     Online Microphone Test
/pitch-detector      Online Pitch Detector
/decibel-meter       Online Decibel Meter
/noise-generator     White, Pink & Brown Noise Generator
```

The remaining route metadata continues to describe its distinct product job without forcing unrelated `online`/keyword variants into every title.

No reviewed metadata change justified:

```text
new synonym route
slug migration
H1 identity change
keyword-stuffed body copy
weaker measurement limitation
homepage acquisition-order churn
```

## H1 / route identity audit

Tool pages use the shared `ToolShell.astro`, which owns one page-level `<h1>` for the tool identity.

Homepage and Privacy own their own page-level H1s.

No duplicate tool route or duplicate H1 identity was found in the reviewed route architecture.

## Related-link audit

Tool pages derive related links from registry IDs and filter them through `getPublicTools()` before rendering `RelatedTools.astro`.

Therefore the current related-tool surface is live-only by construction. The audit found no justification to rewrite the link graph merely to mirror P7 acquisition-role ordering.

## Privacy consistency audit

Current Privacy copy matches the implemented core-v1 boundary reviewed here:

```text
no account required
microphone processing local in the browser
no microphone audio/recording upload in core v1
Decibel calibration metadata may be stored locally under browserAudioLab.dbCalibration.v2
raw microphone audio is not stored in that calibration record
analytics/advertising privacy behavior must be revised before future providers are enabled
```

No analytics or advertising provider is enabled by this audit.

## Closed P8 gates from this record

The following source-reviewable release items are complete on baseline `dad7ec774659123a65fa279747c403e9d0db3ac3`:

```text
measurement/claims static audit
final static metadata audit
public route/H1 identity audit
live-only related-link static audit
current core-v1 privacy-copy consistency audit
```

“Complete” here means the reviewed source contains no identified blocker requiring a change. It does not imply those surfaces were exercised in real browsers during this P8 unit.

## Explicitly still open

```text
lockfile-consistent @astrojs/sitemap installation/configuration
positive SITE_INDEXING + SITE_ORIGIN indexed-build/sitemap validation
real production SITE_ORIGIN
Playwright regression execution on the release candidate
runtime accessibility review
visual QA at required viewports
actual Chrome desktop smoke QA
actual Firefox desktop smoke QA
actual Edge smoke QA
actual Safari macOS smoke QA
actual iOS Safari smoke QA
actual Android Chrome smoke QA
analytics/privacy-provider decision and any required consent implementation
deployment
Search Console setup/submission
explicit production indexing activation
green CI / final validation evidence
```

Automated Playwright WebKit is not accepted as a substitute for actual Safari/iOS QA.

## Decision

Do not create a runtime/source-copy PR merely to manufacture activity: this static audit found no material defect requiring one.

P8 remains **in progress**. The next implementation-capable indexing step still requires a lockfile-consistent `@astrojs/sitemap` installation before `PRODUCTION_INDEXING_ARTIFACTS_READY` may be lifted. Release certification remains blocked by the real browser/device, runtime QA, production, analytics/privacy and validation gates listed above.
