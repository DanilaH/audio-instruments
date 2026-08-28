# 05 — UX and UI Rules

## Primary principle

Tool first.

The core interaction belongs in the first meaningful viewport.

## Standard page hierarchy

```text
site header
title + concise intro
main instrument surface
primary controls/results
important limitation/status
related tools
explanation/troubleshooting
FAQ/content
```

## Desktop gate

Review especially at:

```text
1366×768
```

The primary job should be substantially usable without unnecessary scrolling.

## Mobile gate

Review at:

```text
390×844
```

No horizontal overflow.

Controls remain touch-friendly.

Visualizations resize deliberately.

## Main instrument surface

Each tool should have one visually dominant functional surface.

Avoid fragmenting the core interaction into many unrelated cards.

## Shared component inventory

The implementation should provide reusable semantic primitives for repeated UI jobs.

Names may vary, responsibilities may not.

### Required shared primitives

```text
ToolShell
→ common page/tool framing

InstrumentSurface
→ primary functional visual surface

MetricReadout
→ Hz / dBFS / ms / note values

ModePills
→ compact mutually exclusive mode selection

PlayStopControl
→ shared start/stop semantics

FrequencyControl
→ numeric + logarithmic slider behavior

LevelControl
→ app-level digital gain control

ToolStatus
→ idle/playing/listening/recording/etc

PermissionPanel
→ microphone permission flow

CapabilityNotice
→ unsupported/limited feature state

RelatedTools
→ related-tool navigation

WaveformCanvas
→ reusable realtime waveform renderer
```

Do not force unique tool visuals into one generic visualization component when their behavior differs.

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
```

## Related tools

Use real workflow relationships, not random cross-promotion.

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

## Level control presentation

Generated-audio tools show:

```text
Level
-24 dB
```

or the current configured value.

Do not show the master gain as an acoustic loudness percentage.

## Stop control

While a tool has active continuous playback, sweep, multi-step sequence, microphone capture, recording, live analysis or AV-sync loop, an obvious Stop control remains in the primary surface.

Do not hide Stop in advanced/overflow UI.

## Calibration copy

When reference calibration is active:

```text
User-calibrated estimate
Recalibrate after changing microphone, input gain, processing, position or reference conditions.
```

Do not imply persisted calibration survives system/hardware gain changes the browser cannot detect.

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
