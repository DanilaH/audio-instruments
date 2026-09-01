# 04 — Visual System

## Art direction

> **Sonic Field**

Browser Audio Lab should look like **audio relationships made visible**, not a generic utility shell with audio-themed decoration.

Desired:

```text
audio-native
calm
precise
spatial
data-first
compact
alive only where signal/state is alive
```

Avoid:

```text
AI-SaaS pastel cards
Hardware Testing lookalike
DAW/plugin cosplay
retro hi-fi skeuomorphism
anti-AI brutalism
per-tool rainbow branding
fake measurement graphics
```

## Core identity

The working tool is a single coherent **instrument sheet**.

Its visual hierarchy is:

```text
field
→ signal / spatial / frequency / time relationship

rail
→ compact controls + metrics

state strip
→ safety / capability / operational context
```

Do not default to a detached “visual card on the left + settings card on the right” dashboard.

## Audio-native rule

A distinctive graphic must correspond to real audio semantics.

Good:

```text
stereo/channel position
frequency path
sweep/playhead position
waveform
spectrum / spectrogram
meter level
guided listening progression
```

Not acceptable:

```text
fake waveform decoration
synthetic energy contours presented like live data
random oscilloscope lines
color fields with no state/data meaning
```

Structural grids/rulers/guides are allowed when they do not imply a measurement.

## Production palette

Sonic Field uses a predominantly low-chroma neutral base.

Semantic families:

```text
signal / observed       teal / blue-green
current / playhead      amber
warning / opposing      rust / red
keyboard focus          dedicated high-contrast non-purple token
```

Keyboard focus is not the same semantic as “current signal”.

Exact production values are validated in rendered context. Do not choose a color merely because it fits a palette trend.

No new migrated tool should use lavender/purple branding or a separate pastel accent just to differentiate itself.

## Transitional legacy tokens

The old Soft Sonic Studio tokens/components may remain temporarily in source **only for tools that have not yet migrated**.

They are implementation debt during the staged rollout, not an approved alternative visual system.

Do not use legacy `lavender / blue / mint / peach / yellow` tool accents in new Sonic Field work.

`InstrumentSurface` remains a legacy primitive until its remaining consumers migrate. New migrated tools use the Sonic Field instrument primitive.

## Typography

Primary UI typography remains a neutral sans-serif.

Rules:

```text
tool title desktop      ~36–48px
measurements             tabular numerals
micro labels             sparse uppercase metadata
body copy                normal readable sentence case
```

Do not introduce serif or monospace merely to make the site feel “human” or “technical”.

## Geometry

Target production scale:

```text
instrument sheet         8–12px
control groups           4–8px
ordinary controls        modest radius
true spatial nodes       circular where semantics require it
```

Prefer structural rules/dividers to nested rounded cards.

Avoid 24–32px work-panel radii and pills everywhere.

## Surfaces

Prefer:

```text
one coherent working plane
low-chroma neutral surfaces
clear field/rail/state hierarchy
thin structural separators
strong data hierarchy
```

Avoid:

```text
ambient lavender glow
soft pastel split panels
nested cards
large decorative shadows
gradients that do not encode signal/state
```

## Tool archetypes

### Spatial output / channel relationship

```text
Headphone
Speaker
Stereo
Surround
Phase
```

Use listener/channel/spatial relationships. Visual L/R/Both or channel nodes may be the actual accessible playback controls where the target maps exactly to the audio action.

### Frequency / generated signal

```text
Tone
Frequency Sweep
Bass
Noise
Sound Test
```

Use frequency/time/current-signal state. Sweep motion represents the scheduled signal progression.

### Input / analysis / measurement

```text
Microphone
Spectrum Analyzer
Decibel Meter
Pitch Detector
```

Live data is the interface. Secondary capture/device/calibration metadata is disclosed rather than visually dominant.

### Guided temporal task

```text
Hearing Frequency Test
Audio Latency Test
```

Use a stable path/timeline/current step and attach decisions/results to it.

## Motion

Allowed when it communicates the product state:

```text
waveform / spectrum updates
meter attack and decay
sweep/playhead motion
stereo/spatial motion
signal path
short deterministic return-to-centre
```

Remove generic website motion from working tools:

```text
hover lift
card translation
shadow bloom
node movement just to show “active”
decorative result reveals that reflow the tool
```

A mode switch must not move stable visual anchors unless the movement itself represents audio position/state.

## Reduced motion

`prefers-reduced-motion` removes or simplifies nonessential interpolation.

Core state/data remains visible.

A reduced-motion preference may make a visual return-to-centre immediate after audio playback has already stopped.

## Graphics implementation

Baseline remains:

```text
Canvas
SVG / semantic HTML/CSS
Motion where justified
Phosphor Regular where reliable
```

Do not add a graphics engine/design-system dependency for this migration.

Realtime budget remains:

```text
requestAnimationFrame
Canvas for high-frequency redraw
drawing-buffer DPR cap: 2
bounded history only
deterministic teardown
```

## CSS ownership

Global CSS owns:

```text
legacy global tokens during transition
base/reset/typography
site shell
shared generic control behaviour
```

Sonic Field shared components own their semantic visual tokens and working-sheet primitives until the migration is complete.

Tool-specific audio composition remains local to the tool/component layer.

Do not globally recolor all unmigrated tools as a side effect of a staged migration PR.

## Accessibility and contrast

Requirements remain:

```text
normal text >= 4.5:1
large text >= 3:1
focus indicator / essential UI boundary >= 3:1 against adjacent colors
visible keyboard focus
state not communicated by color alone
```

Signal color is not automatically valid for text/focus.

Direct visual playback targets must use semantic button behaviour, keyboard access, visible focus and descriptive accessible names.

## Phosphor payload budget

Global shell continues to load:

```text
Regular
```

Do not add global icon weights to solve a single transport icon.

If a primary transport glyph proves unreliable across browsers, prefer a robust inline/CSS transport mark while retaining the text label.
