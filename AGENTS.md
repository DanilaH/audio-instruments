# AGENTS.md

Operational contract for coding agents working in this repository.

Read this file before changing code.

## 1. Authority order

When instructions conflict:

```text
1. explicit current user instruction
2. docs/12_DECISIONS_AND_BOUNDARIES.md
3. relevant authoritative topic document
4. docs/14_ACCEPTANCE_CRITERIA.md
5. docs/15_DEVELOPMENT_WORKFLOW.md
6. AGENTS.md
7. README.md
8. existing implementation conventions
```

Do not silently reconcile material conflicts.

## 2. Documentation ownership

```text
Overview / product thesis
→ docs/00_OVERVIEW.md

Research evidence
→ docs/01_RESEARCH_AND_EVIDENCE.md

Scope / jobs / route distinctions
→ docs/02_PRODUCT_SCOPE.md

Exact tool behavior and algorithms
→ docs/03_TOOL_SPECS.md

Visual system
→ docs/04_VISUAL_SYSTEM.md

UX / layout / states / accessibility
→ docs/05_UX_UI.md

Code architecture / imports / dependency map
→ docs/06_ARCHITECTURE.md

Browser capability / fallback policy
→ docs/07_BROWSER_CAPABILITIES.md

Claims / safety / signal-level policy
→ docs/08_MEASUREMENT_HONESTY_AND_SAFETY.md

SEO / routes / internal links
→ docs/09_SEO_ARCHITECTURE.md

Testing / QA
→ docs/10_TESTING_AND_QA.md

Release / analytics
→ docs/11_RELEASE_AND_ANALYTICS.md

Locked decisions / non-goals
→ docs/12_DECISIONS_AND_BOUNDARIES.md

Phases / backlog
→ docs/13_BACKLOG_AND_ROADMAP.md

Definition of Done
→ docs/14_ACCEPTANCE_CRITERIA.md

Git/PR/review process
→ docs/15_DEVELOPMENT_WORKFLOW.md

CI trigger / branch protection / merge policy
→ docs/16_CI_AND_REPOSITORY_GATES.md

External technical facts used by the specs
→ docs/17_TECHNICAL_REFERENCES.md

Homepage / site shell
→ docs/18_HOMEPAGE_AND_SITE_SHELL.md

Privacy/legal behavior
→ docs/19_PRIVACY_AND_LEGAL.md

P0 package/scripts/lint/format/test tooling
→ docs/20_P0_TOOLING_CONTRACT.md
```

## 3. Implementation status

P0–P6.3 are **implemented and merged** as of 2026-08-30, including all 16 core v1 tool routes and the final catalog homepage composition.

P7 fresh SEO evidence has now been collected, reviewed and applied. The reviewed source-of-truth record is:

```text
docs/evidence/P7_AUDIO_EVIDENCE_2026-08-30.md
```

P7 keeps all 16 routes, adds no synonym routes, makes no functional changes, and uses acquisition/support/completeness roles only to guide SEO emphasis. Evidence gaps such as the physical Google-location mismatch, capped domain-history coverage, unavailable first-seen evidence, unavailable traffic velocity and missing exact local Runner SHA remain explicit rather than being guessed away.

Do not reopen resolved choices because another implementation seems personally preferable.

P8 automated release validation is **complete**; rollout gates remain open.

P8.1 implements the fail-closed indexing foundation: centralized `SITE_INDEXING` / `SITE_ORIGIN` validation, default `noindex,nofollow`, no default canonical, and crawlable `/robots.txt`.

P8.2 completed the exact-baseline static release audit for measurement/claims wording, final static metadata, page-level H1 identity, live-only related links and current core-v1 privacy copy. The reviewed record is:

```text
docs/evidence/P8_STATIC_RELEASE_AUDIT_2026-08-30.md
```

