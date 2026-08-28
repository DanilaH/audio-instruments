# 06 — Architecture

## Rendering model

```text
Astro static output
ordinary MPA routing
```

No SSR.

No React/Vue/Svelte islands.

Ship client JS only where the tool needs browser behavior.

## Package/runtime

```text
pnpm
Active LTS Node pinned in .nvmrc
matching package.json engines.node
strict TypeScript
```

## Required module boundaries

Required core browser/service boundaries:

```text
AudioSession
AudioOutputEngine
NoiseEngine
MicrophoneService
AudioAnalyzer
AudioRecorder
AudioLatencyReader
MultichannelOutput
```

## Suggested source structure

```text
src/
├── browser/
│   ├── audio-output/
│   ├── noise/
│   ├── microphone/
│   ├── analysis/
│   ├── recording/
│   ├── latency/
│   └── multichannel/
├── components/
│   ├── controls/
│   ├── feedback/
│   ├── layout/
│   └── visualizations/
├── tools/
│   ├── tone-generator/
│   ├── speaker-test/
│   └── ...
├── pages/
├── registry/
├── styles/
└── utils/
```

## Import boundaries

These are enforceable architecture rules.

```text
src/browser/*
MAY import:
  browser/*
  utils/*

MUST NOT import:
  tools/*
  components/*
  pages/*
  registry/* UI metadata
```

```text
src/components/*
MAY import:
  components/*
  utils/*
  styles through normal CSS mechanisms

MUST NOT import:
  tools/*
  pages/*
  browser resource services directly
```

```text
src/tools/<tool>/*
MAY import:
  browser/*
  components/*
  registry/*
  utils/*

MUST NOT import:
  another tool's internal implementation
```

```text
src/pages/*
MAY import:
  tools/*
  components/*
  registry/*

SHOULD contain:
  composition/entrypoint logic
not browser-resource implementation
```

No circular dependencies.

Use ESLint restrictions where practical.

## Tool registry

Create one typed registry containing stable metadata:

```text
id
route
title
navigationCategory
implementationPhase
accent
status: planned | live
relatedToolIds
```

`navigationCategory` uses the homepage taxonomy.

`implementationPhase` is separate roadmap metadata.

It is not a runtime store.

Never store:

```text
AudioContext
MediaStream
live measurements
permission state
playback state
```

inside it.

## State ownership

```text
tool controller
→ interaction/product state

browser service
→ browser resource lifecycle

visualization component
→ drawing-local state
```

No global state library in core v1.

## Service responsibilities

### AudioOutputEngine

Owns output nodes/graph **inside the provided AudioContext**:

```text
oscillators
master gain
panning
phase routing primitives
sweep scheduling
safe ramps
cleanup
```

### NoiseEngine

Owns:

```text
white/pink/brown generation
deterministic correlated segment generation where required
normalization
cleanup
```

### MicrophoneService

Owns:

```text
getUserMedia
permission-aware lifecycle
input device selection
track settings
device stop/loss
```

### AudioAnalyzer

Owns:

```text
time-domain sample access
RMS
peak
dBFS
FFT
spectrogram data
```

It does not own CSS/visual styling.

### AudioRecorder

Owns:

```text
MediaRecorder
recording lifecycle
Blob/object URL cleanup
```

### AudioLatencyReader

Owns:

```text
baseLatency
outputLatency
availability normalization
```

`getOutputTimestamp()` is not part of the v1 service contract.

### MultichannelOutput

Owns:

```text
maxChannelCount
discrete channel graph
channel index routing
cleanup
```

## Tool → service dependency matrix

| Tool | Output | Noise | Mic | Analyzer | Recorder | Latency | Multichannel |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Tone Generator | ✓ |  |  |  |  |  |  |
| Sound Test | ✓ |  |  |  |  |  |  |
| Speaker Test | ✓ | ✓ |  |  |  |  |  |
| Headphone Test | ✓ | ✓ |  |  |  |  |  |
| Stereo Test | ✓ |  |  |  |  |  |  |
| Phase Test | ✓ | ✓ |  |  |  |  |  |
| Surround Test | ✓ |  |  |  |  |  | ✓ |
| Bass Test | ✓ |  |  |  |  |  |  |
| Frequency Sweep | ✓ |  |  |  |  |  |  |
| Noise Generator | ✓ | ✓ |  |  |  |  |  |
| Microphone Test |  |  | ✓ | ✓ | ✓ |  |  |
| Spectrum Analyzer |  |  | ✓ | ✓ |  |  |  |
| Pitch Detector |  |  | ✓ | ✓ |  |  |  |
| Decibel Meter |  |  | ✓ | ✓ |  |  |  |
| Audio Latency | ✓ |  |  |  |  | ✓ |  |
| Hearing Frequency | ✓ |  |  |  |  |  |  |

If implementation starts duplicating a checked service responsibility inside multiple tools, stop and fix the boundary.

## Signal graph / headroom

Generated source path:

```text
normalized source
→ source-specific gain/routing
→ master gain
→ destination
```

Avoid summing multiple full-amplitude sources into one channel.

If N sources must intentionally sum into the same channel, normalize coefficients so the worst-case absolute sum remains <= 1 before master gain.

Do not use a compressor/limiter as a hidden substitute for correct normalization in diagnostic signals.

## Visualization dependency

Prefer:

```text
browser service
→ normalized data
→ visualization
```

not:

