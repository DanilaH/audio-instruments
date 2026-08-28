# 13 — Backlog and Roadmap

## Phase rule

Each implementation unit follows `15_DEVELOPMENT_WORKFLOW.md`.

Do not begin the next roadmap unit before the current one is merged unless explicit parallel work is approved.

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

Wait for upgraded runner.

Then:

```text
cohorts
target intent
velocity
moat
role update
slug review
internal-link review
```

## P8 — Final audit / launch

```text
real-device QA
real-browser QA matrix
Playwright regression QA
visual QA
accessibility
claims audit
metadata
install/configure @astrojs/sitemap (P8 only)
environment-aware robots.txt
explicit SITE_INDEXING/SITE_ORIGIN production gate
positive indexed-build/sitemap tests
analytics
deploy
GSC
```

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

Polish does not reopen locked architecture/product decisions.

## P0 repository-gate setup

Before the first roadmap PR can merge:

```text
main requires PR
direct pushes blocked
required check = merge-gate
squash merge enabled/used
Draft PR workflow verified
Ready-for-review CI trigger verified
```

This setup is part of P0 acceptance, not future DevOps polish.

Current repository observation (2026-08-28): the repository is private and the connected GitHub API reports protected-branch/ruleset functionality unavailable on the current plan. Until visibility/plan changes or the user explicitly accepts temporary manual enforcement, P0 must not claim mechanical repository-gate completion.

## Deferred architecture — do not build in P0–P6

```text
OutputDeviceSelector
Rive
generic cross-page AudioContext singleton
```

These require a future explicit task, not anticipatory infrastructure.

## P0 package metadata contract

When `package.json` is created, it must include:

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

Create `playwright.config` with at least Chromium, Firefox and WebKit projects.

Automated WebKit is regression coverage only; actual Safari/iOS QA remains P8.

## P0 validation-tooling gate

P0 is not complete until:

```text
astro check works with @astrojs/check + TypeScript
ESLint processes .astro + .ts
Prettier processes .astro
test = vitest run
test:browser builds before Playwright preview
Playwright retries = 0
merge-gate is the required branch-protection check
Dependabot monitors GitHub Actions and npm dependencies
```

## P0 mandatory bootstrap tests

Create before P0 review:

```text
tests/unit/registry.test.ts
tests/browser/shell.spec.ts
```

P0 CI must have at least one real Vitest suite and one real Playwright suite.

Do not make empty test suites pass by configuration.
