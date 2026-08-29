# 03 — Tool Specifications

This document defines exact baseline behavior for all core v1 tools.

## Shared generated-signal rules

Unless a stricter tool rule exists:

```text
master digital gain default: -24 dB relative to unity
app-level maximum: -12 dB relative to unity
fade-in/out: ~50 ms
```

See `08_MEASUREMENT_HONESTY_AND_SAFETY.md` for exact interpretation.

Channel-test signal baseline:

```text
500 Hz sine
700 ms duration
50 ms fade-in/out
```

Phase comparison baseline:

```text
same deterministic correlated pink-noise buffer in both channels
in-phase: identical L/R
inverted: right channel multiplied by -1
```

### Shared frequency-cap rule

All generated-frequency tools use:

```text
nyquistHz = AudioContext.sampleRate / 2
effectiveMaxHz = min(toolNominalMaxHz, floor(0.95 * nyquistHz))
```

If `effectiveMaxHz` is below the nominal UI range, the tool must:

```text
clamp controls to effectiveMaxHz
show a concise capability notice
never generate above effectiveMaxHz
```

This applies to Tone, Speaker/Headphone sweeps, Bass, Frequency Sweep and Hearing Frequency.

### Shared Level control semantics

The UI label is:

```text
Level
```

but the control value is **master digital gain in dB relative to unity**, not percent.

General generated-signal slider:

```text
range: -60 dB → -12 dB
step: 1 dB
default: -24 dB
unit: dB relative to unity gain
```

Hearing Frequency slider:

```text
range: -60 dB → -24 dB
step: 1 dB
default: -36 dB
unit: dB relative to unity gain
```

Show the numeric digital value next to the slider.

`Stop`/inactive state is true silence; the slider minimum is not used as a mute substitute.

### Shared first-play acoustic-safety copy

Before the first audible action on every generated-audio tool, this concise guidance is visible in the primary tool surface:

```text
Start with your device/headphone volume low.
Increase it only to a comfortable listening level.
Do not turn the volume up to compensate for a tone you cannot hear.
```

This guidance applies to:

```text
Tone
Sound
Speaker
Headphone
Stereo
Phase
Surround
Bass
Frequency Sweep
Noise
Latency click playback
Hearing
```

It is informational, not a modal confirmation gate.

Noise Generator additionally repeats a short volume reminder when a 1/5/10-minute timer is selected.


### Shared stereo channel-routing rule

Discrete diagnostic channel modes:

```text
Left
Both
Right
```

must use explicit per-channel routing, not `StereoPannerNode`.

For a mono test source:

```text
Left  → source only to left output channel
Both  → same per-channel source amplitude to left and right output channels
Right → source only to right output channel
```

`Both` is intentionally not equal-power total-normalized.

Therefore the combined acoustic presentation may sound louder than one single-channel burst; do not use `Both` as a loudness-comparison measurement.

Continuous movement:

```text
L → R
R → L
```

uses `StereoPannerNode` or an equivalent continuous-pan primitive.

Do not use pan-law behavior for hard diagnostic L/Both/R channel tests.

### Shared frequency-sweep primitive

All sweep-based tools call the same `AudioOutputEngine` primitive.

For elapsed proportion:

```text
p = clamp(elapsed / duration, 0, 1)
```

Choose endpoints:

```text
Ascending:
f0 = low
f1 = high

Descending:
f0 = high
f1 = low
```

Linear sweep:

```text
f(p) = f0 + (f1 - f0) * p
```

Logarithmic sweep:

```text
f(p) = f0 * (f1 / f0) ** p
```

All v1 sweep frequencies are strictly positive.

Scheduling contract:

```text
linear       → AudioParam.linearRampToValueAtTime(f1, endTime)
logarithmic  → AudioParam.exponentialRampToValueAtTime(f1, endTime)
```

Set the starting frequency explicitly at `startTime`.

On Stop:

1. ramp audible master gain down using the shared stop ramp;
2. cancel/hold future frequency automation when supported;
3. otherwise cancel scheduled values at the stop time;
4. stop/disconnect the source.

Speaker, Headphone, Bass and Frequency Sweep must not implement separate sweep math.

### Shared active-tool lifecycle

Every tool that starts continuous playback, a timed sequence, microphone capture, analysis, recording or AV-sync loop exposes an explicit Stop action while active.

Rules:

