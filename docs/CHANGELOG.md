# Documentation Changelog

## v1.14 — 2026-08-30

P8.1 fail-closed indexing-gate foundation.

Changes:

- started P8 without enabling production indexing prematurely;
- centralized `SITE_INDEXING` / `SITE_ORIGIN` policy and strict absolute HTTPS origin-only validation;
- kept preview/public non-final builds crawlable while pages remain `noindex,nofollow` with no production canonical;
- added an environment-aware `/robots.txt` endpoint that allows crawling and omits a Sitemap directive while indexing is disabled;
- added canonical URL generation that is locked to the validated configured origin, including a regression against protocol-relative route text escaping to another host;
- added unit coverage for disabled/enabled policy behavior and invalid production origins;
- added browser regression coverage for default noindex/no-canonical behavior on `/`, `/privacy`, and all 16 live tool routes;
- added `PRODUCTION_INDEXING_ARTIFACTS_READY = false` as an intentional fail-closed guard so `SITE_INDEXING=enabled` cannot emit partially configured indexable output before sitemap integration and positive indexed-build validation land together;
- left `@astrojs/sitemap`, the real production domain, positive indexed-build/sitemap validation, real-device/browser QA, analytics/privacy-provider decisions, deployment, GSC and final indexing activation pending in P8;
- synchronized README, AGENTS, Overview, Roadmap and Manifest to `P8 in progress` without claiming tests or hosted CI are green.

## v1.13 — 2026-08-30

P7 live Audio evidence review and evidence-backed SEO closeout.

Changes:

- preserved the actual 63-seed direct-run cohort used for P7, including the 25 explicit task/problem-intent variants added after the original 38-seed contract;
- recorded completed discovery (63/63), 24 finalist SERP clusters, 29 representative selections, 203 entrant-domain rows, cohort history and the finalist evidence matrix;
- selected and recorded the Audio history policy (`730 / 365 / 730` days);
- preserved the physical Google-location mismatch, domain/site-structure caps, unavailable first-seen evidence, page-fetch gaps and missing exact local Runner SHA as explicit limitations rather than fabricating provenance;
- recorded traffic velocity as unavailable because no provider-neutral V2.1 traffic series was imported; retained older manual Ahrefs snapshots only as supplemental single-snapshot evidence;
- assigned acquisition-anchor, strong-supporting and completeness roles while keeping all 16 v1 routes live;
- rejected thin synonym routes and found no evidence strong enough to justify slug migrations;
- applied narrow evidence-backed metadata wording to Tone, Headphone, Microphone, Pitch, Decibel and Noise pages without changing H1 product identity or tool behavior;
- retained dBFS-first, latency-estimate and other measurement/safety boundaries despite search wording;
- synchronized README, AGENTS, Overview, Research, SEO Architecture, Roadmap and Manifest to the reviewed P7 state;
- left production indexing, sitemap/canonical implementation, real-device/browser QA, analytics and release decisions in P8.

## v1.12 — 2026-08-30

P7 Runner-prerequisite synchronization and reproducible Audio evidence contract.

Changes:

- recorded that the upgraded `super-converter-parser` V2.1 analytical evidence pipeline is now available, so P7 is no longer blocked at the Runner-capability level;
- kept P7 incomplete until an Audio-specific live Research Chrome / Keyword Surfer run is executed and reviewed;
- added the canonical targeted Audio seed cohort covering all 16 current v1 user jobs;
- added the P7 Runner execution contract with explicit Runner-SHA provenance, fresh-cache bypass, no initial expansion, US/en/us config pinning, enrichment, representative-query, entrant-cohort, history, traffic and finalist-matrix stages;
- preserved geo mismatch as separate evidence rather than treating `gl=us` as proof of physical US localization;
- prohibited evidence-dependent role/slug/internal-link changes before live artifacts are reviewed;
- left history and traffic interpretation thresholds unset until explicit P7 evidence review instead of inventing hidden defaults;
- synchronized README, AGENTS, Overview, Roadmap and Manifest to the `Runner available / live Audio evidence pending` state;
- kept P8 phase-gated after completed P7;
- made no functional tool, architecture, measurement, safety or production-indexing changes.

## v1.11 — 2026-08-29

Post-P6.3 implementation-evidence synchronization.

Changes:

- recorded P0–P6.3 as implemented and merged, with all 16 core v1 tool routes live;
- recorded P6.3 final catalog homepage composition as merged to `main` at `0be4128242ddeab669cbc8374e9fc9b9b5bd23ac`;
- synchronized README, AGENTS, Overview, Roadmap and Manifest so they no longer describe the repository as pre-P1 or merely implementation-ready;
- recorded that P7 remains blocked by its explicit upgraded SEO runner prerequisite and must not be substituted with ordinary source polish;
- kept P8 phase-gated after P7, with real-device/browser QA and production decisions remaining inside P8 scope;
- recorded the later-P5/P6 hosted GitHub Actions infrastructure signature `runner_id = 0`, `steps = []` as no-runner evidence rather than green CI or a repository test failure;
- preserved the required green `merge-gate` workflow as normative and did not add a reusable no-runner waiver mechanism;
- retained owner-approved manual repository-gate enforcement because protected branches/rulesets remain unavailable for the current private/free-plan setup;
- made no product-code, tool-behavior, architecture, SEO-strategy or launch-scope changes in this documentation synchronization.

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
- validated the scaffold with frozen install, Prettier, ESLint, `astro check`, Vitest and production build before required review passes;
- adopted the owner-approved autonomous review mode: the project assistant performs Review #1 and Review #2 itself as distinct cold passes over the actual PR diff; casual implementation-time self-checking still does not count.

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