Do not repeat P8.2 as speculative copy/metadata churn unless new material evidence or a blocking contradiction appears. P8.2 is **not** runtime accessibility, visual, browser/device, production-indexing, analytics/privacy-provider or CI certification.

P8.3 installs and configures `@astrojs/sitemap@3.7.3`, makes Astro config the single owner of `SITE_INDEXING` / `SITE_ORIGIN` activation, derives runtime canonical/robots behavior from resolved `Astro.site`, and adds a positive indexed-build verifier. Supported local validation on Node `24.16.0` / pnpm `11.21.0` passed frozen install, `pnpm check`, all 172 unit tests and `pnpm test:indexing`; the verifier built all 18 HTML routes and verified robots/canonical/sitemap consistency at the synthetic validation origin. The evidence record is:

```text
docs/evidence/P8_INDEXING_VALIDATION_2026-08-30.md
```

`PRODUCTION_INDEXING_ARTIFACTS_READY = true` now means the technical sitemap/indexing artifacts exist and have positive build evidence. It is **not** release authorization. Default builds still remain `noindex,nofollow` with no production canonical or sitemap. Do not invent a production domain and do not enable final production indexing before the remaining P8 release gates and an explicit real-domain deployment decision.

The 2026-08-31 automated P8 release evidence is recorded in `docs/evidence/P8_RELEASE_VALIDATION_2026-08-31.md`: exact-head hosted Chromium/Firefox/WebKit validation is green; visual QA covered the then-required 1440×900, 1366×768, 1024×768 and 390×844 matrix; runtime accessibility and cross-engine visual spot-checks are complete. A separate final adversarial audit on 2026-09-01 added 320×844 to the required matrix, fixed the homepage overflow found there, and validated the narrow browser/state/geometry surface; see `docs/evidence/P8_FINAL_ADVERSARIAL_AUDIT_2026-09-01.md`. Cloudflare Web Analytics is selected for v1 rollout but is not enabled. Remaining P8 work is actual device/browser smoke QA, production domain/deployment, analytics privacy/consent activation review, Search Console and explicit production indexing activation.

The Sonic Field production migration is complete across all 16 live tools. Do not treat Soft Sonic Studio as an alternative active direction or reintroduce its pastel split-panel grammar. The final post-release accessibility/overflow closure and exact CI provenance are recorded in `docs/evidence/SONIC_FIELD_POST_RELEASE_CLOSURE_2026-09-02.md`.

## 4. Locked stack

```text
Astro static MPA
strict TypeScript
plain CSS/custom properties
Web Audio / MediaDevices
Canvas/SVG
Motion
Phosphor
pnpm
Vitest
Playwright
ESLint
Prettier
```

No SSR.

No React/Vue/Svelte.

No global state library.

No Rive/OGL/Three.js at bootstrap.

Any new dependency requires:

```text
problem solved
native alternative considered
bundle/runtime cost
maintenance cost
```

## 5. Architecture discipline

Follow import boundaries in `06_ARCHITECTURE.md`.

Do not create one giant `AudioService`.

Do not make shared components own browser-resource lifecycles.

Do not make browser services import tool UI.

Do not add circular dependencies.

Do not generalize speculative future behavior.

## 6. State ownership

```text
tool controller
→ product interaction state

browser service
→ browser resource lifecycle

visualization component
→ drawing-local state
```

No global store unless a future explicit cross-page requirement is approved.

## 7. Resource ownership

Every started resource must stop deterministically:

```text
OscillatorNode
AudioNode connections
MediaStreamTrack
MediaRecorder
requestAnimationFrame
timers
event listeners
object URLs
```

No mic stream after stop/navigation.

No leaked animation loops.

## 8. Measurement gate

Before implementing a displayed metric or verdict, classify it as:

```text
A browser-known/generated
B browser-reported/estimated
C user-observed physical behavior
```

Never promote B/C into stronger physical certainty.

If wording is unclear, consult `08_MEASUREMENT_HONESTY_AND_SAFETY.md`.