- repeated Start while active does not create duplicate nodes/streams/loops;
- Stop cancels scheduled bursts/sweeps/timers;
- audible Stop uses the documented ramp;
- stopping mic/analysis stops MediaStream tracks and analysis/animation loops;
- finite one-shot bursts may return to idle automatically;
- running multi-step sequences still expose Stop;
- pagehide/controller dispose performs teardown and closes the tool-local AudioContext.

### 1. Tone Generator

#### Job

Generate a controlled digital oscillator.

#### Controls

```text
frequency numeric input
20–20,000 Hz logarithmic slider
sine / square / triangle / sawtooth
level
Left / Both / Right
Play / Stop
presets
```

Presets:

```text
40
100
440
1000
10000 Hz
```

#### Behavior

- frequency edits apply live while playing;
- waveform edits apply live;
- channel edits apply without orphaning old nodes;
- safe gain ramps prevent obvious clicks/pops.

#### Visual

Large waveform reflecting the oscillator type.

Subtle blur + short fading trail.

#### Claim

Requested/generated digital frequency only.

---

### 2. Sound Test / Audio Test

#### Job

Fast basic output smoke test.

#### Controls

```text
Left
Both
Right
Run sequence
```

#### Signal

Use the shared 500 Hz / 700 ms test burst.

Guided sequence:

```text
Left → 300 ms gap → Both → 300 ms gap → Right
```

#### Result

No automatic health score.

User verifies expected audible output.

---

### 3. Speaker Test

#### Job

Inspect speaker/channel behavior.

#### Modes

```text
Channel
Phase
Sweep
Bass/rattle
```

#### Channel mode

Controls:

```text
Left
Both
Right
Run sequence
Stop
```

Use the shared 500 Hz / 700 ms test burst.

`Both` uses the shared Both primitive.

Run sequence:

```text
Left
→ 300 ms gap
→ Both
→ 300 ms gap
→ Right
```

No separate Speaker-specific channel-routing implementation.

#### Phase mode

Use correlated pink-noise comparison:

```text
In phase
Inverted right channel
```

#### Sweep mode

Defaults:

```text
100 Hz → 10,000 Hz
10 s
logarithmic
```

User may adjust within 20–20,000 Hz.

#### Bass/rattle mode

Use the Bass Test shared primitive with default 40–120 Hz slow sweep.

#### Result

User-observed:

```text
missing channel
distortion
rattle
imbalance
phase-image difference
```

No automatic speaker-health verdict.

---

### 4. Headphone Test

#### Job

Check ear-specific channel behavior, range and rattles.

#### Modes

```text
Left
Right
Both
Phase
Sweep
Bass/rattle
```

Channel and phase signals use shared primitives.

Sweep default:

```text
20 Hz → 20,000 Hz
15 s
logarithmic
```

Bass/rattle default:

```text
20–120 Hz
```

#### Result

User-observed only.

No burn-in/8D/quality score.

---

### 5. Stereo Test

#### Job

Check separation, center and panning.

#### Controls

```text
Left
Center
Right
L → R
R → L
```

Static channel tests use the shared 500 Hz burst.

```text
Left   → shared Left
Center → shared Both
Right  → shared Right
```

`Center` does not use `StereoPannerNode` center pan; it is the explicit shared Both routing primitive.

Pan sweep:

```text
500 Hz sine
4 s
linear pan from -1 → +1 or reverse
```

#### Visual

Signal moves on a left-center-right track with a short trail.

---

### 6. Phase / Polarity Test

#### Job

Compare correlated in-phase and inverted playback.

#### Signal

Use a deterministic/reusable pink-noise segment so only phase relationship changes between comparisons.

#### Controls

```text
In phase
Inverted
A/B toggle
Stop
```

#### A/B switching

Keep the same pink-noise buffer and playback position.

```text
right gain → 0 over 25 ms
change sign
0 → target sign over 25 ms
```

Do not restart/regenerate the source for A/B.

#### Result

Explain expected perceptual difference without diagnosing physical wiring.

---

### 7. Surround Sound Test

#### Job

Test standardized 5.1 speaker-channel routing when exposed by the browser/device, and provide a clearly separated experimental custom 8-channel mode when available.

#### Runtime capability negotiation

`maxChannelCount` is only a capability ceiling.

5.1 candidate:

```text
destination.maxChannelCount >= 6
```

Then attempt inside `try/catch`:

```text
destination.channelCountMode = "explicit"
destination.channelInterpretation = "speakers"
destination.channelCount = 6
```

