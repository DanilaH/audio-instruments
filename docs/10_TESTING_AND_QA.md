# 10 — Testing and QA

## Tooling

```text
Vitest
→ deterministic unit/service logic

Playwright
→ browser flows + viewport/screenshot QA

ESLint
→ code/static quality

Prettier
→ formatting

astro check
→ Astro/TypeScript validation
```

## Full validation gate timing

The full project-wide validation gate is intentionally run at the stage defined in:

```text
docs/15_DEVELOPMENT_WORKFLOW.md
```

Do not silently move the gate earlier in the workflow.

## Required scripts

Repository scripts are exact:

```text
dev           = astro dev
build         = astro build
preview       = astro preview --host 127.0.0.1
check         = astro check
test          = vitest run
test:indexing = node scripts/verify-indexed-build.mjs
test:browser  = pnpm build && playwright test
lint          = eslint src + tests + scripts + playwright/vitest/astro config files
format:check  = prettier --check source/tests/scripts/config files per `20_P0_TOOLING_CONTRACT.md`
```

`test:indexing` is the P8.3 positive indexed-build verifier; it is separate from the default noindex browser suite.

## Unit tests

Candidates:

```text
log frequency mapping
slider clamping
dB → gain conversion
RMS
peak
dBFS conversion
noise normalization
sweep scheduling helpers
channel mapping
latency formatting
calibration offset
note/frequency conversion
YIN helpers
```

## Service lifecycle

Test:

```text
start
stop
restart
cleanup
permission failure
unsupported API
device loss
repeated start/stop
```

## Generated-signal tests

Verify:

```text
default/master gain values
max gain caps
hearing stricter caps
fade scheduling
source normalization
worst-case multi-source headroom rules
```

Do not test that these digital values guarantee a physical safe SPL.

## Realtime visualization tests

Verify:

```text
DPR cap <= 2
bounded history
one loop per visualization
teardown cancels loop
repeated start does not multiply loops
```

## Browser/integration

Cover:

```text
AudioContext unlock/resume
mic permission states
MediaRecorder fallback
capability fallbacks
state transitions
```

## Viewport matrix

```text
1440×900
1366×768
1024×768
390×844
320×844
```

Check:

```text
no horizontal overflow
primary controls visible/readable
visualization not clipped
mobile interaction intentional
```

## Accessibility

Check:

```text
keyboard
focus
labels
status announcements
contrast
touch targets
reduced motion
```

## Real-device QA

Before production:

### Output

```text
built-in speakers
wired headphones
Bluetooth headphones
external speakers where practical
```

### Input

```text
built-in mic
external mic where practical
mobile mic
```

### Surround

Actual supported multichannel hardware is required before claiming real-device validation.

## What automation cannot prove

```text
physical speaker output correctness
absence of rattle
actual mic hardware quality
physical surround wiring/location
user hearing threshold
absolute uncalibrated SPL
```

## Additional hardening tests

### Frequency-cap tests

For sample rates including:

```text
32000
44100
48000
96000
```

verify every generated-frequency tool respects:

```text
effectiveMaxHz <= 0.95 * Nyquist
```

and that nominal >effective controls cannot schedule an oscillator above the cap.

### Spectrum tests

Verify Spectrum Analyzer uses float frequency data as the canonical dB data path.

Do not unit-test `minDecibels/maxDecibels` as if they define the semantic float-data range.

### Calibration tests

Cover:

```text
same deviceId → matching calibration restored
different deviceId → calibration not reused
missing deviceId → session-only behavior
AGC true/unknown → calibrated mode disabled
noiseSuppression true/unknown → calibrated mode disabled
echoCancellation true/unknown → calibrated mode disabled
all three explicitly false → calibration eligible
unstable 3 s calibration window → rejected
clipping calibration window → rejected
```

### Surround tests

Cover:

```text
maxChannelCount < 6 → stereo preview only
maxChannelCount >= 6 → 5.1 candidate
destination channelCount configured explicitly
5.1 standardized order
maxChannelCount >= 8 → experimental raw 8-channel mode
no universal 7.1 labels by default
cleanup restores tool-managed destination state
```

### Noise tests

Use seeded deterministic buffers and verify:

```text
repeatable output for same seed
finite samples
DC mean near zero after processing
peak <= 0.8 before master gain
phase-test L/R source buffer correlation is exact before inversion
```

## AudioSession lifecycle tests

Cover:

```text
context created lazily on explicit tool start
multiple services in one tool share the same session context
Stop does not leak active nodes
dispose closes the tool-local AudioContext
navigation/dispose leaves no live context owned by the page
permission failure cleans up an otherwise-unused session
```

## Meter-math tests

Use deterministic PCM fixtures and verify:

```text
RMS formula
peak formula
20*log10 conversion
-100 dBFS display floor
100 ms sample-window selection
meter configuration independent from Spectrum FFT settings
```

