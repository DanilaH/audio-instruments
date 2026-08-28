# 08 — Measurement Honesty and Safety

This is a hard product boundary.

## Evidence classes

### A — Browser-known / directly generated

Examples:

```text
requested oscillator frequency
waveform type
digital channel target
captured PCM/FFT data
computed dBFS
```

### B — Browser-reported / estimated

Examples:

```text
baseLatency
outputLatency
track settings
reported device sample rate
channel count
```

### C — User-observed physical behavior

Examples:

```text
speaker rattle
audible roll-off
phase perception
hearing response
manual AV sync
```

Never promote B or C into stronger physical certainty.

## Generated Level semantics

`Level` means:

> master digital gain in dB relative to unity.

It is not acoustic volume, SPL, universal perceived loudness, or guaranteed resulting dBFS.

```text
gain = 10^(dB / 20)
```

General:

```text
default -24 dB
maximum -12 dB
```

Hearing:

```text
default -36 dB
maximum -24 dB
```

Different source waveforms/noise have different RMS/perceived loudness at the same master gain.

## Headroom and ramps

Normalize every generated source before master gain.

Preserve worst-case headroom when sources sum into one channel.

Do not intentionally clip or hide bad normalization behind a compressor/limiter.

Generated audible signals use approximately 50 ms fade-in/out unless a stricter tool rule exists.

## Mic feedback prohibition

Core mic tools use:

```text
MediaStreamSource
→ analyser / meter / recorder
```

Never:

```text
MediaStreamSource
→ AudioContext.destination
```

Recorded audio may be played later only after explicit user action.

## Analysis sample rate

When mic audio enters Web Audio, it is resampled to the AudioContext rate when necessary.

Downstream PCM/FFT/pitch math therefore uses:

```text
AudioContext.sampleRate
```

Track `sampleRate` remains browser-reported capture metadata only.

## dBFS meter

Use the exact 100 ms PCM RMS/peak algorithm from `03_TOOL_SPECS.md`.

Display floor:

```text
-100 dBFS
```

Do not derive meter values from visualization byte values.

## dBFS vs dB SPL

```text
dBFS = digital signal level
dB SPL = physical acoustic sound-pressure level
```

Generic browser mic input does not provide trustworthy absolute SPL without reference calibration.

## Optional reference calibration

The external reference meter must be configured to:

```text
Z weighting
Flat
or Linear
```

If only dBA/A-weighting or dBC/C-weighting is available, v1 does not accept that reference.

Calibration eligibility requires active track settings to explicitly report:

```text
autoGainControl === false
noiseSuppression === false
echoCancellation === false
```

Any true or unknown/missing value disables reference-calibrated estimate mode.

Calibration capture uses the stable 3 second process in `03_TOOL_SPECS.md`.

Result label:

```text
Reference-calibrated level estimate
User-calibrated
```

Never claim accurate/professional/calibrated-dBA measurement, and do not describe the browser measurement chain itself as truly Z-weighted or unweighted.

One-point calibration does not correct microphone frequency response.

Recalibrate after changing input device, system/hardware mic gain, processing, mic position, or reference/source conditions.

Persist calibration only for the matching device identity.

## Spectrum, pitch, latency, surround and phase

Spectrum = relative digital frequency energy, not calibrated acoustic response.

Pitch = estimate; weak/unstable input produces uncertainty.

`baseLatency`/`outputLatency` = browser-reported/estimated, not exact end-to-end hardware latency.

Standardized speaker semantics are used only for 5.1. Experimental 8-channel mode exposes raw discrete channels.

Digital routing does not prove physical speaker placement/wiring.

Phase comparison does not automatically diagnose reversed physical wiring.

## Hearing-test setup

Before high-frequency playback:

1. play the documented 1 kHz reference at the low hearing-test Level;
2. ask the user to set device/system volume to a **low comfortable level**;
3. tell the user to keep that system volume unchanged;
4. use finite tone bursts only;
5. keep Stop immediately available.

A tone unavailable because of Nyquist/capability limits is unavailable, not “unheard”.

Guided result wording:

```text
Highest frequency you reported hearing in this session
```

No hearing age, normal/abnormal, diagnosis, clinical range or audiogram claim.

## Bass safety

Core v1 Bass/Subwoofer range:

```text
20–200 Hz
```

Sub-20 Hz stress testing is out of scope.

Show:

```text
Keep playback volume moderate. If you cannot hear a low tone, do not compensate by turning the system volume up.
```

An inaudible low tone is not automatically speaker failure.

## AV Sync visual safety

Use a small localized timing pulse at 1 Hz.

Do not use full-screen flashing/strobing.

Reduced motion keeps timing information while removing unnecessary movement.

## Prohibited claims

```text
zero latency
perfect speaker/headphone health
exact physical speaker frequency response
exact unreference-calibrated level estimate
professional acoustic calibration
exact Bluetooth/headphone hardware latency
clinical hearing diagnosis
hearing age as medical fact
automatic physical wiring diagnosis
```

## Privacy

No hidden mic capture.

No server audio upload in core v1.

No audio-content analytics.

## Claims audit

Review titles, result/status labels, limitations, FAQ, SEO metadata and homepage claims before release.

## Global generated-audio setup

The final acoustic SPL is outside browser control.

Therefore every generated-audio tool displays before first playback:

```text
Start with your device/headphone volume low.
Increase it only to a comfortable listening level.
Do not turn the volume up to compensate for a tone you cannot hear.
```

This is required even when the app Level is digitally capped.

## Hearing guided Level consistency

Guided mode fixes app Level at:

```text
-36 dB relative to unity
```

after the reference setup.

The user is instructed to keep system/device volume unchanged.

Manual exploration may use the documented Level range, but its observations are not merged into the Guided threshold-like result.

## Reference calibration claim boundary

Z/Flat/Linear is a requirement for the **external reference instrument**.

One scalar offset does not transform an arbitrary browser microphone chain into a Z-weighted/flat measurement system.

Therefore the product label remains:

```text
Reference-calibrated level estimate
```

with:

```text
One-point reference calibration
```