Confirm by reading back:

```text
destination.channelCount === 6
destination.channelCountMode === "explicit"
destination.channelInterpretation === "speakers"
```

Only then expose active standardized 5.1 controls.

If configuration throws or readback does not match:

```text
5.1 unavailable
→ Stereo spatial preview
```

Experimental 8-channel candidate:

```text
destination.maxChannelCount >= 8
```

Attempt:

```text
destination.channelCountMode = "explicit"
destination.channelInterpretation = "discrete"
destination.channelCount = 8
```

Confirm all three values by readback before exposing raw Channel 1–8 controls.

Candidate capability is never treated as confirmed runtime capability.

#### Standardized 5.1 mode

Configure:

```text
destination.channelCount = 6
destination.channelCountMode = "explicit"
destination.channelInterpretation = "speakers"
```

Use the Web Audio 5.1 ordering:

```text
0 Front Left
1 Front Right
2 Center
3 LFE
4 Surround Left
5 Surround Right
```

The UI may use user-friendly labels, but it must not redefine the standardized ordering.

#### Experimental 8-channel mode

This is **not** called guaranteed “7.1”.

Configure:

```text
destination.channelCount = 8
destination.channelCountMode = "explicit"
destination.channelInterpretation = "discrete"
```

The UI label is:

```text
Experimental 8-channel
```

Channels are exposed as:

```text
Channel 1
Channel 2
...
Channel 8
```

Optional speaker-position labels may be shown only after explicit browser/OS/device validation proves a stable mapping for a supported configuration.

The Web Audio specification does not standardize a universal 7.1 speaker layout.

#### Channel-merger rule

`ChannelMergerNode` preserves input order but does not infer semantic speaker identity.

Build the graph explicitly.

#### Test signal

5.1 non-LFE channels:

```text
500 Hz sine burst
700 ms
```

LFE:

```text
80 Hz sine burst
700 ms
```

Experimental 8-channel mode uses the standard non-LFE test burst for each raw channel.

#### User interaction

Initial mode:

```text
confirmed 5.1 available
→ default to 5.1

otherwise
→ Stereo spatial preview
```

Experimental 8-channel is never the automatic default.

When confirmed, mode selector may offer:

```text
5.1
Experimental 8-channel
Stereo spatial preview
```

Switching mode:

```text
Stop active sequence
→ teardown/restore current routing
→ negotiate/configure target mode
→ render only after confirmed readback
```

5.1 individual controls:

```text
Front Left
Front Right
Center
LFE
Surround Left
Surround Right
Test All
Stop
```

5.1 `Test All` order:

```text
Front Left
→ Front Right
→ Center
→ LFE
→ Surround Left
→ Surround Right
```

Each burst:

```text
700 ms
```

Gap:

```text
300 ms
```

Experimental 8-channel controls:

```text
Channel 1 ... Channel 8
Test All
Stop
```

`Test All` order is Channel 1 → Channel 8 with the same 700 ms burst / 300 ms gap.

Stereo spatial preview controls:

```text
Left
Center
Right
L → R
R → L
Stop
```

Fallback uses the shared stereo primitives and never displays surround speaker labels.

#### Destination cleanup

Store the prior destination channel configuration before the test when mutation is supported/needed.

On teardown:

```text
stop sources
disconnect merger/routing nodes
attempt to restore the prior destination configuration
verify readback
```

If restoration fails, dispose the tool-local `AudioSession` entirely.

The next Start creates a fresh AudioContext rather than reusing an uncertain destination configuration.

#### Stereo fallback

Name:

```text
Stereo spatial preview
```

Implementation:

```text
ordinary stereo panning only
```

Do not label this as 5.1, 7.1, HRTF surround or physical channel verification.

---

### 8. Bass / Subwoofer Test

#### Job

Explore low-frequency playback and audible rattles/resonances.

#### Range

```text
20–200 Hz
```

Presets:

```text
20
30
40
50
60
80
100 Hz
```

#### Modes

```text
single tone
slow sweep
preset sequence
```

Single tone:

```text
sine wave
initial frequency: 60 Hz
continuous until explicit Stop
frequency and preset edits apply live while playing
```

The single-tone frequency control uses the nominal 20–200 Hz Bass range and the shared runtime frequency cap.

All Bass Test generated tones and sweeps use a sine source.

Default sweep:

