# 13 — Backlog and Roadmap

## Phase rule

Each implementation unit follows `15_DEVELOPMENT_WORKFLOW.md`.

Do not begin the next roadmap unit before the current one is merged unless explicit parallel work is approved.

## Current checkpoint — 2026-08-30

```text
P0–P6.3 implemented and merged
all 16 core v1 tool routes live
P7 live Runner evidence collected, reviewed and applied; P7 complete in the current source baseline
P8 in progress: P8.1 safe indexing foundation, P8.2 static claims/metadata release audit and P8.3 sitemap/positive-indexing build gate complete; runtime/release gates remain pending
```

P7 live-run provenance and decisions are preserved in `docs/evidence/P7_AUDIO_EVIDENCE_2026-08-30.md`.

P8 static release-audit evidence is preserved in `docs/evidence/P8_STATIC_RELEASE_AUDIT_2026-08-30.md`.

## P0 — Repository bootstrap

Deliver:

```text
Astro static scaffold
real `/` homepage structural shell
strict TypeScript
pnpm lockfile
.gitignore
Active LTS Node pin
base styles/tokens
motion
@phosphor-icons/web
typed tool registry with planned/live status
Vitest
@playwright/test
playwright.config.ts
/privacy static route
TypeScript + @astrojs/check
ESLint + typescript-eslint + eslint-plugin-astro
eslint.config.mjs
Prettier + prettier-plugin-astro
.prettierrc.mjs
.github/workflows/ci.yml
.github/dependabot.yml
document/verify main branch protection
docs
```

Do not install:

```text
SSR adapter
React/Vue/Svelte
global state library
i18n system
Rive
OGL
Three.js
backend/database/auth
```

## P1 — Shared foundations

Implement:

```text
AudioSession
AudioOutputEngine
NoiseEngine primitive required by phase tests
master gain/headroom
safe ramps
pan/channel primitives
sweep primitive
cleanup
WaveformCanvas
shared control primitives
```

## P2 — Tone Generator and homepage visual integration

### P2.1 Tone Generator

Implement complete baseline from `03_TOOL_SPECS.md`.

Then PR/review/validation/merge.

### P2.2 Homepage Tone integration

Apply the proven visual system to the homepage shell and the now-live Tone Generator.

Do not create Speaker/Mic/Headphone placeholders.

Then PR/review/validation/merge.

## P3 — Output diagnostics

Recommended PR units:

```text
P3.1 Sound Test
P3.2 Stereo + Phase
P3.3 Speaker Test
P3.4 Headphone Test
P3.5 Multichannel foundation + Surround Test
```

Do not combine all P3 work into one huge PR.

## P4 — Frequency/noise/bass

```text
P4.1 Bass Test
P4.2 Frequency Sweep
P4.3 Noise Generator
```

## P5 — Microphone/analysis

```text
P5.1 MicrophoneService + AudioAnalyzer
P5.2 Microphone Test + AudioRecorder
P5.3 Spectrum Analyzer
P5.4 Pitch Detector
P5.5 Decibel Meter
```

Algorithms/defaults are already specified in `03_TOOL_SPECS.md`.

## P6 — Specialist tools

```text
P6.1 Audio Latency / AV Sync
P6.2 Hearing Frequency Test
```

Surround is implemented in P3 with output diagnostics because it shares the output architecture.

## P6.3 — Final catalog homepage composition

After all P0–P6 tool routes are live:

```text
final featured four
final category composition
final live-only navigation audit
desktop/mobile homepage review
```

Then PR/review/validation/merge.

## P7 — SEO evidence refresh

Current state: **complete in the current source baseline**.

Completed evidence path:

```text
63-seed fresh discovery
→ SERP clustering
→ targeted deep enrichment
→ representative queries
→ entrant cohort
→ cohort history
→ finalist evidence matrix
→ human route/intent review
```

Final decisions:

```text
keep all 16 live routes
no synonym routes
no slug migrations
no functional changes
assign acquisition/support/completeness SEO roles
apply narrow evidence-backed metadata wording
preserve traffic velocity as unavailable
preserve geo/history/provider/provenance gaps explicitly
```

Canonical reviewed record:

```text
docs/evidence/P7_AUDIO_EVIDENCE_2026-08-30.md
```

Do not reopen P7 for speculative keyword/content churn. Reopen only from new material evidence or a blocking contradiction.

## P8 — Final audit / launch

Current state: **in progress**.

### P8.1 — Safe indexing-gate foundation

Implemented:

```text
central SITE_INDEXING / SITE_ORIGIN policy
strict HTTPS origin-only validation
default crawlable noindex,nofollow metadata
no default production canonical
environment-aware /robots.txt
canonical origin-lock against route-text host escape
unit validation of origin/canonical/robots policy
browser regression across /, /privacy and all 16 live tool routes
```

P8.1 originally kept production indexing mechanically blocked until the sitemap/positive-build artifacts landed. P8.3 has now satisfied that artifact prerequisite. The release remains fail-closed by default because no `site` is configured unless `SITE_INDEXING=enabled` and a valid HTTPS `SITE_ORIGIN` are both supplied.