## 9. Visual boundaries

Locked direction:

```text
Sonic Field
audio relationships made visible
one coherent instrument sheet
field / rail / state hierarchy
low-chroma neutral working surfaces
semantic teal / amber / rust only
audio-native geometry
motion only where signal/state is alive
measurement-looking graphics only from real tool data/state
```

Allowed later polish:

```text
spacing
shadow softness
illustration detail
exact timing
fine palette tuning
homepage composition
```

Not allowed ad hoc:

```text
generic monochrome utility UI
RGB/neon gaming theme
generic chart-card replacement
hidden primary controls
heavy graphics runtime for core functionality
```

## 10. Tool-first UX

The primary job belongs in the first meaningful viewport.

Long SEO text belongs below the tool.

Primary controls must remain obvious.

## 11. Accessibility

Required:

```text
keyboard access
visible focus
semantic controls
labels
screen-reader states
sufficient contrast
reduced motion
touch-friendly mobile controls
```

Audio feedback must not be the only feedback.

## 12. Privacy and safety

Core v1 mic processing is local.

Do not upload or analyze audio remotely.

Do not send audio content to analytics.

Use the digital signal-level limits defined in `08_MEASUREMENT_HONESTY_AND_SAFETY.md`.

Those limits are not physical SPL guarantees.

## 13. Browser fallbacks

Use feature detection, not normal UA sniffing.

A missing optional API should degrade the relevant subsection, not automatically kill the entire tool.

## 14. SEO boundaries

No thin synonym pages.

A route requires a distinct job/interaction/result/intent.

SEO priority may change without redefining functional behavior.

P7 route roles and intent ownership live in `09_SEO_ARCHITECTURE.md`; do not replace them with a single aggregate opportunity score.

## 15. Workflow is mandatory

Follow `docs/15_DEVELOPMENT_WORKFLOW.md`.

In particular:

```text
development
→ Draft PR
→ cold Review #1
→ fixes/commit
→ cold Review #2
→ mark Ready for review
→ full validation gate
→ green CI
→ merge
→ next task
```

A checkpoint commit is mechanically required before opening the Draft PR.

Do not merge directly to main.

Do not begin the next roadmap task before the current PR is merged unless the user explicitly asks for parallel work.

## 16. Agent task loop

For each task:

```text
read relevant docs
→ inspect existing code
→ identify acceptance criteria
→ implement narrow scope
→ follow PR/review workflow
→ merge
→ update main
→ continue
```

Avoid unrelated refactors.

Update authoritative docs only when a real decision changes.

## 17. Required review-pass separation

Review #1 and Review #2 must inspect the actual PR diff as separate cold-review passes.

Per explicit project-owner decision, the same project assistant that implemented the task also performs these reviews. This is the default autonomous workflow.

Required separation:

```text
implementation stops
→ reviewer pass re-reads specs + actual diff
→ findings recorded durably
→ implementation fixes
→ second reviewer pass re-reads updated diff
```

Ordinary implementation-time self-checking does **not** count as Review #1 or Review #2.

A human, separate agent/model or separate ChatGPT context may be used when useful, but is not required.

If a post-validation fix materially changes product behavior, architecture, UX, claims, privacy or safety, the changed diff requires another substantive cold review before merge.

## 18. Frequency capability rule

Never assume 20 kHz is valid merely because a tool's nominal range ends at 20 kHz.

Generated-frequency tools must use the shared Nyquist-safe maximum defined in `07_BROWSER_CAPABILITIES.md`.

Do not silently clamp without informing the tool controller/UI when the effective maximum is lower than the nominal range.

## 19. AudioContext ownership

Core v1 uses **tool-local AudioSession ownership**.

Do not create a global AudioContext singleton.

A tool page may share one AudioContext across its own services, but that context must not outlive the tool page.

Exact lifecycle is defined in `06_ARCHITECTURE.md`.

## 20. Realtime accessibility