```text
20 → 120 Hz
12 s
logarithmic
```

Preset sequence:

```text
20 → 30 → 40 → 50 → 60 → 80 → 100 Hz
800 ms per tone
300 ms silence between tones
50 ms ramps
```

Show:

```text
Keep playback volume moderate. If you cannot hear a low tone, do not turn the system volume up to compensate.
```

Core v1 does not generate sub-20 Hz tones.

No measured frequency-response claim.

---

### 9. Frequency Sweep Test

#### Job

Play a controlled frequency sweep.

#### Controls

```text
low frequency
high frequency
duration
linear/logarithmic
direction: Ascending / Descending
Play/Stop
```

Defaults:

```text
low 20 Hz
high 20,000 Hz
15 s
logarithmic
Ascending
```

Semantics:

```text
Ascending → low → high
Descending → high → low
```

`low` must remain <= `high`.

Allowed duration:

```text
5–60 s
```

Result is listening-based only.

---

### 10. Noise Generator

#### Job

Generate reference noise.

#### Modes

```text
white
pink
brown
```

#### Controls

```text
noise type
level
Play/Stop
timer: Off / 1 / 5 / 10 min
```

When any timed duration is selected, show beside the timer:

```text
Long playback: keep device/headphone volume at a comfortable level.
```

#### v1 noise buffers

All deterministic reference/noise PCM is generated at the canonical rate:

```text
44,100 Hz
```

The fixed pink-noise coefficients below are the v1 reference implementation at this canonical rate.

Pure NoiseEngine generation functions do not use the current AudioContext rate.

Create the resulting `AudioBuffer` with:

```text
sampleRate = 44100
```

Web Audio may resample that buffer during playback into a context with another rate.

This keeps the fixed pink/brown coefficients reproducible across devices.

Generate reusable local `AudioBuffer` data rather than unbounded realtime history.

Noise Generator buffer duration:

```text
8 s
loop = true
```

Noise Generator uses one mono reference-noise source duplicated identically to Left and Right.

Do not generate independent random L/R noise in core v1.

Phase Test correlated pink-noise buffer duration:

```text
4 s
loop = true during A/B playback
```

#### Deterministic PRNG

Use `xorshift32` with non-zero 32-bit state.

For each generated sample:

```text
x ^= x << 13
x ^= x >>> 17
x ^= x << 5
uint = x >>> 0
white = (uint / 2147483647.5) - 1
```

Stable v1 seeds:

```text
white generator: 0xA341316C
pink generator:  0xC8013EA4
brown generator: 0xAD90777D
phase pink:      0x7E95761E
```

#### White noise

Use PRNG `white` directly.

#### Pink noise

Apply these exact Paul-Kellet-style filter coefficients per sample:

```text
b0 = 0.99886 * b0 + white * 0.0555179
b1 = 0.99332 * b1 + white * 0.0750759
b2 = 0.96900 * b2 + white * 0.1538520
b3 = 0.86650 * b3 + white * 0.3104856
b4 = 0.55000 * b4 + white * 0.5329522
b5 = -0.7616 * b5 - white * 0.0168980

pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
b6 = white * 0.115926
```

Do not add an arbitrary output multiplier before normalization.

#### Brown noise

Use:

```text
state = 0.98 * state + 0.02 * white
brown = state
```

Then remove the generated buffer's DC mean before peak normalization.

#### Loop-boundary conditioning

For looping white/pink/brown buffers:

```text
boundarySamples = max(16, round(sampleRate * 0.010))
```

Over the final boundary samples, linearly move the waveform toward the first sample so the final sample equals the first sample.

This is click-reduction conditioning, not a spectral-quality claim.

#### Phase correlation

Phase Test uses the exact same generated 4 s pink buffer for both channels.

The inverted state changes only:

```text
right channel multiplier: +1 → -1
```

The source buffer itself must not be regenerated between A/B states.

#### Normalization

After generation:

```text
remove DC mean where applicable
scan peak absolute sample
scale buffer so source peak <= 0.8
```

Then apply the shared master digital Level control.

Do not rely on raw algorithm amplitude.

These are practical reference-noise generators, not laboratory spectral standards.

---

### 11. Microphone Test

#### Job

Verify capture, level, waveform and short recording playback.

#### Flow

```text
Start microphone
→ permission
→ enumerate available inputs
→ choose input when >1 input is available
→ live waveform + meters
→ optional record
→ local playback
```

#### Capture preference