```text
visualization
→ owns microphone/audio service lifecycle
```

## Cleanup

Every resource-producing module exposes deterministic stop/dispose behavior.

Repeated start/stop must not multiply nodes, streams or animation loops.

## Shared audio capability helpers

Create a shared pure helper for generated frequency caps:

```text
getEffectiveMaxFrequency(sampleRate, nominalMaxHz)
```

All generated-frequency tools use this helper rather than duplicating Nyquist math.

## NoiseEngine v1 contract

`NoiseEngine` owns:

```text
seeded PRNG
white buffer generation
Paul-Kellet-style pink filtering
leaky-integrator brown generation
DC removal
peak normalization
deterministic correlated phase-test buffer
```

Tool code must not reimplement noise formulas.

## MultichannelOutput v1 contract

`MultichannelOutput` owns:

```text
destination maxChannelCount inspection
temporary destination channel configuration
standardized 5.1 graph
experimental raw 8-channel graph
ChannelMerger ordering
teardown/restoration
```

The tool UI consumes capability/result state; it does not mutate destination channel settings directly.

## AudioSession — exact AudioContext lifecycle

Core v1 uses a **tool-local `AudioSession`**.

Responsibilities:

```text
lazy AudioContext creation
resume/unlock
expose context to services in the current tool
track tool-level disposable resources
idempotent stop/dispose coordination
close context on tool/page disposal
```

Constructor contract:

```ts
new AudioContext({ latencyHint: "interactive" })
```

Do not pass a `sampleRate`.

All downstream Web Audio analysis uses `context.sampleRate`.

Rules:

1. no global cross-page AudioContext singleton;
2. create the AudioContext lazily from the tool's explicit Start/Play interaction;
3. one tool page may share one AudioContext between its own services;
4. `Stop` stops active sources/streams/animations but may keep the tool-local AudioContext alive while the page remains active;
5. tool/page `dispose()` is idempotent, stops active resources and calls `AudioContext.close()` once;
6. every interactive tool binds `dispose()` to `pagehide` and explicit controller teardown;
7. MPA navigation never intentionally carries an AudioContext into the next route;
8. services receive the context/session by dependency injection.

Mic-based tool flow:

```text
explicit Start interaction
→ create/resume tool-local AudioSession
→ request getUserMedia
→ connect stream to analyser/recorder services
```

If permission fails:

```text
stop pending tool resources
close the just-created AudioSession if the tool has no remaining use for it
```

## Stereo diagnostic routing

`AudioOutputEngine` owns two distinct primitives:

```text
routeStereoChannel(mode: Left | Both | Right)
panContinuously(value: -1..1)
```

Hard L/Both/R diagnostic routing uses explicit channel gains/merging.

Continuous pan tests use `StereoPannerNode` or equivalent.

Do not implement hard channel diagnostics through pan law.


## Microphone analysis graph

Mic-based tools use:

```text
MediaStream
→ MediaStreamAudioSourceNode
→ analysis/recording branches
```

No live branch connects to `AudioContext.destination`.

If track and AudioContext sample rates differ, Web Audio resamples the source before downstream processing.

Keep separately named:

```text
analysisSampleRate = audioContext.sampleRate
reportedCaptureSampleRate = track.getSettings().sampleRate
```

## Live publication from the registry

All 16 tools may exist as planned metadata.

Publication rule:

```text
status = planned
→ no clickable homepage/navigation/related-tool route

status = live
→ route exists and passes tool acceptance
→ may be linked publicly
```

Renderers filter `relatedToolIds` through the current registry and expose only live targets.

A route and its `status = live` change ship in the same merged PR.

## AudioSession dependency matrix rule

Every interactive audio tool depends on one tool-local AudioSession.

Conceptually:

| Tool family | AudioSession |
|---|:---:|
| Generated output tools | ✓ |
| Microphone/analysis tools | ✓ |
| Latency / Hearing | ✓ |

The detailed Tool → Service matrix lists specialized services; AudioSession is an implicit mandatory root dependency for every interactive tool and must not be recreated inside those services.

## BFCache / page lifecycle

Page entrypoint owns controller mounting:

```text
mount()
→ create idle controller shell
→ no AudioContext yet
```

On:

```text
pagehide
```

call idempotent controller `dispose()`.

On:

```text
pageshow with event.persisted === true
```

mount a **fresh idle controller** and attach a new resource lifecycle.

The next explicit Start lazily creates a **new** AudioContext.

Never reuse a previously closed AudioContext after BFCache restoration.

Listener registration/removal must be idempotent so Back/Forward navigation does not duplicate handlers.

## Microphone atomic stream handoff

`MicrophoneService` owns:

```text
enumeration
new-stream acquisition
active-stream swap
old-track stop
track-ended handling
devicechange metadata refresh
```

For live input switching, acquire the requested new stream first.

If acquisition fails:

```text
old stream remains active
```

If acquisition succeeds:

```text
disconnect old source
stop old tracks
connect new source
publish fresh settings
```

Recording disables device switching until recording stops.

## Shared microphone-selector ownership

`MicrophoneService` is reused by all microphone-analysis tools.

It exposes:

```text
listInputs()
startDefault()
switchToExactDevice(deviceId)
activeSettings()
onTrackEnded()
onDeviceListChanged()
stop()
```

`switchToExactDevice()` implements the atomic handoff from Tool Specs.

Tool pages do not construct their own competing `getUserMedia()` device-switch logic.
