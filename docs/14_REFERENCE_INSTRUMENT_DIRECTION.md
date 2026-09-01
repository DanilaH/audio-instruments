# 14 — Reference Instrument Design Direction

Status: **approved for prototyping** on `prototype/reference-instrument-v1`.

This document records the design direction that follows the visual research pass. It is intentionally more specific than a moodboard, but it is not yet the production visual-system replacement. Production adoption happens only if the direction survives the prototype stress cases.

## Why this exists

The current `Soft Sonic Studio` system solved approachability, but it accumulated a recognizable generic modern-web vocabulary:

- pastel accent per tool;
- lavender / purple semantic emphasis;
- large soft gradients and radial glows;
- 24–32 px rounded containers;
- stacked cards inside cards;
- large marketing-style tool titles;
- soft elevation and hover lift;
- decorative color used to create atmosphere rather than encode state.

The result is visually noisy, consumes vertical space and can read as AI-generated SaaS UI.

The opposite reaction is also rejected. We are **not** replacing this with a generic anti-AI preset such as black/white brutalism, monospace everywhere, square boxes, acid accents, editorial serif, fake terminal styling, or intentional roughness.

## Design thesis

> Browser Audio Lab should look like a family of modern digital reference instruments, not a website decorated with audio widgets.

The working name is **Reference Instrument**.

The visual language should feel as if it grew from the actual job of calibration, playback, measurement and signal inspection.

Reference families used in the research:

- professional sound and measurement hardware: Brüel & Kjær, Hewlett-Packard / Tektronix-class bench instruments;
- professional audio recorders and control surfaces: Nagra;
- audio calibration media and technical print: CBS Laboratories test records and similar reference material;
- test-card culture: functional grids, scales and diagnostic geometry rather than decorative graphics;
- modern analytical audio software: FabFilter, Sonic Visualiser;
- progressive disclosure in physical audio equipment: important functions directly available, secondary functions recessed.

These are **sources of principles**, not skins to copy.

## Core principle: visual decisions need provenance

A visual decision must answer a product question.

Bad:

- purple because it is the brand accent;
- rounded because it feels modern;
- gradient because the panel needs depth;
- grid because technical interfaces use grids;
- glow because audio feels energetic.

Good:

- color identifies an active signal or state;
- a line is a reference scale or structural separator;
- a circle represents a physical channel / pan / speaker target;
- motion represents a signal, decay, sweep, level or return-to-zero;
- a boundary separates functional zones of one instrument.

Decorative elements that do not communicate useful state should be exceptional.

## Color policy

The interface is predominantly neutral. Color is sparse and functional.

Target viewport balance:

- roughly 90–95% neutral surfaces / type / separators;
- signal color only for live/current/selected data or a direct interaction path;
- red family for record / destructive / error semantics as appropriate;
- amber family for caution / safety;
- additional colors only when they encode a real channel, trace or measurement distinction.

Rejected:

- accent color per tool;
- lavender / purple as generic branding or body-text emphasis;
- pastel split-screen surfaces;
- large colored decorative glows;
- using hue as the only state indicator.

Color may connect a control to the signal/data it affects. This is preferred over coloring an entire tool category.

## Candidate neutral palette

The prototype should start near this family, then be tuned by rendered screenshots rather than treated as final tokens:

```text
canvas           #F3F2EE
surface          #FAFAF7
raised-surface   #FFFFFF
instrument       #E9EAE6
ink              #202320
muted-ink        #626762
separator        #CFD2CC
strong-separator #9FA59F
signal           #167A86
signal-soft      #DCEBED
caution          #9A6A12
caution-soft     #F2E8CF
record/error     #A54238
```

This palette is intentionally not `cream + sage + coral` lifestyle styling. The neutrals should read closer to instrument materials / technical print than to editorial wellness UI.

## Geometry

Do not make everything square. Do reduce the inflated soft-SaaS radius hierarchy.

Prototype target:

```text
outer instrument   10–12px
control group        6–8px
button / input       4–6px
badge / tag          3–5px
physical circular objects remain circular
```

Use separators and spacing instead of creating a rounded card around every group.

Avoid nested `surface -> rounded panel -> rounded fieldset -> rounded button group` composition.

## Surfaces and depth

The main tool is one instrument chassis with functional zones.

Prefer:

- one clear outer boundary;
- flat or near-flat neutral surfaces;
- 1px separators;
- subtle difference between display and control areas;
- small, local elevation only where interaction genuinely benefits from it.

Avoid:

- radial color glows;
- decorative gradients on the instrument chassis;
- large ambient shadows;
- hover lift for ordinary utility controls;
- shadows on every nested panel.

## Typography

Typography is not the primary anti-slop trick.

For the first prototype, keep Manrope unless it becomes a demonstrated problem. This lets us prove that the new identity comes from hierarchy, composition, color behavior and information design rather than a fashionable font swap.

Rules:

- tool-page title becomes functional rather than promotional;
- measurement values receive the strongest numeric hierarchy;
- use tabular numerals for changing measurements where supported;
- technical labels may be compact / uppercase when they behave like instrument markings, but not as decorative eyebrow copy everywhere;
- do not make the whole interface monospace;
- do not introduce an editorial serif merely to look human-made.

## Tool-page hierarchy

Current large marketing-style headings consume too much of the first viewport.

Prototype target on desktop:

```text
site header
compact tool identity: 32–44px title
one concise purpose line
16–24px gap
instrument surface
```

The instrument should appear immediately and should be substantially usable at 1366×768 without scrolling caused by presentation chrome.

Eyebrows become optional metadata, not mandatory purple decoration.

## Instrument composition

Stop thinking of tools as "left card + right card".

Think:

```text
one instrument
├─ display / spatial / measurement zone
├─ control zone
├─ primary state / transport
└─ secondary setup / calibration / details
```

Zones may have different neutral tones and separators, but they should read as one machine.

The visual side of a tool is a stable anchor. Dynamic state changes must not move the physical metaphor / visualization around unless the motion itself communicates state.

## Interaction-generated identity

Prefer identity created by behavior over decoration.

Examples:

- Left / Right speaker or headphone targets are themselves buttons;
- a center / Both control sends the same reference signal to both outputs;
- Surround channels use the same direct spatial interaction model;
- the selected signal path is visibly connected to the active output;
- a stereo pan marker returns smoothly to center after playback;
- a bass sweep exposes the current live frequency;
- spectrum and spectrogram color intensity encodes actual data rather than ambient decoration.

## Motion policy

Remove generic website motion where possible:

- no card hover lift as a default pattern;
- no decorative floating blobs;
- no spring animation just because a button was selected.

Keep / improve instrument motion:

- waveform;
- level decay;
- sweep cursor;
- pan / spatial position;
- signal travel between channels;
- smooth return-to-zero;
- real state transitions.

Motion should explain the instrument.

## Progressive disclosure

Primary surface shows only what is needed to perform the core job.

Secondary technical detail should be recessed using compact disclosure patterns rather than competing cards.

For example, Decibel Meter priority should be:

```text
measurement
start / stop
input
optional calibration
technical explanation
```

Calibration is important but should not visually dominate the measurement before the user opts into it.

Safety copy remains mandatory where specified by `05_UX_UI.md`, but its presentation should be concise instrument marking / notice rather than another decorative pastel card.

## Data visualization

The data surface should dominate data-heavy tools.

Spectrum Analyzer prototype rules:

- canvas receives more usable area;
- controls become visually secondary;
- spectral color scale must have meaningful amplitude / intensity mapping;
- improve legibility through mapping and contrast, not arbitrary saturation;
- visual representation must remain measurement-honest.

## Explicit blacklist

Do not solve "AI look" with any of the following:

- generic brutalism;
- all-black / all-white high-contrast theme as the identity;
- acid green accent by default;
- monospace everywhere;
- fake terminal / `001 SIGNAL` decoration;
- beige + serif editorial styling;
- fake analog knobs for ordinary sliders;
- gratuitous grain / paper texture;
- intentionally crooked / imperfect elements;
- direct Braun / Nagra / Teenage Engineering cosplay;
- decorative grids, scales, traces or waveforms that do not represent information;
- another generic Linear-style SaaS minimalism.

## Prototype stress cases

The direction must work on three structurally different live tools before production adoption:

### Headphone Test

Tests:

- spatial output metaphor;
- direct L / R / Both interaction opportunity;
- multiple playback modes;
- safety notice;
- stable visual anchor under dynamic mode changes.

### Decibel Meter

Tests:

- measurement-first hierarchy;
- dense secondary calibration flow;
- permission / input / state communication;
- progressive disclosure;
- ability to reduce text without losing measurement honesty.

### Spectrum Analyzer

Tests:

- data-dominant composition;
- mode switching;
- realtime visual contrast;
- compact controls;
- ability of the visual language to work without a physical-device metaphor.

## Prototype acceptance criteria

The direction is viable only if all three pages satisfy the following:

1. The tool appears materially earlier in the viewport than today.
2. The page is calmer with fewer competing color fields.
3. The instrument still has recognisable character without gradients / oversized radii / decorative purple.
4. Primary action and current state are obvious within a short glance.
5. Data / output / spatial target is visually stronger than explanatory copy.
6. Secondary settings are discoverable but not dominant.
7. The visual language does not read as brutalist, editorial, terminal-themed or retro cosplay.
8. Existing accessibility and measurement-honesty requirements remain intact.
9. Dynamic states do not alter the overall instrument footprint unnecessarily.
10. The system looks coherent across all three stress cases rather than beautiful on only one page.

## Adoption rule

Do **not** merge the prototype direction into production merely because screenshots look more fashionable.

After review of the three stress cases:

- keep successful primitives;
- reject visual gimmicks that do not generalize;
- update `04_VISUAL_SYSTEM.md` only after the direction is approved;
- then roll the system across the remaining tools with regression testing for interaction, layout stability, accessibility and cross-browser behavior.