### P8.2 — Static release audit

Reviewed against main baseline `dad7ec774659123a65fa279747c403e9d0db3ac3`:

```text
measurement/claims wording across homepage, privacy and all 16 live tools
final static page titles/descriptions against P7 intent ownership
page-level H1 identity
live-only related-tool link construction
core-v1 privacy copy against current local processing/storage behavior
```

Result: **clean; no runtime/source-copy change justified**.

Canonical audit record:

```text
docs/evidence/P8_STATIC_RELEASE_AUDIT_2026-08-30.md
```

P8.2 is a static source audit only. It does not certify runtime accessibility, visual geometry, real browser/device behavior, Playwright execution, production indexing, analytics/privacy-provider compliance, deployment or CI.

### P8.3 — Sitemap and positive indexing build gate

Implemented and locally validated on supported runtime:

```text
@astrojs/sitemap 3.7.3 with pnpm-generated lockfile
Astro config as the single SITE_INDEXING / SITE_ORIGIN activation owner
runtime canonical/robots policy derived from resolved Astro.site
sitemap emitted only for an explicitly enabled valid HTTPS origin
preview/default build remains noindex,nofollow with no canonical and no sitemap
positive indexed-build verifier across /, /privacy and all 16 live tool routes
robots.txt + sitemap-index.xml + sitemap-0.xml + canonical/sitemap consistency checks
positive indexing verifier added to full-validation
```

Supported local validation on Node `24.16.0` / pnpm `11.21.0` established:

```text
pnpm install --frozen-lockfile PASS
pnpm check PASS
pnpm test PASS (172/172)
pnpm test:indexing PASS
```

The positive verifier built all 18 HTML routes against synthetic origin `https://indexing-test.example` and verified robots, canonical URLs, sitemap index and sitemap membership. The synthetic origin is test evidence only; it is not product configuration and is never a production-domain substitute.

`PRODUCTION_INDEXING_ARTIFACTS_READY = true` now means only that the repository contains the required sitemap/indexing artifacts. It does **not** authorize release activation by itself. Production indexing still requires the remaining P8 release gates plus an explicit real-domain `SITE_INDEXING=enabled` / `SITE_ORIGIN=https://...` deployment decision.

Remaining P8 work:

```text
use the real production domain; do not invent one
Playwright release execution
runtime accessibility review
visual QA
real-browser QA matrix
real-device QA
analytics/privacy-provider decision and implementation where approved
deploy
GSC
explicit production indexing activation
green CI / final validation evidence
```

P8 must not enable production indexing merely because P7 has evidence or because P8.3 makes the positive build path technically available. Production indexability remains an explicit release decision after the remaining gates pass.

## Polish backlog

May happen after functional merges:

```text
waveform trail tuning
illustration refinement
homepage composition
Rive hero experiment
microinteraction tuning
grain/texture refinement
```

Polish does not reopen locked architecture/product decisions and does not bypass the P7/P8 phase gates.

## P0 repository-gate setup

Target repository controls:

```text
main requires PR
direct pushes blocked
required check = merge-gate
squash merge enabled/used
Draft PR workflow verified
Ready-for-review CI trigger verified
```

Repository observation: the repository is private on the current free GitHub plan and the connected GitHub API reports protected-branch/ruleset functionality unavailable. The owner has explicitly accepted **manual repository-gate enforcement** for this setup. Do not claim the gate is mechanically unbypassable unless repository visibility/plan changes and protection is actually verified.

A separate later implementation incident has also been observed: some hosted GitHub Actions jobs fail before runner allocation with `runner_id = 0` and `steps = []`. Treat that signature as infrastructure/no-runner evidence, not a green validation result and not a repository test failure. The required green `merge-gate` workflow remains normative; the incident record does not redefine it.

## Deferred architecture — do not build in P0–P6

```text
OutputDeviceSelector
Rive
generic cross-page AudioContext singleton
```

These require a future explicit task, not anticipatory infrastructure.

## P0 package metadata contract

`package.json` includes:

```json
{
  "packageManager": "pnpm@11.21.0",
  "engines": {
    "node": ">=24.16 <25"
  }
}
```

The package version and Node major must match CI and `.nvmrc`.

## P0 browser-test configuration contract

`playwright.config` includes Chromium, Firefox and WebKit projects.

Automated WebKit is regression coverage only; actual Safari/iOS QA remains P8.

## P0 validation-tooling gate

Implemented baseline satisfies the existing contract:

```text
astro check works with @astrojs/check + TypeScript
ESLint processes .astro + .ts
Prettier processes .astro
test = vitest run
test:browser builds before Playwright preview
Playwright retries = 0
merge-gate is the required CI check in repository policy
Dependabot monitors GitHub Actions and npm dependencies
```

P0 CI must have at least one real Vitest suite and one real Playwright suite.

Mechanical branch-protection enforcement remains unavailable under the current private/free-plan repository mode and is tracked separately from the implemented tooling baseline.

## P0 mandatory bootstrap tests

Implemented:

```text
tests/unit/registry.test.ts
tests/browser/shell.spec.ts
```

Do not make empty test suites pass by configuration.