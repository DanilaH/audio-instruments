# 18 — Homepage and Site Shell

## Purpose

The `/` route is a real product homepage.

It is not a placeholder, but it also must not advertise unfinished tools.

## Registry publication rule

The registry may contain all planned tools.

Homepage/navigation render only:

```text
status = live
```

Never show:

```text
Coming Soon cards
disabled planned-tool cards
links to unfinished routes
empty placeholder routes
```

## Homepage hierarchy

```text
Site header
Hero
Featured live tools
All live tools by category
Short trust/privacy statement
Footer
```

## Header

Baseline:

```text
brand/product name
Tools anchor/navigation
no account/login controls
```

## Hero

Contains:

```text
concise positioning
one short support sentence
signature Audio visual
primary action
```

Primary-action rule:

```text
if Tone Generator is live
→ link to Tone Generator

before any tool is live
→ omit the primary CTA entirely
```

No broken future-tool CTA.

## Featured target set

Final v1 featured target order:

```text
Tone Generator
Speaker Test
Microphone Test
Headphone Test
```

At any intermediate development stage:

```text
show only members of that target set whose registry status = live
```

Do not fabricate the remaining cards.

Featured cards may use varied compositions and tool-specific visuals.

## All tools

Show only live tools, grouped using registry `navigationCategory`.

Final category membership:

### Output diagnostics

```text
Sound Test
Speaker Test
Headphone Test
Stereo Test
Phase Test
Surround Sound Test
```

### Signal and frequency

```text
Bass Test
Tone Generator
Frequency Sweep
Noise Generator
Hearing Frequency Test
```

### Input and analysis

```text
Microphone Test
Spectrum Analyzer
Pitch Detector
Decibel Meter
```

### Timing / specialist

```text
Audio Latency / AV Sync Test
```

## Empty-category behavior

If a category has zero live tools:

```text
do not render the category heading/section
```

No empty shells.

## Trust/privacy statement

Allowed themes:

```text
browser-based tools
microphone processing remains local in core v1
no account required
```

If analytics/ads are later added, update wording to match actual behavior.

## Footer

Always include:

```text
Privacy → /privacy
copyright/product mark
```

Optional:

```text
live tool category links
About/How it works only if such a real route exists
```

`/privacy` is specified in `19_PRIVACY_AND_LEGAL.md`.

Do not create empty footer destinations.

## Visual rule

Do not render the final catalog as 16 identical cards.

Use:

```text
varied featured composition
category grouping
small cheap tool-specific visuals
Soft Sonic Studio tokens
```

## Implementation timing

### P0

```text
homepage route
site shell
registry with planned/live status
live-only filtering
responsive structural layout
/privacy route
```

Before the first tool ships, homepage may contain no tool cards.

### After each tool PR

The same PR that makes a tool route complete changes:

```text
status: planned → live
```

Homepage/navigation update automatically from the registry.

### P2 — after Tone

Apply the first proven Soft Sonic Studio visual language to:

```text
hero
Tone featured card
live-tool category presentation
```

Do not create Speaker/Mic/Headphone placeholders.

### P6.3 — final catalog homepage composition

After all P0–P6 tool routes are live:

```text
final featured-four composition
final category balance
final internal-link presentation
desktop/mobile visual review
```

P8 may still apply launch/SEO/legal polish without reopening this structure.

## Anti-patterns

```text
testimonials
customer logos
pricing
login/signup
enterprise CTA
fake usage counters
fake trust badges
Coming Soon tool cards
unfinished internal links
16 identical cards
```