For diagnostic/analysis tools, request where supported:

```text
echoCancellation: false
noiseSuppression: false
autoGainControl: false
```

Then inspect actual track settings and display them in Details.

Browsers may ignore constraints; do not claim they are disabled unless settings confirm it.

#### Primary outputs

```text
live waveform
RMS dBFS
peak dBFS
selected input name when available
```

#### Meter algorithm

Use a dedicated time-domain analyser for level metering.

Use the Web Audio processing rate:

```text
analysisSampleRate = audioContext.sampleRate
windowSamples = ceil(analysisSampleRate * 0.100)
meterFftSize = nextPowerOfTwo(windowSamples)
meterFftSize = clamp(meterFftSize, 2048, 32768)
```

Do not use `track.getSettings().sampleRate` for downstream meter math.

At each 10 Hz meter update:

1. call `getFloatTimeDomainData()` on the meter analyser;
2. use the most recent `windowSamples` samples from the returned buffer;
3. compute:

```text
rms = sqrt(sum(sample^2) / N)
peak = max(abs(sample))
epsilon = 1e-5

rmsDbfs = max(-100, 20 * log10(max(rms, epsilon)))
peakDbfs = max(-100, 20 * log10(max(peak, epsilon)))
```

Display floor:

```text
-100 dBFS
```

This meter algorithm is independent from Spectrum Analyzer's FFT/display settings.

#### Meter timing

```text
RMS window: 100 ms
UI update: 10 Hz
peak hold: 1000 ms
peak decay after hold: 20 dB/s
```

#### Input-device switching

Input selector behavior is executable, not advisory.

While recording:

```text
input selector disabled
```

Selected-device acquisition uses:

```ts
audio: {
  deviceId: { exact: selectedDeviceId },
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false
}
```

Only include processing-constraint names that `getSupportedConstraints()` reports as recognized.

Do not replace selected-device `exact` semantics with `ideal`.

While only live monitoring/analyzing:

1. request a new stream with `deviceId: { exact: selectedDeviceId }` while the current stream remains active;
2. if acquisition fails, keep the old stream active and show the selection error;
3. if acquisition succeeds:
   - disconnect old `MediaStreamAudioSourceNode`;
   - stop all old stream tracks;
   - connect the new source to analysis/recorder branches;
   - read fresh `getSettings()`;
   - reset waveform/RMS/peak state;
   - restore calibration only for the new matching `deviceId`;
4. no stale values from the old input remain visible as current.

If the active track fires `ended` or disappears:

```text
stop live analysis
clear/mark stale meter values
state = Input device disconnected
refresh device list
require explicit restart/selection
```

`devicechange` refreshes available device metadata; it does not silently switch the active device.

#### Recording

```text
max one recording: 15 s
local MediaRecorder blob
replace/cleanup previous object URL
```

#### MediaRecorder MIME negotiation

Never hardcode `audio/webm`.

Try candidates in this order:

```text
audio/webm;codecs=opus
audio/ogg;codecs=opus
audio/mp4
```

For each candidate:

1. skip it if `MediaRecorder.isTypeSupported(candidate)` is false;
2. otherwise try `new MediaRecorder(stream, { mimeType: candidate })`;
3. if construction throws, continue to the next candidate.

If all explicit candidates fail, try `new MediaRecorder(stream)` without explicit MIME.

After success, `recorder.mimeType` is authoritative.

If every construction path fails, live mic/waveform/meter remains available and only the recording subsection becomes unavailable.

Recording is optional if MediaRecorder is unsupported.

#### Recording lifecycle

Start recording:

```text
chunks = []
construct negotiated recorder
attach dataavailable + stop listeners
recorder.start()
start 15,000 ms auto-stop timer
state = recording
```

`dataavailable`:

```text
append only non-empty Blob data
```

Auto-stop at 15 s:

```text
call recorder.stop()
clear timer
do NOT stop the live microphone stream
```

When recorder emits `stop`:

```text
final dataavailable has already been delivered
→ Blob(chunks, { type: recorder.mimeType })
→ revoke previous object URL
→ create new object URL
→ state returns to live microphone
```

Explicit `Stop recording` performs the same finalization and leaves live mic analysis active.

If the **tool-wide Stop** is pressed while recording:

1. call `recorder.stop()`;
2. await recorder `stop` finalization;
3. maximum wait = 1500 ms;
4. then stop MediaStream tracks / analysis resources;
5. if finalization times out or errors, discard incomplete recording and continue deterministic teardown.

