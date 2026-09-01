# 16 — Audio Identity v3: Sonic Field

Status: **prototype**.

This pass turns the strongest parts of the v2 research into one coherent visual system instead of choosing a single preset-like direction.

## Core hypothesis

Browser Audio Lab should feel like **audio relationships made visible**, not like a generic utility shell decorated with audio-themed colors.

The system therefore treats these as first-class layout primitives:

- stereo position;
- frequency position;
- time progression;
- signal energy;
- listening sequence and observations;
- current playback / analysis state.

Controls should sit on the same instrument plane as those relationships whenever practical. A generic “large visualization + right-side control card” composition is explicitly avoided.

## Visual rules

### Palette

The base interface is warm neutral and low-chroma. Color belongs primarily to data and state:

- teal — active signal / observed / local analysis;
- amber — current position / focus / playhead;
- rust — opposing channel, warning or negative decision where semantically useful.

Purple is intentionally absent. Decorative gradients are avoided; tonal fields and gradients are allowed only when they describe signal/energy/spatial structure.

### Geometry

- Default radii are 4–10 px.
- Large pill controls are avoided.
- Major boundaries use thin structural rules rather than stacks of rounded cards.
- Circular geometry is reserved for inherently spatial/channel/frequency nodes, not generic buttons.

### Typography

- Neutral sans-serif UI typography.
- Large type is reserved for current frequency / primary audio state.
- Uppercase micro-labels are used sparingly for rulers, state labels and instrument metadata.
- Monospace is not used as a global anti-AI aesthetic.

### Composition

The main object is a single **instrument sheet** with three conceptual layers:

1. field — signal/spatial/frequency visualization;
2. rail — compact contextual controls and metrics;
3. safety/state strip — one-line operational context where required.

The rail is part of the same object, not a detached dashboard card.

## Tool-specific application

### Headphone Test

The composition is listener-centred. L / Both / R are positions in the stereo field. The active sweep is represented both spatially and temporally. The frequency value is attached to the sweep state rather than placed in a generic result card.

### Spectrum Analyzer

The spectrogram is the interface, not an illustration inside the interface. Time and frequency rulers belong directly to the field. Controls and metrics form a compact lower rail.

Prototype spectrogram data is synthetic and must be labelled as such.

### Hearing Frequency Test

The guided test is a frequency path with past, current and future steps. Session observations and the current listening decision are attached to that path.

The design must not resemble or claim to be a diagnostic audiogram. It does not introduce a hearing-threshold y-axis or normal/abnormal zones.

## v3.1 compact viewport budget

The v3.1 pass adds a viewport-budget rule instead of a one-off screenshot hack.

Desktop target:

- at **1366 × 768** and **1440 × 900**, the complete active instrument sheet must fit inside the viewport;
- leave at least **24 px** of clear space below the sheet;
- canvas height may grow with viewport height, but the control rail and safety strip remain compact;
- the tool may use the available desktop area aggressively, but it must not require a scroll just to reach primary controls.

Mobile target:

- full-sheet fit is not a hard requirement;
- page chrome is compressed so the working field appears early;
- output and primary controls stay close enough that the user is not repeatedly shuttling between distant regions of the page;
- compactness must not make labels, targets or data illegible.

The v3.1 CSS intentionally lives in a separate prototype override layer so the compactness experiment can be accepted or rejected without rewriting the v3 base.

## Failure criteria

Reject or revise this direction if any of the following are true after browser rendering:

1. It still reads primarily as Hardware Testing with different colors.
2. Controls visually dominate the signal/frequency field.
3. Removing the page title makes the tool impossible to recognize as audio-related.
4. Desktop works only because the canvas is enormous and the system collapses into generic stacked cards on mobile.
5. Color becomes decorative rather than semantic.
6. The visual language converges on a generic DAW/plugin, brutalist anti-AI preset, retro hi-fi cosplay or soft SaaS dashboard.
7. A desktop tool falls below the viewport fold at the validation sizes.
8. Mobile separates output from the primary controls enough to create repeated scroll-ping-pong.

## Prototype validation

The prototype should be rendered at minimum at:

- 1366 × 768;
- 1440 × 900;
- 390 × 844.

The first decision after rendering is visual, not implementation-driven: determine whether Sonic Field is distinct enough to justify adapting production components around it. No production tool should be restyled before that decision.
