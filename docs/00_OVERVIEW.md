# 00 — Overview

## Product

Browser Audio Lab is a browser-based suite of audio diagnostics and signal utilities.

Core promise:

> Open a tool, perform an audio task immediately, understand the result, and understand what the browser can and cannot prove.

## Required qualities

```text
useful
beautiful
honest
```

All three are release requirements.

## Product feeling

The product should feel like:

```text
friendly browser audio lab
small digital studio
purpose-built instrument collection
```

Not:

```text
enterprise dashboard
generic SEO utility template
music visualizer without utility
clinical measurement system
```

## Portfolio model

```text
organic search
→ useful browser task
→ related-tool discovery
→ display ads
→ low operating cost
```

Core v1 has no backend, database, auth, or paid runtime API.

## Implementation baseline

```text
Astro static MPA
strict TypeScript
plain CSS
browser APIs
Canvas/SVG
Motion
Phosphor
```

## Implementation readiness

```text
P0–P6: implementation-ready; cold pre-code review passed with 0 blockers / 0 majors
P7: waits for upgraded SEO runner
P8: waits for real-device/browser QA + production decisions
```

## Visual identity

Working art direction:

> **Soft Sonic Studio**

The instrument itself should usually be the most visually interesting part of the page.

## Evidence philosophy

Pre-launch evidence can justify a bet.

It cannot guarantee rankings or revenue.

Post-launch business validation begins only with our own:

```text
impressions
rankings
clicks
RPM
revenue
maintenance cost
```

## Repository quality gate

The repository uses Draft PRs for early review.

The full validation CI is intentionally gated until:

```text
independent review #1
→ fixes
→ independent review #2
→ PR marked Ready for review
```

See `15_DEVELOPMENT_WORKFLOW.md` and `16_CI_AND_REPOSITORY_GATES.md`.

## Site shell

The project includes a real homepage at `/`.

It is not a placeholder and is not left for the agent to invent.

Its structural contract lives in `18_HOMEPAGE_AND_SITE_SHELL.md`.

## Mechanical merge gate

Review order is enforced by CI:

```text
Review #2
→ full-ci-approved
→ Ready
→ full-validation
→ merge-gate
```

Before authorization, `merge-gate` fails rather than relying on a skipped required job.
