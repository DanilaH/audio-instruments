# 02 — Product Scope

## Scope rule

Build the **full sensible Audio fan**.

Do not prune a core tool only because its SEO priority is lower.

Do not create a route merely for a synonym.

## Core v1 catalog

### Output diagnostics

1. Sound Test / Audio Test
2. Speaker Test
3. Headphone Test
4. Stereo Test
5. Phase / Polarity Test
6. Surround Sound Test

### Signal/frequency

7. Bass / Subwoofer Test
8. Tone Generator
9. Frequency Sweep Test
10. Noise Generator
16. Hearing Frequency Test

### Input/analysis

11. Microphone Test
12. Spectrum Analyzer
13. Pitch Detector
14. Decibel / Sound Meter

### Timing / specialist

15. Audio Latency / AV Sync Test

## Route separation

A separate route requires a materially distinct:

```text
user goal
interaction model
result
browser capability requirement
or search intent
```

## Overlap/job matrix

| Tool | Primary job | Must not become |
|---|---|---|
| Sound Test | Fast L/Both/R smoke test | Full speaker diagnostics |
| Speaker Test | Speaker/channel troubleshooting | Stereo pan demo only |
| Headphone Test | Ear-specific channel/range/rattle check | Speaker Test with a headphone illustration |
| Stereo Test | Channel separation, center and pan | General speaker-health suite |
| Phase Test | In-phase vs inverted comparison | Automatic physical wiring diagnosis |
| Surround Test | Discrete channel routing when available | Fake 5.1/7.1 over ordinary stereo |
| Tone Generator | Exact requested digital oscillator | Physical frequency-response meter |
| Frequency Sweep | Controlled listening sweep | Calibrated response graph |
| Bass Test | Low-frequency listening/rattle exploration | Exact subwoofer response measurement |
| Microphone Test | Capture/level/waveform/record-playback | SPL meter |
| Spectrum Analyzer | Relative live frequency-energy display | Calibrated acoustic analyzer |
| Pitch Detector | Musical pitch estimate | Generic spectrum peak label |
| Decibel Meter | dBFS + optional calibrated estimate | Accurate uncalibrated SPL meter |
| Latency / AV Sync | Browser latency info + manual sync | Exact Bluetooth hardware latency meter |
| Hearing Frequency | User-observed frequency exploration | Clinical audiogram / hearing age |
| Noise Generator | Reference noise generation | Wellness/sleep product in core v1 |

## Working SEO roles

### Likely acquisition anchors

```text
Tone Generator
Speaker Test
Sound Test
```

### Strong supporting / possible acquisition

```text
Headphone Test
Microphone Test
Bass Test
Stereo Test
```

### Supporting / long-tail

```text
Frequency Sweep
Phase Test
Spectrum Analyzer
Noise Generator
Pitch Detector
```

### Specialist / completeness

```text
Audio Latency
Surround
Hearing Frequency
Decibel Meter
```

These are priority labels, not build/no-build decisions.

## Explicitly outside core v1

```text
Binaural Beats
DTMF Generator
Dog Whistle
Mosquito Tone
Speaker Cleaner / Water Eject
Hearing Age
DAW
cloud recording
AI audio generation
medical audiometry
professional calibrated acoustic analysis
```

## Taxonomy rule

Registry fields are separate:

```text
navigationCategory
implementationPhase
```

Navigation categories are:

```text
output
signal-frequency
input-analysis
timing-specialist
```

Roadmap phase/risk grouping must not be reused as navigation taxonomy.
