# 12 — Decisions and Boundaries

This is the highest-authority repository decision document after explicit current user instructions.

It contains **current decisions only**. Historical/superseded decisions belong in `CHANGELOG.md`.

## Product

```text
PROD-01 Build the full sensible 16-tool Audio catalog.
PROD-02 One route represents one distinct user job.
PROD-03 Do not create thin synonym routes.
PROD-04 Browser-first/local-first core v1.
PROD-05 No backend, database, auth or cloud audio processing in core v1.
PROD-06 English-only core v1; US-English SEO/copy orientation.
PROD-07 Upgraded SEO runner may reorder acquisition priority but does not block P0–P6.
PROD-08 `/` is a real homepage governed by 18_HOMEPAGE_AND_SITE_SHELL.md.
PROD-09 Planned tools may exist in registry metadata but are never exposed as clickable unfinished routes.
PROD-10 Homepage/navigation/related-tools link only `status = live`.
PROD-11 `/privacy` is a real static route governed by 19_PRIVACY_AND_LEGAL.md.
```

## Visual system

```text
VIS-01 Soft Sonic Studio is the core art direction.
VIS-02 Dynamic audio-derived visuals are a primary identity motif.
VIS-03 Subtle blur and short fading trails are approved.
VIS-04 Baseline animation package = `motion`.
VIS-05 Baseline vanilla icon package = `@phosphor-icons/web`.
VIS-06 Do not substitute framework-specific Motion/Phosphor packages.
VIS-07 Rive, OGL, Three.js and heavy WebGL are not bootstrap dependencies.
VIS-08 Functional visual identity exists from the start; fine polish may continue later.
VIS-09 Accent colors may not be used as text/focus/state indicators unless contrast requirements are satisfied.
```

## Runtime and architecture

```text
ARCH-01 Astro static output / ordinary MPA routing.
ARCH-02 No SSR and no React/Vue/Svelte framework islands in core v1.
ARCH-03 Strict TypeScript, plain CSS/custom properties.
ARCH-04 No global application state library.
ARCH-05 Typed tool registry is required for stable metadata only.
ARCH-06 Registry fields include status = planned | live.
ARCH-07 Registry does not contain AudioContext, streams, live measurements or UI runtime state.
ARCH-08 Core v1 uses a tool-local AudioSession; never a cross-page AudioContext singleton.
ARCH-09 AudioSession lazily creates new AudioContext({ latencyHint: "interactive" }) after explicit user interaction.
ARCH-10 Do not force AudioContext sampleRate.
ARCH-11 Services inside one tool may share its AudioSession/context.
ARCH-12 Stop ends active activity; dispose/pagehide tears down and closes the tool-local AudioContext.
ARCH-13 pageshow with persisted=true remounts a fresh idle controller after BFCache restoration.
ARCH-14 Browser services never import tool/page UI.
ARCH-15 Tool internals do not import other tool internals.
ARCH-16 Circular dependencies are prohibited.
ARCH-17 OutputDeviceSelector/setSinkId infrastructure is deferred from P0–P6.
ARCH-18 getOutputTimestamp integration is deferred from the v1 latency baseline.
```

## Generated audio

```text
AUDIO-01 User-facing Level is master digital gain in dB relative to unity, not resulting dBFS or acoustic loudness.
AUDIO-02 General Level default = -24 dB; app maximum = -12 dB.
AUDIO-03 Hearing guided Level is fixed at -36 dB after the 1 kHz setup reference.
AUDIO-04 Hearing manual Level range = -60..-24 dB; manual mode never produces threshold-like results.
AUDIO-05 Audible generated signals use ~50 ms start/stop ramps unless a stricter tool rule exists.
AUDIO-06 Generated sources are normalized before master gain.
AUDIO-07 Multi-source same-channel sums preserve worst-case digital headroom.
AUDIO-08 Do not hide incorrect headroom behind a compressor/limiter.
AUDIO-09 Hard Left/Both/Right diagnostics use explicit channel routing.
AUDIO-10 Both uses the same per-channel amplitude as single-channel Left/Right; it is not equal-power total-normalized.
AUDIO-11 Continuous L↔R movement uses StereoPannerNode or equivalent continuous pan.
AUDIO-12 Generated-frequency ceiling = min(tool nominal max, 95% of actual AudioContext Nyquist).
AUDIO-13 Bass/Subwoofer core v1 range = 20–200 Hz.
AUDIO-14 Canonical noise-buffer generation sample rate = 44,100 Hz; fixed pink coefficients are defined for that reference rate.
AUDIO-15 NoiseEngine owns exact deterministic algorithms/reference buffers; AudioBuffer playback is resampled by Web Audio as necessary.
AUDIO-16 Frequency sweeps use one shared mathematical/scheduling primitive defined in Tool Specs.
```

