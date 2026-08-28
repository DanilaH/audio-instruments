# Documentation Changelog

## v1.10 — 2026-08-28

P0 implementation-evidence synchronization.

Changes:

- recorded the P0 repository bootstrap implementation as the first post-freeze evidence-driven documentation update;
- kept pnpm 11 supply-chain protections enabled after `astro@7.2.9` was rejected by minimum-release-age verification and pinned the validated mature `astro@7.2.4` instead of weakening the policy;
- added the narrow `pnpm-workspace.yaml` lifecycle-script allowlist for required `esbuild` installation rather than allowing arbitrary dependency build scripts;
- added `@types/node` because the real strict Astro/TypeScript check includes Node-hosted configuration using `process.env.CI`;
- documented the narrow Phosphor Regular side-effect module declaration required by Astro/TypeScript validation;
- separated Vitest unit discovery from Playwright browser discovery through `vitest.config.ts`;
- expanded registry acceptance coverage to the complete 16-tool set with unique ids/routes;
- expanded browser smoke coverage so every planned tool route must remain `404` until implementation and `live` promotion happen together;
- validated the scaffold with frozen install, Prettier, ESLint, `astro check`, Vitest and production build before independent review.

## v1.9 — 2026-08-28

Final pre-code repository hardening pass.

Changes:

- completed the requested cold pre-code review with `BLOCKER = 0`, `MAJOR = 0` after the fixes below;
- added a one-time empty-repository bootstrap exception so the baseline can be seeded before the normal PR loop exists;
- recorded the current GitHub private-plan limitation: protected branches/rulesets are unavailable, so repository-gate mode is manual until visibility/plan changes or explicit temporary-manual approval;
- added `.gitignore` to the repository bootstrap baseline;
- aligned ESLint with the current recommended flat-config baseline by adding `@eslint/js` recommended rules;
- fixed Playwright diagnostics: retries remain `0`, but failed runs now retain traces/screenshots;
- added failure-only `test-results` upload through `actions/upload-artifact@v7`;
- corrected README wording that previously implied `package.json` already existed before P0;
- removed the conflicting broad `prettier --check .` wording so the exact source/tests/config formatting script is the single P0 contract.

## v1.8 — 2026-08-28

Final pre-code micro-hardening and documentation freeze.

Changes:

- hardened branch protection against administrator/maintainer bypass;
- required no force-push / no deletion and GitHub Actions source binding where supported;
- added repository-plan capability check before claiming mechanical enforcement;
- added mandatory real P0 Vitest and Playwright bootstrap tests;
- added concrete registry unit test and homepage/privacy browser smoke test skeletons;
- added direct `@typescript-eslint/parser` P0 dependency;
- raised supported Node floor to `>=24.16 <25` and `.nvmrc` to `24.16.0`;
- fixed Spectrum history to timestamp-based 10-second eviction rather than column-count implication;
- made AV Sync stop/reset when the document becomes hidden;
- repeated local Stop affordances in tool specs where agent readability benefited;
- limited Prettier checks to source/tests/config to avoid documentation-only mass formatting churn;
- froze documentation after v1.8 until implementation evidence justifies reopening it.

## v1.7 — 2026-08-28

Coldest-review merge/tooling/execution closure.

Changes:

- replaced the vulnerable skipped-required-job model with an always-running required `merge-gate`;
- added authorization/full-validation/merge-gate CI job architecture;
- made unauthorized or skipped validation produce merge-gate failure rather than implicit success;
- synchronized README/AGENTS/Overview/Manifest/workflow wording around `full-ci-approved`;
- added exact P0 Astro tooling contract;
- added concrete ESLint/Prettier configs and Dependabot configuration;
- made lint explicitly include `.astro` and Prettier explicitly use `prettier-plugin-astro`;
- made `test:browser` standalone-safe by building before Playwright preview;
- set Playwright merge-gating retries to zero;
- fixed Web Audio latency seconds-to-milliseconds conversion;
- specified a shared future-anchor AV Sync scheduling clock supporting negative offsets;
- required exact `deviceId` selection and shared input-selector behavior across mic-analysis tools;
- specified Surround individual controls, Test All order/timing and mode switching;
- phase-gated positive sitemap/indexing tests to P8;
- fixed Spectrum spectrogram history to 10 s / 300 columns;
- changed canonical deterministic noise-buffer generation to 44.1 kHz for the fixed pink coefficients;
- specified MediaRecorder auto-stop/finalization/tool-stop ordering;
- fixed Speaker channel controls and Stereo Center = shared Both;
- explicitly chose major-tag Actions pins + Dependabot rather than full SHA pins;
- fixed homepage pre-first-tool CTA behavior;
- tightened calibrated-level terminology.

## v1.6 — 2026-08-28

Coldest-review closure pass.

Changes:

- mechanically gated full CI behind `full-ci-approved` + Ready state;
- removed early non-Draft `opened` full-CI behavior;
- fixed public staging indexing: crawlable noindex, not robots-disallowed;
- specified private staging as hosting-layer access controlled;
- made homepage/navigation strictly live-only with no unfinished links/routes;
- moved final featured-four homepage composition to after all P0–P6 tools are live;
- added `/privacy` route/source of truth;
- specified exact Playwright preview/webServer/baseURL/scripts contract and concrete config;
- added CI media-mock boundary without confusing mocks with real hardware QA;
- made surround capability require successful configuration + readback;
- added global generated-audio low-system-volume guidance;
- locked Hearing Guided app Level to -36 dB;
- specified atomic microphone device switching and device-loss behavior;
- added BFCache pagehide/pageshow remount contract;
- weakened Sound Meter wording to one-point reference-calibrated estimate;
- specified canonical linear/log sweep math and scheduling;
- fixed deterministic noise generation at canonical 48 kHz;
- fixed Both-channel per-channel amplitude semantics;
- clarified AV Sync granularity vs accuracy;
- fixed concrete dependency identities (`motion`, `@phosphor-icons/web`);
- added durable manual Ahrefs evidence artifact;
- specified @astrojs/sitemap / robots implementation ownership for P8.

## v1.5 — 2026-08-28

Mega-cold-review canonicalization and runtime/safety pass.

Changes:

- rewrote Decisions as current canonical state instead of cumulative historical layers;
- rewrote Measurement/Safety to remove superseded gain/calibration wording;
- made AudioSession a first-class P1 primitive;
- fixed AudioContext construction and analysis sample-rate semantics;
- removed getOutputTimestamp from the v1 latency-service contract;
- prohibited live microphone routing to the audible destination;
- added executable global Stop/lifecycle rules;
- hardened Hearing safety and narrowed result wording;
- removed sub-20 Hz Bass generation from core v1;
- bounded YIN CPU with downsampling, tau limits and <=20 Hz cadence;
- restricted SPL reference calibration to Z/Flat/Linear references and documented one-point limitations;
- replaced pnpm/action-setup with pnpm/setup@v2;
- added `opened` to non-draft CI triggers;
- separated Playwright regression engines from real Safari/mobile certification;
- added real-browser P8 QA matrix;
- added explicit default-noindex SITE_INDEXING/SITE_ORIGIN gate;
- separated navigationCategory from implementationPhase;
- hardened MediaRecorder candidate fallback;
- added noise loop-boundary conditioning and remaining playback semantics;
- added semantic accent/focus contrast rules.

## v1.4 — 2026-08-28

Execution-hardening review.

Changes:

- defined tool-local AudioSession/AudioContext ownership and disposal;
- corrected generated Level semantics from pseudo-dBFS target to master gain relative to unity;
- specified exact 100 ms PCM RMS/peak/dBFS meter math;
- made SPL calibration require AGC/noise suppression/echo cancellation all explicitly false;
- added stable 3 second calibration capture and rejection criteria;
- added MediaRecorder MIME capability negotiation;
- separated hard channel routing from continuous panning;
- expanded YIN frame sizes to 8192 for high sample-rate input;
- specified exact seeded noise PRNG, coefficients and buffer durations;
- fixed AV Sync offset sign convention;
- corrected Web Audio 5.1 labels to Surround Left/Surround Right;
- added real homepage/site-shell specification and roadmap stage;
- prohibited aria-live on rapidly updating measurements;
- deferred OutputDeviceSelector and getOutputTimestamp abstractions;
- pinned pnpm 11.21.0 and Node 24 baseline;
- updated GitHub Actions workflow to checkout v7, setup-node v7 and pnpm/action-setup v6;
- added `.nvmrc`.

## v1.3 — 2026-08-28

Second hardening review.

Changes:

- made required reviews independent from the implementing agent;
- made Draft → Ready for review the mechanical full-CI trigger;
- added CI/branch-protection source of truth;
- added concrete GitHub Actions full-validation workflow;
- fixed 5.1 vs non-standardized 7.1 claims;
- added explicit destination channel-count configuration;
- reclassified 8-channel output as experimental discrete mode;
- added Nyquist-safe generated-frequency limits;
- selected getFloatFrequencyData() as Spectrum's canonical dB path;
- made SPL calibration device-scoped;
- disabled calibrated mode when AGC is true or unknown;
- specified YIN refinement, confidence and note/cents formulas;
- specified deterministic white/pink/brown noise algorithms and normalization;
- fixed Level control semantics to digital dB rather than percent;
- added privacy/compliance production gate for analytics/ads;
- expanded evidence-ledger provenance;
- added official technical-reference ledger.

## v1.2 — 2026-08-28

Documentation hardening after full review.

Changes:

- removed patch-style `v1.1 additions` structure;
- normalized heading hierarchy;
- made P0–P6 explicitly implementation-ready;
- added exact tool/job overlap matrix;
- added Tool → Service dependency matrix;
- added strict import boundaries;
- corrected generated-signal `dBFS` wording;
- documented dB → GainNode conversion;
- added normalization/headroom/clipping policy;
- fully specified Spectrum defaults;
- selected YIN as v1 Pitch Detector algorithm;
- specified dB meter timing/calibration persistence;
- specified Surround channel mapping and honest stereo fallback;
- specified Latency manual sync flow;
- specified Hearing Frequency guided flow;
- added structured competitor evidence ledger;
- added mandatory PR/review/validation/CI workflow;
- separated checkpoint commit mechanics from reviewed implementation commits.

## v1.1

Added initial implementation/tooling boundaries.

## v1.0

Initial multi-document repository specification.