Never stop the active MediaStream tracks before giving the recorder its normal finalization opportunity.

---

### 12. Spectrum Analyzer


Active state always exposes the shared `Stop` control.
#### Job

Visualize relative frequency content from microphone input.

#### Views

```text
Spectrum
Waveform
Spectrogram
```

#### Baseline analysis settings

Default:

```text
fftSize: 2048
smoothingTimeConstant: 0.8
```

Canonical frequency-data API:

```text
AnalyserNode.getFloatFrequencyData()
```

The returned array is treated as frequency-bin values in dB.

Display clamp:

```text
-100 dB → -20 dB
```

`AnalyserNode.minDecibels/maxDecibels` are not used as the semantic source of the float-data display range; they primarily define scaling behavior for byte-frequency output.

Selectable FFT sizes:

```text
1024
2048
4096
8192
```

#### Display range

```text
20 Hz → min(20,000 Hz, Nyquist)
```

Spectrum x-axis:

```text
logarithmic
```

Level axis:

```text
relative dB from analyser data
```

#### Dominant frequency

If displayed:

- ignore bins below 40 Hz for ordinary dominant-frequency label;
- choose strongest bin in displayed range;
- label as dominant FFT bin/frequency, not pitch.

#### Render budget

```text
Spectrum/Waveform: <= 60 fps
Spectrogram: <= 30 fps
```

Spectrogram uses a bounded rolling canvas representation, not an unbounded JS frame history.

Canonical visible history:

```text
10 seconds
```

Each retained column stores:

```text
timestampMs
frequency-bin data needed for drawing
```

Column sampling:

```text
maximum 30 columns / second
hard capacity = 300 columns
```

Eviction rule on every ingest/render:

```text
remove columns where nowMs - timestampMs > 10_000
then enforce hard capacity <= 300
```

Time mapping:

```text
left boundary  = nowMs - 10_000
right boundary = nowMs
x = (timestampMs - leftBoundary) / 10_000 * canvasWidth
```

If cadence drops, gaps remain gaps in time.

Do not stretch 150 retained columns to imply a full dense 300-column history, and do not synthesize missing columns.

---

### 13. Pitch Detector


Active state always exposes the shared `Stop` control.
#### Job

Estimate monophonic musical pitch from mic input.

#### Baseline algorithm

Use **YIN** as the v1 algorithm.

Do not ship strongest-FFT-bin pitch detection as the primary algorithm.

#### Analysis parameters

```text
target: 50–2000 Hz
YIN threshold: 0.10
minimum confidence: 0.80
A4: 440 Hz
```

#### Bounded analysis rate

```text
contextRate = audioContext.sampleRate
downsampleFactor = ceil(contextRate / 48000)
analysisRate = contextRate / downsampleFactor
```

When `downsampleFactor > 1`, average each consecutive source-sample group into one output sample and discard an incomplete trailing group.

This fixed v1 decimator is for the limited 50–2000 Hz target.

```text
frameSize = nextPowerOfTwo(2 * analysisRate / 50)
```

Run YIN at no more than 20 analyses / second.

Never run full YIN on every animation frame.

#### Bounded tau search

```text
tauMin = floor(analysisRate / 2000)
tauMax = ceil(analysisRate / 50)
```

Do not calculate/use lag values outside this range.

#### YIN refinement and confidence

Use CMNDF, then parabolic interpolation around the selected tau when neighbors exist.

```text
frequencyHz = analysisRate / refinedTau
confidence = clamp(1 - cmndf[selectedTau], 0, 1)
```

Reject frequency outside 50–2000 Hz or confidence < 0.80.

#### Note mapping

```text
midiFloat = 69 + 12 * log2(frequencyHz / 440)
nearestMidi = round(midiFloat)
noteFrequency = 440 * 2^((nearestMidi - 69) / 12)
cents = 1200 * log2(frequencyHz / noteFrequency)
```

Map `nearestMidi` to note name + octave.

#### Stabilization

Maintain the last 5 accepted pitch estimates.

Display the median of the accepted window.

Mark result stable when at least 3 consecutive accepted frames are within 25 cents of the current median.

#### Output

```text
frequency Hz
nearest note
cents deviation
confidence/stability
```

If below confidence threshold:

```text
Listening…
Signal too weak or unstable
```

No random note output.

---