## Global audible-safety UX

```text
SAFE-01 Every generated-audio tool shows before first playback:
        "Start with your device/headphone volume low. Increase only to a comfortable level."
SAFE-02 Do not tell users to increase volume to compensate for an inaudible tone.
SAFE-03 Digital gain limits never imply guaranteed safe physical SPL.
SAFE-04 Noise Generator adds an explicit reminder before 1/5/10-minute timed playback.
SAFE-05 Hearing guided mode locks app Level at -36 dB for all threshold-like observations.
SAFE-06 Hearing guided flow never auto-increases app Level or system volume.
SAFE-07 Hearing tones are finite bursts.
SAFE-08 Hearing guided result = "Highest frequency you reported hearing in this session".
SAFE-09 Bass UI warns not to compensate for inaudible low frequencies by increasing system volume.
SAFE-10 Every active audible sequence/session has an obvious Stop control.
SAFE-11 AV Sync uses a small localized pulse, never full-screen strobing.
```

## Microphone and analysis

```text
MIC-01 Permission is requested only after explicit user action.
MIC-02 Core v1 microphone audio remains local.
MIC-03 Live microphone input is never routed to AudioContext.destination.
MIC-04 Requested constraints are not treated as actual settings; use MediaStreamTrack.getSettings().
MIC-05 Downstream PCM/FFT/pitch analysis uses AudioContext.sampleRate.
MIC-06 Track sampleRate is browser-reported metadata only.
MIC-07 MediaRecorder uses MIME capability negotiation and actual recorder.mimeType.
MIC-08 Recording is optional; failure must not disable live mic/meter functionality.
MIC-09 Input selector is disabled while recording.
MIC-10 Device switch is an explicit atomic stream handoff defined in Tool Specs.
MIC-11 Active-track end/device removal clears stale measurements and enters explicit disconnected state.
```

## Measurement honesty

```text
MEAS-01 Every displayed result is classified as browser-known/generated, browser-reported/estimated, or user-observed.
MEAS-02 Browser-reported/estimated values are never promoted into physical certainty.
MEAS-03 User-observed physical behavior is never converted into fake automatic diagnosis.
MEAS-04 Mic meter uses exact 100 ms PCM RMS/peak math with -100 dBFS display floor.
MEAS-05 Spectrum canonical frequency data path uses getFloatFrequencyData().
MEAS-06 Pitch Detector v1 uses bounded YIN from Tool Specs.
MEAS-06A Standard YIN CMNDF may calculate lower-lag difference terms required for cumulative normalization. Pitch candidate selection remains restricted to tauMin..tauMax. Parabolic refinement may read the already-calculated immediate lower neighbor when selectedTau = tauMin, but no lag above tauMax is calculated or used.
MEAS-06B Integer pitch candidates use the documented floor/ceil tau search, while refinedTau is clamped to the continuous target-period interval analysisRate/2000 through analysisRate/50 before frequency conversion so valid 50–2000 Hz edge signals are not rejected solely by integer tau rounding.
MEAS-07 dB/Sound Meter default output is RMS/Peak dBFS.
MEAS-08 Optional acoustic estimate is labelled "Reference-calibrated level estimate" / "One-point reference calibration".
MEAS-09 Do not call the browser measurement chain Z-weighted/unweighted merely because the reference meter uses Z/Flat/Linear.
MEAS-10 Calibration is device-scoped and requires AGC/noise suppression/echo cancellation all explicitly false.
MEAS-11 Calibration uses a stable 3-second window and rejects unstable/clipping windows.
MEAS-12 External reference must use Z/Flat/Linear; A/C-weighted references are not accepted in v1.
MEAS-13 One-point calibration does not correct microphone frequency response.
MEAS-14 Standardized surround speaker semantics are limited to Web Audio 5.1.
MEAS-15 8-channel output is experimental raw discrete output, not guaranteed universal 7.1.
MEAS-16 Surround candidate capability must be configured and read back successfully before being exposed as active.
MEAS-17 Audio latency API values are browser-reported/estimated, not exact hardware latency.
MEAS-18 Manual AV offset 5 ms is control granularity, not accuracy.
```

## Browser and accessibility

```text
BROW-01 Capability decisions use feature detection, not normal UA sniffing.
BROW-02 Automated CI uses Playwright Chromium, Firefox and WebKit projects.
BROW-03 Playwright WebKit is not branded Safari certification.
BROW-04 P8 requires real-browser/device smoke QA for Chrome, Edge, Firefox, Safari macOS, iOS Safari and Android Chrome.
A11Y-01 Realtime Hz/dB/pitch/spectrum values are not aria-live.
A11Y-02 aria-live is reserved for discrete meaningful state changes.
A11Y-03 Reduced motion removes decorative motion without removing state/data.
A11Y-04 Semantic text/focus indicators independently satisfy contrast.
```

