# 07 — Browser Capabilities and Fallbacks

## Browser baseline

Target current evergreen:

```text
Chrome / Chromium
Edge
Firefox
Safari
iOS Safari
Android Chromium
```

No legacy-browser compatibility work.

Use feature detection, not normal UA sniffing.

Exact minimum versions are a pre-release task.

## Secure context

Mic/device APIs require secure context in production.

## AudioContext

Handle autoplay/suspended state.

Audible playback begins only after meaningful user interaction.

## OscillatorNode

Baseline oscillator types:

```text
sine
square
triangle
sawtooth
```

## GainNode

Used for digital level and safe ramps.

## StereoPannerNode

Use when available.

If a target browser exposes a compatibility issue, preserve product semantics with an equivalent channel strategy.

## AnalyserNode

Used for:

```text
waveform
RMS/peak input buffers
FFT
spectrum
spectrogram
```

## getUserMedia

Required for mic-based tools.

Handle:

```text
granted
denied
no device
device removed
generic capture error
```

Diagnostic mic tools should prefer constraints:

```text
echoCancellation: false
noiseSuppression: false
autoGainControl: false
```

but must inspect actual settings because browsers/devices may ignore them.

## enumerateDevices

Device labels may be hidden before permission.

UI must tolerate this.

## MediaRecorder

Optional subsection for Microphone Test.

If unsupported:

```text
live mic/waveform/meter still works
record/playback is unavailable
```

## baseLatency / outputLatency

Browser-reported information only.

Unavailable values remain unavailable.

Never fabricate them.

## getOutputTimestamp

Deferred optional enhancement.

It is not required by the v1 Audio Latency / AV Sync baseline and should not create a service/API abstraction until a future task explicitly adds it.

## Output-device selection / setSinkId

Deferred from core v1.

System-default output is the baseline.

Do not create `OutputDeviceSelector` infrastructure during P0–P6.

## maxChannelCount

Used to determine whether standardized 5.1 and/or experimental custom multichannel output is a candidate.

```text
>= 8 → allow standardized 5.1 + experimental raw 8-channel option
>= 6 → allow standardized 5.1 option
< 6 → discrete surround unavailable
```

Do not interpret `>= 8` as proof of a standardized universal 7.1 layout.

This does not prove physical speaker wiring.

## ChannelMergerNode

Used with discrete channel interpretation for surround routing.

## Canvas

Preferred for high-frequency realtime visualization.

Drawing-buffer DPR cap:

```text
2
```

## SVG

Preferred for lower-frequency/static/semi-dynamic illustrations.

## Visibility

Decorative animation should pause/reduce when hidden.

User-critical recording behavior must not be silently changed solely for decoration.

## Capability wording

Differentiate:

```text
browser/API limitation
```

from:

```text
physical hardware problem
```

## Nyquist-safe generated-frequency limit

All generated-frequency tools derive their session maximum from the actual `AudioContext.sampleRate`:

```text
nyquistHz = sampleRate / 2
effectiveMaxHz = min(toolNominalMaxHz, floor(0.95 * nyquistHz))
```

The 0.95 margin prevents controls from sitting directly at Nyquist.

Expose the reduced capability to the tool/UI when it matters.

## Surround destination configuration

`AudioDestinationNode.channelCount` defaults to 2 in normal Web Audio contexts.

Therefore `maxChannelCount >= 6` is not sufficient by itself.

For standardized 5.1 candidate playback explicitly configure:

```text
destination.channelCount = 6
destination.channelCountMode = "explicit"
destination.channelInterpretation = "speakers"
```

Web Audio standardizes mono, stereo, quad and 5.1 speaker layouts.

It does **not** define a universal 7.1 speaker layout.

If `maxChannelCount >= 8`, the product may expose only an experimental custom 8-channel discrete mode unless real supported mapping evidence is added later.

## Actual capture settings

Requested `getUserMedia()` constraints are preferences/capabilities, not proof of the final track state.

Use:

```text
MediaStreamTrack.getSettings()
```

to inspect current values such as:

```text
deviceId
autoGainControl
echoCancellation
noiseSuppression
sampleRate
channelCount
```

Unsupported/unreported settings remain unknown; do not infer them from the request.

## MediaRecorder format portability

Presence of `MediaRecorder` does not imply one universal container/codec.

Use `MediaRecorder.isTypeSupported()` for the v1 candidate list from `03_TOOL_SPECS.md`.

Never assume WebM on Safari or MP4 on Chromium.

The recorder's actual `mimeType` after construction is authoritative for the local recording Blob.

## AudioContext construction

Core v1 constructs:

```ts
new AudioContext({ latencyHint: "interactive" })
```

Do not pass `sampleRate`.

Actual processing rate:

```text
audioContext.sampleRate
```

If a MediaStream track rate differs, Web Audio resamples the source before downstream processing.

Use track `sampleRate` only as reported capture metadata.

## Mic monitor prohibition

Mic-based tools never connect live `MediaStreamAudioSourceNode` output to the audible destination.

Future mic monitoring requires a separate explicit product/safety decision.

## Confirmed multichannel capability

Do not expose 5.1/8-channel controls from `maxChannelCount` alone.

Runtime support is confirmed only after:

```text
candidate maxChannelCount
→ attempt destination configuration
→ read back actual channelCount/channelCountMode/channelInterpretation
```

Any thrown setter or mismatched readback falls back to Stereo spatial preview.

## Capture-constraint capability

Use:

```text
navigator.mediaDevices.getSupportedConstraints()
```

to determine which constraint names the user agent recognizes.

Then use `MediaStreamTrack.getSettings()` to determine what the active track actually applies.

Supported constraint name ≠ active setting value.

## BFCache

Interactive tool entrypoints handle both:

```text
pagehide
pageshow
```

`pagehide` disposes active resources.

If `pageshow.persisted === true`, remount an idle controller and create a new AudioContext only on the next explicit Start.

## Latency units

Web Audio latency APIs expose seconds.

Normalize at the service boundary:

```text
milliseconds = seconds * 1000
```

UI code consumes `baseLatencyMs` / `outputLatencyMs` and must not reinterpret raw API units.
