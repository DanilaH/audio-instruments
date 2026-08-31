# 14 — Acceptance Criteria

## Global Definition of Done

Relevant criteria must pass before merge.

### Function

```text
core job works
primary controls work
stop/reset works
fallback/error states work
resources clean up
```

### Claims

```text
wording matches evidence class
no fake physical measurement
material limitations visible
```

### UX

```text
primary job immediately understandable
tool precedes long content
states clear
mobile usable
```

### Accessibility

```text
keyboard
focus
labels
status
contrast
reduced motion
touch targets
```

### Performance

```text
no leaked loops
bounded visualization history
no obvious UI-caused audio glitches
```

### Privacy/safety

```text
explicit mic flow
no upload
correct digital caps
obvious stop
hearing rules respected
```

### Visual

```text
Soft Sonic Studio direction
tool-specific functional visual
intentional target layouts
not generic monochrome utility card
```

## Required viewport review

```text
1440×900
1366×768
1024×768
390×844
```

## P0 acceptance

```text
Astro static
pnpm
Node pin
strict TS
Vitest (`vitest run`)
Playwright + standalone-safe `test:browser`
TypeScript + @astrojs/check
ESLint + typescript-eslint + eslint-plugin-astro
Prettier + prettier-plugin-astro
tool registry
approved dependencies only
docs present
.github/workflows/ci.yml present
Draft/unauthorized PR does not run expensive full-validation
unauthorized PR has failing merge-gate
Ready + full-ci-approved runs full-validation
merge-gate passes only after full-validation success
main branch protection requires merge-gate
```

## P1 acceptance

```text
tool-local AudioSession
lazy AudioContext({ latencyHint: "interactive" })
no forced sampleRate
idempotent pagehide/controller dispose
output engine
noise primitive
normalization/headroom
safe gain ramps
channel/pan
sweep
cleanup
waveform primitive
shared controls
```

## Generated-signal acceptance

Verify:

```text
general default master gain -24 dB relative to unity
general app max -12 dB relative to unity
hearing default master gain -36 dB relative to unity
hearing app max -24 dB relative to unity
~50 ms ramps
source normalization
headroom when summing
```

## Tone acceptance

```text
20–20k numeric + log slider
4 waveforms
level
L/Both/R
presets
Play/Stop
live waveform
blur/trail
clean cleanup
reduced motion
```

## Sound acceptance

```text
Left/Both/Right
guided sequence
visible active channel
simple smoke-test UX
```

## Speaker acceptance

```text
channel
phase
sweep
bass/rattle
user-observed wording
```

## Headphone acceptance

```text
L/R/Both
phase
sweep
bass/rattle
active earcup
```

## Stereo acceptance

```text
L/Center/R
bidirectional pan
spatial visual
```

## Phase acceptance

```text
correlated in-phase/inverted comparison
clear listening guidance
no wiring diagnosis
```

## Surround acceptance

```text
maxChannelCount capability
destination channelCount configured explicitly
standardized 5.1 order only for 6-channel speaker mode
500 Hz non-LFE bursts
80 Hz LFE burst
experimental 8-channel mode uses raw Channel 1–8 labels by default
"Stereo spatial preview" fallback
no universal 7.1 claim
cleanup/restoration verified
```

## Bass acceptance

```text
20–200 Hz
presets
single tone
sweep
safe level
```

## Frequency Sweep acceptance

```text
start/end
duration
linear/log
direction
Play/Stop
```

## Noise acceptance

```text
white/pink/brown
normalization
level
timer
cleanup
```

## Microphone acceptance

```text
explicit permission
preferred raw-ish constraints requested
actual settings visible in Details
RMS/peak timing
waveform
15 s local recording
permission/device failures
cleanup
```

## Spectrum acceptance

```text
Spectrum/Waveform/Spectrogram
FFT options
default 2048/0.8/-100..-20
log x-axis
bounded 30 fps spectrogram
no calibrated-response claim
```

## Pitch acceptance

```text
YIN
50–2000 Hz
confidence threshold
stabilization window
frequency/note/cents/confidence
unstable state
```

## Decibel acceptance

```text
RMS/Peak dBFS
100 ms/10 Hz meter timing using AudioContext.sampleRate
actual MediaStreamTrack settings inspected
AGC/noise suppression/echo cancellation all explicitly false for calibration
external reference is Z/Flat/Linear weighted
A/C-weighted reference rejected in v1
3 s stable calibration capture
unstable/clipping calibration rejected
device-scoped persistence when deviceId exists
session-only fallback when deviceId unavailable
recalibration warning after input/gain/condition changes
label = Reference-calibrated level estimate / User-calibrated
```