### 14. Decibel / Sound Meter


Active state always exposes the shared `Stop` control.
#### Job

Show digital mic level and optional user-calibrated SPL estimate.

#### Default meter

Use the same meter timing as Microphone Test:

```text
RMS window: 100 ms
update: 10 Hz
peak hold: 1000 ms
peak decay: 20 dB/s
```

Default output:

```text
RMS dBFS
Peak dBFS
```

#### Calibration eligibility

Read actual track settings with:

```text
MediaStreamTrack.getSettings()
```

Reference-calibrated estimate mode is eligible only when all three are explicitly reported as `false`:

```text
autoGainControl === false
noiseSuppression === false
echoCancellation === false
```

If any value is:

```text
true
or missing/unknown
```

disable reference-calibrated estimate mode and continue showing dBFS only.

Do not use a warning-only path for active input processing in v1.

#### Calibration capture

Calibration is offered only after the user confirms the external reference meter is set to:

```text
Z / Flat / Linear weighting
```

A/C-weighted readings are not accepted in v1.

The external meter and browser microphone should observe the same stable sound field.

Then collect a 3 second calibration window using the normal 10 Hz RMS meter:

```text
30 RMS dBFS samples
```

Reject calibration if:

```text
fewer than 25 valid samples
any peak exceeds -1 dBFS
sample standard deviation > 1.5 dB
```

Calibration measurement:

```text
measuredCalibrationDbfs = median(validRmsDbfsSamples)
offset = reference_dB_SPL - measuredCalibrationDbfs
```

Estimated display after calibration:

```text
estimatedLevelDb = current_RMS_dBFS + offset
```

Label:

```text
Reference-calibrated level estimate
User-calibrated
```

Show:

```text
One-point reference calibration. This does not calibrate microphone frequency response. Recalibrate after changing microphone, system input gain, processing, position or reference conditions.
```

#### Device-scoped persistence

Calibration belongs to the current physical/logical input, not globally to the site.

Preferred calibration key source:

```text
track.getSettings().deviceId
```

If no stable device ID is available:

```text
allow session-only calibration
do not persist across reload/device changes
```

Persistent storage key:

```text
browserAudioLab.dbCalibration.v2
```

Stored shape:

```text
byDeviceId[deviceId] = {
  offset,
  createdAt,
  optionalLabel
}
```

When the selected input changes:

```text
load calibration only for the matching deviceId
otherwise show Uncalibrated
```

Provide:

```text
Reset current-device calibration
```

Never sync calibration to a server in core v1.

---

### 15. Audio Latency / AV Sync

#### Job

Expose browser-reported latency and allow manual audiovisual synchronization adjustment.

#### Browser-reported section

Display when available:

```text
baseLatency
outputLatency
```

Web Audio reports these values in **seconds**.

Convert:

```text
displayMilliseconds = apiValueSeconds * 1000
```

Display milliseconds with one decimal place.

If unavailable:

```text
Not reported by this browser
```

#### Manual AV sync

Generate:

```text
small localized visual pulse + short click
every 1000 ms
```

Pulse:

```text
~100 ms opacity/luminance change
not full-screen
no rapid multi-flash sequence
```

Reduced-motion mode keeps timing without spatial/scale motion.

Offset control:

```text
-300 ms → +300 ms
5 ms steps
default 0
```

Sign convention:

```text
positive value
→ audio click occurs after the visual flash

negative value
→ audio click occurs before the visual flash
```

Example:

```text
+50 ms = audio 50 ms after flash
-50 ms = audio 50 ms before flash
```

The implementation and UI copy must use this convention.

#### Manual AV scheduling clock

Do not implement offset by reacting to one event after it fires.

At Start:

```text
periodMs = 1000
leadInMs = 500
perfAnchorMs = performance.now()
audioAnchorSec = audioContext.currentTime
cycleIndex = 0
```

For cycle `n`:

```text
visualTargetPerfMs =
  perfAnchorMs + leadInMs + n * periodMs

audioTargetContextSec =
  audioAnchorSec
  + (leadInMs + n * periodMs + offsetMs) / 1000
```

Because `leadInMs = 500` and minimum offset is `-300 ms`, the first audio event is still schedulable in the future.

Audio click:

```text
schedule against AudioContext.currentTime / AudioParam source timing
```

Visual pulse:

```text
arm with setTimeout before visualTargetPerfMs
→ use requestAnimationFrame until performance.now() reaches/passes visualTargetPerfMs
→ render one ~100 ms pulse
```

