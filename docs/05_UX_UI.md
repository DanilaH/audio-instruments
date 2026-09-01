# 05 — UX and UI Rules

## Primary principle

Tool first.

The core interaction belongs in the first meaningful viewport.

## Standard page hierarchy

```text
site header
title + concise intro
main instrument sheet
primary controls/results
important limitation/status
related tools
explanation/troubleshooting
FAQ/content
```

Supporting content below the core instrument is not part of the first-screen fit budget.

## Desktop gates

Primary review viewports:

```text
1366×768
1440×900
```

For the default/representative active workflow, the complete core instrument sheet should fit with at least 24px visible bottom breathing room.

Compact-desktop stress viewport:

```text
1280×720
```

Target full primary-sheet fit with at least 16px bottom air while user-opened secondary disclosures are closed. Never crush controls below practical readability/accessibility merely to pass the stress viewport. A justified per-tool exception must be documented before merge.

Viewport height should be handled continuously. Do not create a discontinuous “special layout below 900px / giant layout above 900px” breakpoint.

## Mobile gates

Review at:

```text
320×844
390×844
```

Mobile does not require every complete tool state to fit one screen.

Required:

- no horizontal overflow;
- controls remain touch-friendly;
- visualizations resize deliberately;
- the primary field appears early;
- relevant primary controls remain close enough to the output/state that the user does not repeatedly scroll back and forth.

Secondary details may continue below.

## Main instrument sheet

Each migrated tool has one visually dominant functional sheet.

Sonic Field hierarchy:

```text
FieldZone
→ spatial / frequency / time / live-data relationship

ControlRail
→ compact primary controls + metrics

StateStrip
→ safety / capability / concise operational context
```

Avoid fragmenting the core interaction into many unrelated cards.

Do not force every tool into the same drawing; share primitives, not fake sameness.

## Shared component inventory

Names may vary, responsibilities may not.

### Production Sonic Field primitives

```text
ToolShell
→ common page framing + compact tool header

SonicInstrument / InstrumentSheet
→ migrated primary working sheet + Sonic tokens

FieldZone
→ stable audio-native visualization/relationship area

ControlRail
→ compact contextual controls/metrics

StateStrip
→ concise safety/capability/operational context

SignalNode
→ semantic interactive channel/spatial target

MetricReadout / Metric
→ Hz / dBFS / ms / note values with tabular numerals

Disclosure
→ secondary technical/calibration/device details
```

Existing behavioural primitives remain valid where useful:

```text
PlayStopControl
FrequencyControl
LevelControl
ToolStatus
PermissionPanel
CapabilityNotice
RelatedTools
WaveformCanvas
```

`InstrumentSurface` is legacy during the staged migration. Do not use it for newly migrated Sonic Field tools.

Do not force unique tool visuals into one generic visualization component when their behaviour differs.

## Behaviour hooks during visual migration

Preserve existing controller/test IDs and `data-*` hooks by default.

Visual class names may change freely.

If a behaviour selector must change, update the controller and affected tests deliberately in the same reviewed unit.

Do not duplicate a hook when a controller expects an exact element count. Prefer moving the existing hook onto the new semantic control.

## State vocabulary

```text
idle
ready
playing
listening
recording
paused
permission_required
permission_denied
unsupported
limited_capability
error
```

Do not communicate state only through color.

## Stable-state composition

Outer-height stability alone is not sufficient.

For spatial tools, stable visual anchors (speaker/headphone/channel positions, listener centre, field bounds) should not move across mode/state changes unless the movement represents actual audio position.

For conditional UI, reserve stable regions where practical for:

```text
mode-specific controls
hearing answer actions
recording/playback controls
capability results
```

Changing content inside a reserved region should not jerk the field or whole sheet.

## Permissions

Mic:

```text
explicit user start
→ permission request
→ success or explicit denial/error state
```

Never request mic permission on page load.

## Errors

Use specific remediation.

Avoid generic “Something went wrong” when the cause is known.

## Progressive disclosure

Primary:

```text
essential control
essential result
essential visual
```

Secondary:

```text
technical settings
track settings
advanced display settings
API details
optional calibration
```

Secondary disclosures may extend below the first viewport when the user opens them.

## Related tools

Use real workflow relationships, not random cross-promotion.

Supporting/SEO content should be visually quieter than the main instrument sheet.

## Accessibility

Required:

```text
semantic controls
keyboard access
visible focus
labels
screen-reader status
sufficient contrast
reduced motion
touch targets
```

Audio feedback must not be the only feedback.

Keyboard focus uses a dedicated high-contrast semantic treatment. Do not reuse an audio-state color blindly as the focus indicator.

Visual L/R/Both or surround-channel targets that trigger playback must be real accessible controls with clear text/accessible names and state beyond color.

## Ads

Future ads must not:

```text
look like tool controls
interrupt permission/safety flow
push the primary tool below the fold
cause major layout shift
```

## Realtime measurement accessibility

Use `aria-live` only for discrete state changes.

Allowed examples:

```text
Playback started
Recording stopped
Microphone permission denied
Input device lost
```

Do not put `aria-live` on:

```text
live Hz
live dBFS
pitch cents
FFT values
spectrum bars
waveform amplitude
```

Those values remain accessible as normally labelled text/control output without repeated live announcements.

## Data-visualization honesty

Production graphics that look measured must derive from actual tool state/data.

Synthetic analyser/signal frames are acceptable in tests and prototypes. They must not appear as unlabeled production measurements.

Structural guides/rulers are allowed when they do not imply measured energy.

## Level control presentation

Generated-audio tools show:

```text
Level
-24 dB
```

or the current configured value.

Do not show the master gain as an acoustic loudness percentage.

## Stop control

While a tool has active continuous playback, sweep, multi-step sequence, microphone capture, recording, live analysis or AV-sync loop, an obvious Stop control remains in the primary sheet.

Do not hide Stop in advanced/overflow UI.

The text label remains present. A transport icon is supplementary and must render reliably across supported browsers.

## Calibration copy

When reference calibration is active:

```text
User-calibrated estimate
Recalibrate after changing microphone, input gain, processing, position or reference conditions.
```

Do not imply persisted calibration survives system/hardware gain changes the browser cannot detect.

Optional calibration should not visually dominate an uncalibrated measurement tool before the user asks for it.

## Generated-audio first-play safety

Before first audible playback, every generated-audio tool visibly says:

```text
Start with your device/headphone volume low.
Increase it only to a comfortable listening level.
Do not turn the volume up to compensate for a tone you cannot hear.
```

Do not hide this in FAQ/help text.

It should remain concise enough not to displace the primary tool.

## Planned vs live navigation

Never render planned tools as disabled/Coming Soon cards.

A planned tool may be known to the internal registry, but user-facing navigation behaves as if it does not yet exist.

Only `status = live` routes are clickable/displayed.
