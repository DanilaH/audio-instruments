# Browser Audio Lab

A browser-first suite of audio diagnostics and signal utilities.

The product is built around three non-negotiable qualities:

```text
useful
beautiful
honest
```

The working visual direction is **Soft Sonic Studio**: a warm, friendly, expressive browser audio lab rather than a generic utility site.

## Documentation status

Documentation baseline: **v1.16**

Implementation status:

```text
P0–P6.3 functional roadmap    IMPLEMENTED
P7 SEO evidence refresh       COMPLETED — fresh Runner evidence reviewed and applied
P8 final audit / release      IN PROGRESS — indexing foundation, static audit and sitemap/positive-indexing gate complete
```

All 16 core v1 tool routes are live, and P6.3 final catalog homepage composition is merged. P7 retained the full route set, assigned evidence-backed acquisition/support/completeness roles, found no justified slug migrations, and applied narrow metadata wording changes without changing tool behavior.

Reviewed P7 evidence: `docs/evidence/P7_AUDIO_EVIDENCE_2026-08-30.md`.

P8.1 centralizes the `SITE_INDEXING` / `SITE_ORIGIN` policy, keeps public preview pages crawlable but `noindex,nofollow`, omits production canonicals by default, and serves an environment-aware `/robots.txt`.

P8.2 completed a static release audit on main baseline `dad7ec774659123a65fa279747c403e9d0db3ac3`. Measurement/claims wording, final static metadata, page-level H1 identity, live-only related links and current core-v1 privacy copy were clean; no runtime/source-copy change was justified. Evidence: `docs/evidence/P8_STATIC_RELEASE_AUDIT_2026-08-30.md`. This does not certify runtime accessibility, visual QA, browser/device behavior, production indexing, analytics/privacy-provider compliance, deployment or CI.

P8.3 installed `@astrojs/sitemap@3.7.3`, made Astro config the single activation owner for `SITE_INDEXING` / `SITE_ORIGIN`, and added a real positive indexed-build verifier. Supported local validation on Node `24.16.0` / pnpm `11.21.0` passed frozen install, `pnpm check`, all 172 unit tests and `pnpm test:indexing`; the verifier built `/`, `/privacy` and all 16 live tool routes at the synthetic origin `https://indexing-test.example`, then verified robots, canonical and sitemap consistency. Evidence: `docs/evidence/P8_INDEXING_VALIDATION_2026-08-30.md`.

`PRODUCTION_INDEXING_ARTIFACTS_READY = true` now means the repository contains the required sitemap/indexing artifacts. It is **not** production release authorization. Default builds remain `noindex,nofollow` with no production canonical or sitemap. Real production indexing still requires the remaining P8 gates plus explicit `SITE_INDEXING=enabled` and a valid real HTTPS `SITE_ORIGIN` during deployment.

The original cold pre-code review on 2026-08-28 closed with:

```text
BLOCKER = 0
MAJOR = 0
```

The repository intentionally remains private on the current free GitHub plan. Protected branches/rulesets are unavailable, and the owner has explicitly accepted **manual gate enforcement**. The documented PR/review/CI sequence still requires a green `merge-gate` before merge; GitHub simply does not mechanically make owner/admin bypass impossible.

A GitHub Actions infrastructure incident is also recorded: on later P5/P6 PRs, hosted jobs repeatedly failed before runner allocation with `runner_id = 0` and `steps = []`. Those attempts are **not** represented as green CI. Affected merge history carries exact-SHA review evidence and explicit infrastructure incident notes. This records what happened; it does not authorize future merges without a green `merge-gate`.

Remaining P8 work includes Playwright release execution, runtime accessibility/visual QA, real-device/browser QA, analytics/privacy decisions, deployment, Search Console, explicit final indexing activation on a real production domain and final validation evidence.

## Stack

Locked baseline:

- Astro static output / MPA
- strict TypeScript
- plain CSS with custom properties
- Web Audio API
- MediaDevices APIs
- Canvas / SVG
- Motion
- Phosphor Icons
- pnpm `11.21.0`
- Node `24` LTS pinned in `.nvmrc`; `package.json` enforces `>=24.16 <25`
- Vitest
- Playwright
- ESLint
- Prettier

Not baseline:

- SSR
- React / Vue / Svelte
- Tailwind
- global state libraries
- backend / database / auth
- Rive at bootstrap
- OGL / Three.js / heavy WebGL

## Documentation

Read [`AGENTS.md`](AGENTS.md) before making changes.

Authoritative docs:

```text
docs/
├── 00_OVERVIEW.md
├── 01_RESEARCH_AND_EVIDENCE.md
├── 02_PRODUCT_SCOPE.md
├── 03_TOOL_SPECS.md
├── 04_VISUAL_SYSTEM.md
├── 05_UX_UI.md
├── 06_ARCHITECTURE.md
├── 07_BROWSER_CAPABILITIES.md
├── 08_MEASUREMENT_HONESTY_AND_SAFETY.md
├── 09_SEO_ARCHITECTURE.md
├── 10_TESTING_AND_QA.md
├── 11_RELEASE_AND_ANALYTICS.md
├── 12_DECISIONS_AND_BOUNDARIES.md
├── 13_BACKLOG_AND_ROADMAP.md
├── 14_ACCEPTANCE_CRITERIA.md
├── 15_DEVELOPMENT_WORKFLOW.md
├── 16_CI_AND_REPOSITORY_GATES.md
├── 17_TECHNICAL_REFERENCES.md
├── 18_HOMEPAGE_AND_SITE_SHELL.md
├── 19_PRIVACY_AND_LEGAL.md
├── 20_P0_TOOLING_CONTRACT.md
├── CHANGELOG.md
└── evidence/
    ├── competitor-evidence.csv
    ├── MANUAL_AHREFS_2026-08-28.md
    ├── P7_AUDIO_RUNNER_SEEDS.csv
    ├── P7_AUDIO_RUNNER_SEEDS_2026-08-30.csv
    ├── P7_RUNNER_EXECUTION.md
    ├── P7_AUDIO_EVIDENCE_2026-08-30.md
    ├── P8_STATIC_RELEASE_AUDIT_2026-08-30.md
    └── P8_INDEXING_VALIDATION_2026-08-30.md
```

Each concern has one authoritative home. Do not recreate a second master specification.

## Core v1 catalog

1. Sound Test / Audio Test
2. Speaker Test
3. Headphone Test
4. Stereo Test
5. Phase / Polarity Test
6. Surround Sound Test
7. Bass / Subwoofer Test
8. Tone Generator
9. Frequency Sweep Test
10. Microphone Test
11. Spectrum Analyzer
12. Audio Latency / AV Sync Test
13. Hearing Frequency Test
14. Decibel / Sound Meter
15. Noise Generator
16. Pitch Detector

All 16 are implemented as live routes in the current P0–P8 baseline.

A route represents a distinct user job, not a keyword synonym.

## Development workflow

The repository uses a strict PR/review workflow.

Short form:

```text
development
→ checkpoint commit + push
→ Draft PR
→ cold Review #1
→ fixes
→ reviewed commit(s)
→ cold Review #2
→ add `full-ci-approved`
→ mark PR Ready for review
→ only then full typecheck/tests/browser/build gate
→ fix + re-review + rerun if needed
→ green CI
→ merge
→ update main
→ next development branch
```

See `docs/15_DEVELOPMENT_WORKFLOW.md`.

The no-runner incident above is an infrastructure incident observed during implementation, not a replacement workflow definition or merge authorization.

## Visual rule

Audio must not collapse into:

```text
grey background
white card
black text
blue button
```

The instrument itself carries much of the visual identity.

The dynamic waveform motif may use a subtle blur and a short disappearing trail.

## Measurement rule

Before displaying a result, classify it as:

```text
browser-known / generated
browser-reported / estimated
user-observed physical behavior
```

Never claim stronger certainty than the test method supports.

P7 SEO wording does not weaken this rule. In particular, Decibel Meter remains dBFS-first and Audio Latency remains explicit about browser-reported versus perception-based evidence. P8.2 found no static release-copy violation of this boundary on its exact reviewed baseline.

## Support claim boundary

Automated Playwright regression uses Chromium, Firefox and WebKit.

Production browser support is not inferred from those engines alone.

P8 includes recorded smoke QA on actual Safari macOS, iOS Safari, Android Chrome and Edge in addition to desktop Chrome/Firefox.

## Fixed dependency identities

The initial browser-side packages are:

```text
motion
@phosphor-icons/web
```

P8 additionally uses the release-only build integration:

```text
@astrojs/sitemap@3.7.3
```

Do not substitute React/Vue icon or Motion bindings.

Import only the Phosphor weights actually used; do not load the complete icon-font bundle.

Exact resolved package versions are pinned by `pnpm-lock.yaml`.

## CI merge-gate rule

The required CI check defined by repository policy is:

```text
merge-gate
```

`full-validation` may be skipped before Review #2, but **merge-gate never treats that skip as approval**.

Before authorization:

```text
merge-gate = failure
```

After Review #2 + `full-ci-approved` + Ready:

```text
full-validation runs
→ merge-gate passes only if full-validation succeeds
```

Current private-plan/manual-gate limitations and the recorded no-runner incident do not change the normative CI contract.

## Documentation freeze rule

v1.16 records P8.3 sitemap/indexing artifact readiness and positive build evidence. It does not claim a production domain, Playwright release execution, runtime accessibility/visual QA, real-device/browser QA, analytics, deployment, Search Console, final production indexing activation or green hosted CI are complete.

Current rule:

```text
do not run speculative documentation churn
update source of truth only from implementation / CI / browser / runner evidence or explicit owner decisions
```

Further source-of-truth edits require evidence from:

```text
real implementation
real CI behavior
real browser/device QA
new runner evidence
or a newly discovered blocking factual error
```

Medium/minor theoretical polish alone does not reopen documentation review.
