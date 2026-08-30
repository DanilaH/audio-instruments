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

As of 2026-08-30:

```text
P0–P6.3: implemented and merged
core v1 catalog: all 16 tool routes live
P7: fresh Runner evidence collected, reviewed and applied to SEO roles/metadata
P8: in progress — P8.1 safe indexing gate + P8.2 static claims/metadata release audit complete
```

P7 kept all 16 distinct product jobs, found no justified slug migrations, and prohibited synonym-page expansion. The reviewed evidence record lives at `docs/evidence/P7_AUDIO_EVIDENCE_2026-08-30.md`.

P8.1 preserves the preview safety boundary while moving release infrastructure into code: pages remain crawlable `noindex,nofollow` with no production canonical by default, and `/robots.txt` allows crawling without advertising a sitemap. `SITE_INDEXING=enabled` is intentionally blocked while `PRODUCTION_INDEXING_ARTIFACTS_READY = false`; the later sitemap/positive indexed-build unit must land before that guard may be lifted.

P8.2 reviewed the static measurement/claims wording, final route metadata, page-level H1 identity, live-only related-link construction and current core-v1 privacy copy on baseline `dad7ec774659123a65fa279747c403e9d0db3ac3`. No source-copy/runtime change was justified. This is not browser/device/accessibility/visual or production-indexing certification. The audit record lives at `docs/evidence/P8_STATIC_RELEASE_AUDIT_2026-08-30.md`.

The original cold pre-code review passed with 0 blockers / 0 majors. Subsequent implementation units use the repository's PR + cold-review workflow and exact-SHA review evidence.

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

P7 traffic velocity remains unavailable because no comparable provider-neutral traffic series was collected. Missing evidence is not converted into a positive or negative claim.

## Repository quality gate

The repository uses Draft PRs for early review.

The required workflow sequence remains:

```text
cold Review #1
→ fixes
→ cold Review #2
→ full-ci-approved
→ Ready for review
→ full-validation
→ merge-gate
```

See `15_DEVELOPMENT_WORKFLOW.md` and `16_CI_AND_REPOSITORY_GATES.md`.

The repository is private on the current free GitHub plan, so protected-branch/ruleset enforcement is unavailable and the owner has accepted manual repository-gate enforcement. This does not change the required review/validation sequence.

Recent later-P5/P6 GitHub Actions attempts also exposed a separate hosted infrastructure incident: jobs failed before runner allocation with `runner_id = 0` and `steps = []`. Those runs are infrastructure/no-runner evidence, not green CI and not repository test failures. This historical record does not authorize future merges without a green `merge-gate` and does not redefine the required CI policy.

## Site shell

The project includes a real homepage at `/`.

It is not a placeholder and is not left for the agent to invent.

Its structural contract lives in `18_HOMEPAGE_AND_SITE_SHELL.md`.

P6.3 finalized the live v1 catalog composition with the canonical featured four and live-only category directory. P7 found that composition compatible with current acquisition evidence and did not churn it merely to mirror keyword ranking. P8.2 found no static claims/metadata reason to change that composition.

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