Use a bounded lookahead scheduler:

```text
scheduler tick <= 100 ms
schedule horizon >= 1500 ms
```

Track cycle IDs so the same click/pulse is never scheduled twice.

On offset change:

```text
cancel future unsounded cycle scheduling
choose a fresh future anchor
restart sequence without changing the documented sign convention
```

On Stop:

```text
cancel scheduler timer
cancel visual RAF
stop/disconnect scheduled audio sources
clear pending cycle IDs
```

Visibility behavior:

```text
document becomes hidden
→ Stop/reset the manual AV sequence immediately

document becomes visible again
→ remain idle
→ require explicit Start
```

Do not attempt to continue or reconstruct the timing sequence across background-tab throttling.

This creates a common monotonic plan for both negative and positive offsets; it does not claim exact DOM/audio hardware synchronization.

Result:

```text
Your selected sync offset: X ms
```

The 5 ms step is **control granularity**, not a ±5 ms accuracy claim.

Browser-reported latency values may be formatted to one decimal millisecond for readability; that display precision is not a physical accuracy guarantee.

This manual result is perception-based.

---

### 16. Hearing Frequency Test

#### Job

Provide a non-clinical user-observed high-frequency hearing exploration.

#### Setup

Before high-frequency steps:

1. play a 1 kHz reference burst at the hearing-test default Level;
2. ask the user to set device/system volume to a **low comfortable level**;
3. show: `Keep this system volume unchanged for the rest of the test. Do not turn it up to hear higher tones.`;
4. keep Stop visible.

Reference:

```text
1000 Hz
1000 ms
Level = -36 dB relative to unity
50 ms ramps
```

After the user sets a low comfortable **system/device** volume and starts Guided mode:

```text
app Level is locked at -36 dB
system/device volume is instructed to remain unchanged
```

The guided frequency observations are therefore made at one fixed app Level.

#### Guided mode

Nominal sequence:

```text
2000
4000
6000
8000
10000
12000
14000
16000
18000
20000 Hz
```

Remove/disable steps above `effectiveMaxHz`.

Each tone:

```text
800 ms
Level = -36 dB relative to unity
50 ms ramps
```

Then:

```text
I heard it
I didn't hear it
Stop
```

Do not auto-repeat or auto-increase Level/system volume.

#### Manual mode

```text
Play tone
→ 800 ms burst
→ ready
```

No continuous/hold-to-play hearing tone.

Level:

```text
-60 dB → -24 dB relative to unity
default -36 dB
```

Manual mode is exploratory only.

Changing Level in Manual mode invalidates any threshold comparison, so Manual mode does not update the Guided result.

#### Result

Only:

```text
Highest frequency you reported hearing in this session
```

Do not call it a full hearing range.

No normality, hearing age, diagnosis or audiogram claim.

#### Limitations

Depends on speaker/headphone response, processing, system volume, environment and individual perception.

This is not a calibrated audiogram.

### Hearing-frequency capability note

The guided frequency list is nominal.

Before playback, remove/disable any guided step above the shared `effectiveMaxHz`.

If the current context cannot generate the full nominal range, show:

```text
This browser/audio context supports generated tones up to approximately X Hz in this session.
```

Do not interpret a missing >Nyquist step as a hearing result.


### Shared microphone input-selection contract

Applies to:

```text
Microphone Test
Spectrum Analyzer
Pitch Detector
Decibel Meter
```

After permission, enumerate inputs.

If more than one usable input is available, show the same shared input selector on each page.

Selecting a device always uses the exact-device acquisition and atomic handoff rules defined under Microphone Test.

For a first/default start with no explicit user selection, the browser default input may be requested.

Once the user explicitly selects a device, do not silently fall back to another device if exact acquisition fails.

### Shared microphone graph rule

Microphone Test, Spectrum Analyzer, Pitch Detector and Decibel Meter:

```text
MediaStreamAudioSourceNode
→ analyser/recorder branches
```

Never live-route microphone source to `AudioContext.destination`.

Microphone Test playback uses the completed recording Blob/object URL only after explicit Play.

### Shared analysis-rate rule

For PCM/FFT/pitch after a Web Audio source node:

```text
analysisSampleRate = audioContext.sampleRate
```

`track.getSettings().sampleRate` may be displayed as technical metadata but is not the downstream analysis rate.