## Latency acceptance

```text
baseLatency seconds converted to ms
outputLatency seconds converted to ms
one-decimal display only after *1000 conversion
1000 ms flash/click loop
-300..+300 ms offset
5 ms steps
perception-based wording
```

## Hearing acceptance

```text
1000 Hz reference
documented guided sequence
manual mode
strict gain cap
no auto-volume increase
observed-result wording
no diagnosis
```

## Validation/merge acceptance

The PR is not mergeable until the workflow in `15_DEVELOPMENT_WORKFLOW.md` reaches:

```text
review #2 complete
full validation executed
required CI green
post-validation fixes re-reviewed as needed
```

## Frequency-cap acceptance

Every generated-frequency tool:

```text
uses shared Nyquist-safe cap
does not schedule above effectiveMaxHz
updates/clamps controls
shows capability notice when nominal range is reduced
does not interpret unavailable hearing frequencies as unheard
```

## CI/review acceptance

A PR is not mergeable unless:

```text
Review #1 cold pass recorded
Review #2 cold pass recorded
full-ci-approved added only after Review #2
PR moved from Draft → Ready only after authorization
full-validation successful on latest reviewed commit
required merge-gate green
material post-validation changes re-reviewed
squash merge used unless explicitly overridden
```

## Homepage acceptance

P0:

```text
real `/` route
registry planned/live status
live-only filtering
no planned-tool links/cards/routes
/privacy route
responsive shell
```

P2.2:

```text
Tone is live and featured
Soft Sonic Studio applied
Speaker/Mic/Headphone placeholders absent
desktop/mobile screenshots reviewed
```

P6.3:

```text
Tone/Speaker/Mic/Headphone final featured composition
all live categories correct
no unfinished links
not 16 identical cards
desktop/mobile screenshots reviewed
```

## AudioSession acceptance

```text
no global AudioContext singleton
tool-local lazy session
shared within current tool where needed
deterministic stop/dispose
AudioContext closed on page/tool dispose
```

## MediaRecorder acceptance

```text
MIME capability negotiation
no hardcoded WebM assumption
actual recorder.mimeType used
constructor fallback without explicit MIME
live mic remains usable if recording unsupported
```

## Meter acceptance

```text
exact 100 ms PCM RMS/peak calculation
-100 dBFS floor
10 Hz UI meter cadence
meter independent from Spectrum Analyzer settings
```


## Mic graph acceptance

Every mic-analysis tool uses `AudioContext.sampleRate` for downstream analysis, keeps track-reported sampleRate separate, and never live-connects mic source to `AudioContext.destination`.

## Active Stop acceptance

Every long-running playback/capture/analysis/sequence tool exposes Stop while active.

Stop cancels timed work; repeated Start does not duplicate resources; pagehide/dispose tears down and closes the tool-local AudioContext.

## Browser-support acceptance

Before P8 production:

```text
Playwright chromium/firefox/webkit green
actual Safari macOS smoke QA recorded
actual iOS Safari smoke QA recorded
actual Android Chrome smoke QA recorded
actual Edge smoke QA recorded
Chrome/Firefox real-browser smoke QA recorded
```

Playwright WebKit alone is insufficient for a Safari support claim.

Automated portion satisfied on 2026-08-31: the exact-head hosted Chromium/Firefox/WebKit release suite is green. Physical Safari/iOS/Android/Edge/Chrome/Firefox smoke QA remains required before claiming real-device/browser production support.

## Indexing acceptance

Default/non-production:

```text
noindex,nofollow
no production canonical
no indexable sitemap
```

Production:

```text
SITE_INDEXING=enabled
valid real SITE_ORIGIN
index,follow
correct canonical
correct sitemap origin
```

## CI authorization acceptance

Full validation must not run merely because a PR is non-Draft.

Required:

```text
Review #2 complete
full-ci-approved label present
PR Ready
```

Only then may `full-validation` execute.

## Surround negotiation acceptance

A surround mode is active only after destination configuration succeeds and readback matches.

Candidate `maxChannelCount` alone is insufficient.

## BFCache acceptance

Back/Forward restoration after a previously active tool produces a fresh idle controller and a new session on next Start.