## MediaRecorder portability tests

Mock capability combinations:

```text
WebM supported → selected
WebM false + Ogg supported → Ogg selected
WebM/Ogg false + MP4 supported → MP4 selected
all candidates false → constructor without explicit mimeType
constructor failure → recording unavailable but live mic still works
```

## Stereo routing tests

Verify hard:

```text
Left
Both
Right
```

uses explicit channel routing rather than `StereoPannerNode`.

Verify continuous pan uses the pan primitive.

## Pitch bounded-performance tests

At context sample rates:

```text
44100
48000
88200
96000
176400
192000
```

verify:

```text
downsampleFactor = ceil(contextRate / 48000)
analysisRate = contextRate / downsampleFactor
YIN cadence <= 20 Hz
tau range stays inside 50–2000 Hz
frame size uses downsampled analysis rate
```

Do not execute full YIN on every animation frame.


## Playwright project contract

`playwright.config` defines at least:

```text
chromium
firefox
webkit
```

`pnpm test:browser` runs all three.

With retries disabled, failure diagnostics use retained-on-failure traces and failure-only screenshots. CI uploads `test-results` only when the full-validation job fails.

Playwright WebKit is not branded Safari certification.

## Real-browser P8 QA matrix

Before production support claims/indexing, record smoke QA on:

| Browser/device | Minimum real QA |
|---|---|
| Chrome desktop | Windows or macOS; output + mic |
| Edge desktop | Windows; output + mic |
| Firefox desktop | Windows or macOS; output + mic |
| Safari macOS | actual Safari; output + mic/MediaRecorder |
| iOS Safari | physical iPhone/iPad; core output + mic |
| Android Chrome | physical Android; core output + mic |

Record browser/version, OS/device, flow, pass/fail, fallback and date.

## Mic feedback test

Verify every mic-based tool has no audible destination connection and produces no live speaker monitoring/feedback.

## Hearing safety tests

Verify:

```text
1 kHz setup reference precedes high-frequency steps
system-volume warning visible
guided/manual tones finite
manual mode cannot become continuous
Stop visible
"I didn't hear it" never increases Level
guided result only says Highest frequency you reported hearing
```

## Bass safety tests

Verify:

```text
minimum selectable/generatable = 20 Hz
sub-20 values cannot be scheduled
moderate-volume/no-compensation warning visible
preset sequence timing matches Tool Specs
Stop cancels sequence/sweep
```

## Indexing-gate tests

### Default/non-indexable build

```text
SITE_INDEXING unset/disabled
→ noindex,nofollow
→ no production canonical
→ no production sitemap
→ public preview remains crawlable
```

The browser regression covers `/`, `/privacy` and all 16 live tool routes, and verifies `/sitemap-index.xml` is absent in the default preview build.

### P8.3 positive indexed build

`pnpm test:indexing` builds with a synthetic valid HTTPS origin and verifies:

```text
SITE_INDEXING=enabled + valid SITE_ORIGIN
→ index,follow on all 18 HTML routes
→ canonical remains on configured origin
→ sitemap-index.xml exists
→ sitemap-0.xml exists
→ robots Sitemap directive correct
→ every canonical appears in sitemap
```

Supported local execution on Node `24.16.0` / pnpm `11.21.0` passed at validation SHA `5d2bde8e5b51c26507abb4b63e0da1e043998ea5`.

Evidence: `docs/evidence/P8_INDEXING_VALIDATION_2026-08-30.md`.

Positive artifact readiness does not certify production activation or the remaining browser/device release gates.

## Browser-test server contract

`playwright.config.ts` uses:

```text
command = pnpm preview
url/baseURL = http://127.0.0.1:4321
reuseExistingServer = false
```

Local and CI browser runs must start the preview for the current checkout rather than silently reusing an unrelated/stale process already listening on port 4321.

The build step runs before browser tests in full CI.

## Browser media mock boundary

CI browser tests may mock/stub:

```text
navigator.mediaDevices.getUserMedia
enumerateDevices
getSupportedConstraints
MediaStreamTrack settings/ended behavior
AudioContext capability wrappers
```

to verify:

```text
permission states
device switching state machine
fallback UI
resource cleanup
surround negotiation logic
```

CI mocks never count as real microphone/speaker validation.

## Microphone device-switch tests

Cover:

```text
successful new-stream acquisition → old stream stopped after new succeeds
failed new-stream acquisition → old stream remains active
selector disabled during recording
track ended → disconnected state + cleared/stale meters
devicechange → list refresh without silent active-device swap
new deviceId → only matching calibration restored
```

## BFCache lifecycle tests

Browser flow:

```text
start tool
→ navigate to another page
→ Back
→ pageshow persisted path
→ controller is idle/fresh
→ Start again
→ new AudioContext/session works
→ no duplicate listeners
```