## SEO and release

```text
SEO-01 Tool interaction precedes long explanatory/SEO content.
SEO-02 No minimum word count or filler content.
SEO-03 Public preview/staging defaults to crawlable noindex,nofollow.
SEO-04 Public noindex preview does not robots-disallow the same URLs.
SEO-05 Private staging uses access control; robots.txt is not a security mechanism.
SEO-06 Indexing requires explicit SITE_INDEXING=enabled and valid SITE_ORIGIN.
SEO-07 Non-indexable builds omit production canonical and production sitemap.
SEO-08 Production canonical = SITE_ORIGIN + normalized pathname.
SEO-09 Sitemap implementation uses @astrojs/sitemap in P8 only when indexing is enabled.
```

## Development and CI

```text
PROC-01 Development occurs on a dedicated branch.
PROC-02 Early Draft PR uses the minimum checkpoint commit required by Git.
PROC-03 Review #1 and Review #2 are separate cold review passes over the actual PR diff; in the owner-approved single-assistant mode, the same project assistant performs them after explicitly switching from implementation to review mode.
PROC-04 Draft remains Draft through Review #2.
PROC-05 After Review #2, add label `full-ci-approved` while still Draft.
PROC-06 Then mark PR Ready for review.
PROC-07 `full-validation` runs only when Ready + `full-ci-approved`.
PROC-08 Branch protection requires `merge-gate`, not `full-validation`.
PROC-09 `merge-gate` always executes for tracked PR events and fails unless authorization exists and full-validation succeeded.
PROC-10 Failed validation triggers fix, commit, appropriate cold re-review and rerun.
PROC-11 Material re-review returns PR to Draft and removes `full-ci-approved` before a new Review #2.
PROC-12 Merge requires required reviews, `merge-gate` green and acceptance criteria.
PROC-13 Default roadmap merge strategy is squash merge.
PROC-14 Next roadmap task starts after merge/update of main unless explicitly parallelized.
PROC-15 pnpm = 11.21.0; supported Node range = >=24.16 <25.
PROC-16 CI uses actions/checkout@v7 and pnpm/setup@v2.
PROC-17 Browser tests have zero retries in merge-gating CI.
PROC-18 Action hardening baseline = reviewed major tags + Dependabot, not full-SHA pins.
PROC-19 Empty-repository initialization may seed the reviewed documentation/tooling baseline directly to main before normal roadmap PR enforcement exists.
PROC-20 A repository without available GitHub protected-branch/ruleset controls must be documented as manual-gate mode; do not claim mechanical enforcement.
```

## Additional execution decisions

```text
EXEC-01 baseLatency/outputLatency API seconds are converted to displayed milliseconds by value * 1000.
EXEC-02 Manual AV Sync schedules visual and audio events from one future cycle anchor; negative offsets are never implemented reactively.
EXEC-03 All mic-analysis pages use the shared input-selector/device-switch contract when multiple inputs are available.
EXEC-04 A selected mic is requested with deviceId exact semantics.
EXEC-05 Surround default mode prefers confirmed 5.1; experimental raw 8-channel is explicit opt-in.
EXEC-06 Surround Test All uses deterministic channel order, burst duration and gap from Tool Specs.
EXEC-07 Spectrogram visible history = 10 seconds at max 30 columns/second.
EXEC-08 MediaRecorder auto-stop/finalization order is fixed by Tool Specs.
EXEC-09 Positive sitemap/indexing acceptance belongs to P8 only; P0–P6 validate non-indexable behavior only.
EXEC-10 Stereo Center is the shared Both primitive.
EXEC-11 Speaker Channel mode uses Left/Both/Right + Run sequence.
EXEC-12 Core Phosphor global weight = Regular; additional weights are route-local and budgeted.
```

## Non-goals

```text
DAW
cloud audio storage
accounts
AI audio generation
medical audiometry
professional calibrated acoustic analysis
sub-20 Hz subwoofer stress testing
heavy graphics showcase
framework experimentation
placeholder/Coming Soon tool pages
```

## Open decisions

```text
final UI font: Manrope vs Plus Jakarta Sans
fine palette tuning
exact trail decay/blur tuning
homepage visual composition details inside the fixed structure
whether Rive is ever added later
final production domain
final production slug refinements
final analytics/ad provider
exact minimum browser-version numbers at release
```