Do not attach `aria-live` to rapidly changing numerical measurements or visualization data.

Allowed `aria-live` content is limited to discrete meaningful state changes such as:

```text
Playback started/stopped
Recording started/stopped
Permission denied
Input device lost
Signal unavailable
```

Realtime values such as Hz, dBFS, cents, FFT bins and spectrum updates remain labelled readable text but are not repeatedly announced.

## 21. Canonical source purity

Authoritative docs describe current behavior only.

Superseded decisions belong only in `docs/CHANGELOG.md`.

If two current authoritative docs conflict, stop and surface the conflict.

## 22. Microphone feedback prohibition

Mic-based tools never connect live microphone input to `AudioContext.destination`.

Allowed:

```text
MediaStreamSource → analyser / meter / recorder
```

Recorded-audio playback is allowed only after recording and explicit Play.

## 23. Analysis sample-rate rule

Downstream Web Audio PCM/FFT/pitch analysis uses:

```text
AudioContext.sampleRate
```

Track `sampleRate` remains browser-reported capture metadata only.

## 24. Browser certification rule

Playwright Chromium/Firefox/WebKit are automated regression targets, not proof of branded Safari/iOS Safari/Android Chrome/Edge support.

Production support follows the real-browser matrix in `10_TESTING_AND_QA.md`.

## 25. Live-route publication rule

The registry may describe planned tools, but user-facing navigation may only link tools with:

```text
status = "live"
```

Never create:

```text
Coming Soon tool routes
placeholder tool pages
broken homepage links
related-tool links to planned tools
```

A tool becomes `live` only in the same merged change that delivers its working route and acceptance criteria.

## 26. Full-CI authorization

Full CI requires both:

```text
PR is not Draft
label: full-ci-approved
```

The label is added only after the Review #2 cold pass while the PR is still Draft, then the PR is marked Ready.

Do not add that label early to “get CI started”.

## 27. Required merge gate

Do not treat a skipped conditional CI job as merge authorization.

Branch protection requires:

```text
merge-gate
```

`merge-gate` always executes for tracked PR events and fails unless:

```text
PR is Ready
full-ci-approved is present
full-validation result == success
```

Do not change this into a job-level `if:` on the required gate.

## 28. Branch-protection bypass

Do not treat branch protection as complete if administrators/maintainers can bypass the required merge gate.

P0 must verify the repository-plan/settings capability and record any limitation instead of assuming protection exists.

## 29. Current repository-gate mode

The repository is public, but `main` currently has `protected=false` and no repository rulesets. The project owner has explicitly accepted **manual repository-gate enforcement** until those controls are configured.

When `docs/MANIFEST.json` reports:

```text
repository_gate.mode = manual
```

then:

- branch → Draft PR → Review #1 → fixes → Review #2 → full CI → merge remains mandatory project policy;
- `merge-gate` must be green before the assistant performs the merge;
- do not direct-push roadmap implementation to `main`;
- do not claim GitHub mechanically prevents an owner/admin bypass;
- manual repository-gate enforcement is **not** a release blocker by itself; reopen this decision if branch protection, rulesets, plan, or enforcement state changes.

The only direct-to-main exception remains the already-completed empty-repository baseline seed.

## 30. Current hosted-CI incident

As of 2026-08-29, later P5/P6 pull-request validation attempts have repeatedly failed **before runner allocation** with the observed signature:

```text
runner_id = 0
steps = []
```

For that signature:

- classify the run as infrastructure/no-runner, not as a repository test failure;
- never call it green CI;
- the no-runner signature is **not merge authorization**;
- do not weaken or rewrite the required merge-gate contract merely to make the failure disappear;
- preserve exact-SHA review/CI evidence for incident diagnosis and historical record.

This section records an observed infrastructure incident. It is not a permanent waiver policy and does not replace `15_DEVELOPMENT_WORKFLOW.md` or `16_CI_AND_REPOSITORY_GATES.md`.