Unit/integration tests also verify `dispose()` is idempotent.

## Surround runtime-negotiation tests

Cover:

```text
maxChannelCount high but setter throws → fallback
setter succeeds but readback mismatches → fallback
5.1 readback matches → expose 5.1
8-channel readback matches → expose raw 1–8
restore succeeds → reuse session allowed
restore fails → AudioSession disposed
```

## Sweep primitive tests

For linear and logarithmic sweeps verify:

```text
correct f(0)
correct f(1)
midpoint formula
ascending/descending endpoint inversion
positive-frequency requirement
correct AudioParam ramp method
Stop cancels future scheduling
```

## Noise reproducibility tests

Pure noise/reference generation tests always use:

```text
sampleRate = 44100
```

Verify deterministic output for same seed and no dependency on current AudioContext rate.

Playback integration may use contexts with other rates; the source buffer itself remains canonical 44.1 kHz.

## Live-route publication tests

Given mixed planned/live registry entries:

```text
homepage shows only live
navigation shows only live
related tools show only live
no href exists to planned tool route
empty category omitted
```

## Hearing fixed-level tests

Guided mode:

```text
reference Level = -36 dB
all guided bursts = -36 dB
Level control locked after setup
"I didn't hear it" changes no volume/gain state
```

Manual mode may change Level but never changes Guided result.

## Global audible-safety tests

Every generated-audio route exposes the first-play low-volume guidance before playback.

Noise timer selection exposes the long-playback reminder.

## Astro tooling tests

P0 verifies:

```text
pnpm check actually executes astro check
@astrojs/check installed
typescript installed
ESLint includes at least one .astro fixture
Prettier checks at least one .astro fixture
```

A P0 tooling test must fail if `.astro` lint/format support is removed.

## Latency unit tests

Mock raw Web Audio values:

```text
0.005 s → 5.0 ms
0.01234 s → 12.3 ms
undefined → Not reported
```

UI never receives raw-second fields from `AudioLatencyReader`.

## AV Sync scheduling tests

With fake clocks verify:

```text
offset = +50 ms → audio target 50 ms after visual target
offset = -50 ms → audio target 50 ms before visual target
first event remains future-schedulable at -300 ms
cycle IDs are not duplicated
offset change resets future anchor/scheduling
Stop cancels timer/RAF/audio sources
```

Tests verify scheduling math, not real acoustic/display synchronization.

## Spectrogram history tests

Verify:

```text
history duration = 10 s by timestamp
max columns = 300
max ingestion = 30 columns/s
columns older than 10,000 ms evicted
x-position derived from timestamp within 10 s window
dropped cadence leaves visual time gaps
no unbounded JS frame history
```

## Recording lifecycle tests

Verify:

```text
15 s auto-stop calls recorder.stop()
auto-stop does not stop live mic stream
non-empty dataavailable chunks retained
stop event finalizes Blob/object URL
previous object URL revoked
tool-wide Stop waits up to 1500 ms for recorder finalization
timeout/error discards incomplete recording but still tears down tracks
```

## Speaker/Stereo channel tests

Verify:

```text
Speaker Channel = Left/Both/Right + deterministic sequence
Stereo Center = shared Both primitive
Both uses same per-channel amplitude as Left/Right
```

## Playwright retry policy

Merge-gating browser projects use:

```text
retries = 0
```

A failure that passes only on a second automatic attempt is not accepted.

## GitHub merge-gate behavior tests/review

Workflow review must confirm:

```text
merge-gate has no job-level authorization `if`
unauthorized PR → merge-gate failure
authorized + skipped/failed full-validation → merge-gate failure
authorized + successful full-validation → merge-gate success
```

Do not configure branch protection to require the conditional `full-validation` job itself.

## AV Sync visibility test

Verify:

```text
active AV sequence
→ document hidden
→ timers/RAF/scheduled sources stopped
→ state returns idle

document visible again
→ does not auto-resume
→ explicit Start required
```

## P8 automated release evidence — 2026-08-31

Recorded in `docs/evidence/P8_RELEASE_VALIDATION_2026-08-31.md`:

```text
exact-head Full Validation incl. Chromium/Firefox/WebKit PASS
172/172 unit/service tests PASS
positive indexing verifier PASS
homepage + 16 tool routes × required viewport matrix visual review complete
34 desktop/mobile runtime axe surfaces for homepage + 16 tools: 0 WCAG A/AA violations
34 desktop/mobile surfaces: 0 horizontal overflow
cross-engine visual spot-check: no material layout divergence
```

This closes the automation-executable browser/accessibility/visual P8 gates. Actual Safari macOS, iOS Safari, Android Chrome, Edge and physical microphone/output-device smoke QA remain manual pre-production work.
