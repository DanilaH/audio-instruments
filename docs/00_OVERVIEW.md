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

## Implementation status

As of 2026-08-29:

```text
P0–P6.3: implemented and merged
core v1 catalog: all 16 tool routes live
P7: blocked by its explicit upgraded-runner prerequisite
P8: phase-gated after P7; includes real-device/browser QA + production decisions
```

The original cold pre-code review passed with 0 blockers / 0 majors. Subsequent implementation units used the repository's PR + cold-review workflow and exact-SHA review evidence.

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

The required workflow sequence remains:

```text
cold Review #1
→ fixes
→ cold Review #2
→ full-ci-approved
→ PR marked Ready for review
→ full-validation
→ merge-gate
```

See `15_DEVELOPMENT_WORKFLOW.md` and `16_CI_AND_REPOSITORY_GATES.md`.

The repository is private on the current free GitHub plan, so protected-branch/ruleset enforcement is unavailable and the owner has accepted manual repository-gate enforcement. This does not change the required review/validation sequence.

Recent later-P5/P6 GitHub Actions attempts also exposed a separate hosted infrastructure incident: jobs failed before runner allocation with `runner_id = 0` and `steps = []`. Those runs are infrastructure/no-runner evidence, not green CI and not repository test failures. Affected merge history records exact-SHA review evidence and explicit infrastructure incident notes. This historical record does not authorize future merges without a green `merge-gate` and does not redefine the required CI policy.

## Site shell

The project includes a real homepage at `/`.

It is not a placeholder and is not left for the agent to invent.

Its structural contract lives in `18_HOMEPAGE_AND_SITE_SHELL.md`.

P6.3 finalized the live v1 catalog composition with the canonical featured four and live-only category directory.

## Mechanical merge gate

Required review/authorization order:

```text
Review #2
→ full-ci-approved
→ Ready
→ full-validation
→ merge-gate
```

Before authorization, `merge-gate` fails rather than relying on a skipped required job.
