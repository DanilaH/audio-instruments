# 04 — Visual System

## Art direction

> **Soft Sonic Studio**

Desired:

```text
warm
friendly
musical
soft
rounded
dynamic
pleasant
alive
slightly playful
```

Avoid:

```text
clinical
enterprise
hard-edged
RGB gaming
generic SaaS
generic grey utility
```

## Core identity

The site must not collapse into:

```text
grey background
white rectangular card
black text
blue CTA
```

The instrument itself should carry much of the visual identity.

## Core motif

Dynamic audio signal / waveform.

Use audio-derived visuals where they represent real state.

## Signature trail

Approved:

```text
slight blur
short disappearing trail
soft decay
```

Target:

```text
elegant
alive
controlled
```

Not:

```text
smudgy
neon
particle-heavy
game-like
```

## Initial palette

```text
--color-bg:          #FAF7F2
--color-surface:     #FFFDFC
--color-surface-alt: #F4F0FF
--color-ink:         #1F2430
--color-ink-muted:   #5F6675
--color-border:      #E8E3DC
--color-lavender:    #8F7CFF
--color-blue:        #67A7FF
--color-mint:        #66D1B2
--color-peach:       #FFB58D
--color-yellow:      #FFD76A
```

Fine tuning later is allowed.

## Tool accent mapping

```text
Tone        lavender
Speaker     peach/coral
Headphone   blue
Microphone  sky/cyan
Bass        mint + warm accent
Spectrum    spectral multi-accent
Stereo      lavender + blue
Noise       warm muted neutral
```

Accent color alone is not enough to differentiate tools.

## Typography

Choose one during P0:

```text
Manrope
or
Plus Jakarta Sans
```

Metrics use one clean monospace family.

Do not add multiple decorative fonts.

## Radius scale

```text
small controls   12px
buttons          14–18px
cards            20–28px
instruments      24–32px
```

## Surfaces

Prefer:

```text
soft tinted surfaces
subtle shadows
light separators
soft inner highlights
```

Avoid hard dark borders around every control.

## Tool-specific visual grammar

```text
Tone
→ central waveform

Speaker
→ speaker cones + pressure rings

Headphone
→ earcup activation

Microphone
→ mic capsule + halo + waveform

Bass
→ woofer + expanding rings

Stereo
→ travelling signal

Spectrum
→ spectral landscape

Noise
→ subtle animated texture
```

## Motion

Allowed:

```text
waveform morph
soft halo
pulse
trail
button press spring
selected-state motion
small hover lift
result reveal
```

Do not animate everything continuously.

## Reduced motion

Reduce/remove:

```text
decorative drift
trails
large spring movement
nonessential pulses
```

Core data remains readable.

## Graphics bootstrap

Baseline:

```text
Canvas
SVG
Motion
Phosphor
```

Not installed at bootstrap:

```text
Rive
OGL
Three.js
other realtime graphics engines
```

Rive remains a later explicit polish decision.

## Realtime visualization budget

```text
requestAnimationFrame
Canvas for high-frequency redraw
drawing-buffer DPR cap: 2
bounded history only
deterministic teardown
```

Trail implementation:

```text
alpha persistence fade
or small fixed-size history buffer
```

Never store unbounded prior frames.

## CSS ownership

Global CSS owns:

```text
tokens
reset/base
typography
shared layout primitives
shared control primitives
```

Tool-specific composition remains local to the tool/component layer.

## Semantic contrast rule

Bright accent colors are primarily for surface fills, illustrations and non-text signal decoration.

They are not automatically valid as body text, focus rings or the only semantic state indicator.

Dedicated focus token:

```text
--color-focus: #5D4AE8
```

Requirements:

```text
normal text >= 4.5:1
large text >= 3:1
focus indicator / essential UI boundary >= 3:1 against adjacent colors
```

If an accent fails the threshold, use `--color-ink` or `--color-focus` for semantic information and keep the bright accent decorative.

Never communicate active/error/success state by color alone.

## Phosphor payload budget

Global shell loads:

```text
Regular
```

Additional weights:

```text
Fill
Duotone
```

are route-local exceptions when they provide real state/illustration value.

Do not globally load all Phosphor weights.

Normal route budget:

```text
<= 2 weights
```

Exceeding it requires visual/performance review.