No closed AudioContext is reused.

## Mic switching acceptance

```text
recording disables selector
new stream acquired before old live stream is destroyed
failed acquisition preserves old stream
successful switch clears old measurements
track ended produces explicit disconnected state
```

## Generated-audio safety acceptance

All audible-generation tools display low-system-volume guidance before first playback.

Noise timed playback displays an additional long-playback reminder.

## Hearing guided consistency acceptance

Guided reference and all guided high-frequency bursts use fixed `-36 dB` app Level.

The guided Level control is locked.

Manual Level changes never alter the guided result.

## Sweep acceptance — shared primitive

Speaker/Headphone/Bass/Frequency Sweep all use the same canonical linear/log frequency function and scheduling primitive.

## Noise acceptance — canonical rate

Deterministic white/pink/brown/reference buffers are generated at exactly 44,100 Hz before playback resampling.

## Acoustic estimate wording acceptance

Calibrated Sound Meter uses:

```text
Reference-calibrated level estimate
One-point reference calibration
```

It must not label the browser chain as true Z-weighted/unweighted measurement.

## Indexing acceptance — public preview

Public noindex preview remains crawlable so the noindex directive can be read.

Do not pair public-page `noindex` with a robots.txt disallow.

Private staging uses hosting-layer access control.

## P0 Astro tooling acceptance

```text
@astrojs/check installed
typescript installed
eslint-plugin-astro installed
typescript-eslint installed
prettier-plugin-astro installed
eslint.config.mjs present
.prettierrc.mjs present
lint includes .astro
format:check includes .astro through plugin
test:browser builds before preview
Playwright retries = 0
```

## Surround UX acceptance

Confirmed 5.1:

```text
individual FL/FR/C/LFE/SL/SR controls
Test All = exact documented order
700 ms burst / 300 ms gap
Stop
```

Experimental 8-channel:

```text
explicit opt-in
Channel 1–8
deterministic Test All
Stop
```

Mode changes stop active work and re-negotiate/read back target configuration.

## Microphone selector acceptance

All mic-analysis routes share the input selector when multiple inputs exist.

Explicit device selection uses:

```text
deviceId: { exact: selectedDeviceId }
```

An exact-selection failure must not silently fall back to another input.

## Recording acceptance

Auto-stop / explicit recording stop / tool-wide stop follow the MediaRecorder finalization order from Tool Specs.

## Spectrogram acceptance

```text
10 s visible history
<= 30 columns/s
300-column bounded ring buffer
oldest-left / newest-right
```

## P0–P6 indexing acceptance

Only non-indexable mode is required before P8:

```text
noindex,nofollow
no production canonical
no production sitemap
public preview crawlable
```

Positive production sitemap/index tests are P8 acceptance only.

## GitHub Actions hardening acceptance

```text
merge-gate is required check
conditional full-validation is never the branch-protection target
Dependabot config present
workflow permissions remain contents: read
```

## Repository-gate acceptance

Mechanical target when the platform supports it:

```text
main requires PR
main requires merge-gate
bypass disabled
force pushes blocked
branch deletion blocked
```

Current public repository state observed on 2026-08-31:

```text
main protected = false
repository rulesets = none configured
repository gate mode = manual until protection is explicitly configured and verified
PR/review/CI sequence remains mandatory
latest merge-gate must be green before merge
no direct roadmap push to main
no claim of mechanically unbypassable protection
```

The former private/free-plan exception no longer describes the repository. Mechanical repository protection remains an open hardening task; manual enforcement remains the active operating mode in the meantime.

## P0 bootstrap-test acceptance

```text
tests/unit/registry.test.ts exists and passes
tests/browser/shell.spec.ts exists and passes in chromium/firefox/webkit
empty Vitest suite is not allowed to pass
empty Playwright suite is not allowed to pass
```

## Spectrogram time-window acceptance

```text
visible time window is always 10 seconds by timestamp
columns older than 10,000 ms are evicted
hard capacity <= 300
dropped sampling cadence remains a real visual gap
```

## AV Sync visibility acceptance

Backgrounding the page stops/resets AV Sync.

Returning to the page does not auto-resume; explicit Start is required.

## Node/tooling acceptance

```text
supported Node >=24.16 <25
.nvmrc = 24.16.0
@typescript-eslint/parser direct dev dependency
Prettier checks source/tests/config, not the documentation corpus
```
