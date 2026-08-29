# 13 — Backlog and Roadmap

## Phase rule

Each implementation unit follows `15_DEVELOPMENT_WORKFLOW.md`.

Do not begin the next roadmap unit before the current one is merged unless explicit parallel work is approved.

## Current checkpoint — 2026-08-29

```text
P0–P6.3 implemented and merged
all 16 core v1 tool routes live
P7 blocked: wait for upgraded SEO runner
P8 phase-gated after P7 + real-device/browser QA + production decisions
```

Do not rename polish/audit work as P7 while its upgraded-runner prerequisite is unavailable.

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

Current gate: **blocked until the upgraded runner is available**.

Do not substitute manual source polish for this evidence phase.

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

A separate later implementation incident has also been observed: some hosted GitHub Actions jobs fail before runner allocation with `runner_id = 0` and `steps = []`. Treat that signature as infrastructure/no-runner evidence, not a green validation result and not a repository test failure. The intended green `merge-gate` workflow remains the normal target.

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

Implemented baseline:

```text
astro check works with @astrojs/check + TypeScript
ESLint processes .astro + .ts
Prettier processes .astro
test = vitest run
test:browser builds before Playwright preview
Playwright retries = 0
merge-gate is the intended required CI check
Dependabot monitors GitHub Actions and npm dependencies
```

Mechanical branch-protection enforcement remains unavailable under the current private/free-plan repository mode and is tracked separately from the implemented tooling baseline.

## P0 mandatory bootstrap tests

Implemented:

```text
tests/unit/registry.test.ts
tests/browser/shell.spec.ts
```

Do not make empty test suites pass by configuration.
