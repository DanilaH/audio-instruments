# Sonic Field Production Plan — Cold Review

Date: 2026-09-01

Reviewed artifact:

- `docs/21_SONIC_FIELD_PRODUCTION_MIGRATION.md`
- plan commit: `350ee2c6303262846892ce7368fe3d2a39308637`
- baseline production `main`: `68fef62d5371efe5af662f09d3f53c0c53b7a333`

Review mode: independent pre-implementation cold pass. The implementation was not started before this review.

## Verdict before fixes

**Revise before implementation.**

The direction is sound and the manual-QA inventory is materially accurate, but the first plan version had several gaps that could create conflicting source-of-truth docs, prototype-overfitted validation, or unnecessary controller rewrites.

## Findings

### R1 — Critical — existing visual source-of-truth directly conflicts with Sonic Field

`docs/04_VISUAL_SYSTEM.md` still requires the old `Soft Sonic Studio` direction, including lavender/per-tool accents, soft tinted surfaces, large 24–32 px instrument radii and hover/selected-state motion.

This is not compatible with the accepted Sonic Field direction.

Risk:

- future agents can follow the older numbered visual-system doc instead of migration doc 21;
- production code can become a hybrid of two systems;
- the old AI-like visual grammar can reappear during later PRs.

Resolution required:

- document 21 is authoritative for the migration until canonical docs are updated;
- PR1 must update `04_VISUAL_SYSTEM.md` to the accepted Sonic Field system rather than leaving two active visual contracts;
- PR1 should update `05_UX_UI.md` where shared primitives/viewport gates changed.

### R2 — High — direct Headphone visual controls can violate controller topology

Current `HeadphoneTestController` requires exactly six `[data-headphone-mode]` elements and exactly three advanced panels.

The original plan accepted visual L / Both / R controls but did not state how to preserve this contract.

Risk:

- adding visual buttons while leaving old buttons creates nine mode elements and constructor failure;
- changing selectors casually expands a visual migration into controller refactoring.

Resolution required:

- preserve stable IDs/data hooks by default;
- the visual L / Both / R nodes replace, rather than duplicate, the existing channel mode buttons;
- the three visual nodes plus Phase/Sweep/Bass remain the six mode elements unless an explicitly reviewed controller change is necessary;
- existing advanced-panel hooks remain intact.

### R3 — High — PR1 viewport acceptance did not define challenge states

The first plan said “representative default/active states” without naming them.

Risk:

A tool can pass desktop-fit in a convenient idle state while still failing exactly when the user interacts with it.

Resolution required for PR1:

- Headphone: verify at least channel playback state and Sweep mode with sweep controls visible/active;
- Spectrum: verify active Spectrogram state with the post-permission/input controls present through the existing browser-test mocking strategy;
- Hearing: verify Guided answer state with answer controls visible and a populated session/current-frequency state;
- compare stable field/node anchors where relevant, not only outer sheet height.

### R4 — Medium — compact desktop stress coverage should include a low-height desktop

1366×768 and 1440×900 are good primary targets, but the migration is explicitly fixing vertical-budget problems and should include a lower desktop height.

Resolution required:

- add 1280×720 as a compact-desktop stress viewport;
- target full primary sheet fit with visible bottom air when no user-opened secondary disclosure is expanded;
- do not distort controls below usability/accessibility requirements merely to satisfy this stress case;
- if a specific tool cannot satisfy the compact-desktop stress case without harming the primary workflow, document the exception before merge rather than hiding it.

### R5 — Medium — Stop-glyph verification is scheduled too late

The manual QA reported a broken-looking Stop glyph. The first migration PR already contains Stop controls.

Resolution required:

- PR1 performs cross-browser Stop-icon visual/DOM verification for the migrated tools;
- if the glyph problem reproduces, fix the transport-icon rendering in the shared foundation during PR1;
- if it does not reproduce, retain the later global hardening pass but record the browsers/rendering path tested;
- text remains present, so no icon is the sole accessible name.

### R6 — High — purple can survive through the global focus token

The accepted direction rejects purple/lavender branding, but the current global design system uses a purple `--color-focus` token.

Resolution required:

- PR1 replaces the old purple focus token with a non-purple accessible focus treatment consistent with Sonic Field;
- do not choose a new focus color only by aesthetic preference;
- validate required contrast against adjacent surfaces and keep focus visible in all migrated controls.

### R7 — High — signal-looking decoration needs a measurement-honesty boundary

The prototypes were allowed to use synthetic data and illustrative fields to explore composition. Production cannot silently display synthetic signal energy/contours in a way that looks measured.

Resolution required:

- real waveform/spectrum/spectrogram/meter shapes derive from real tool state/data;
- structural scales, guides and spatial geometry may render while idle if they do not imply a measurement;
- synthetic/demo data is restricted to tests/prototypes or must be unmistakably labelled as demonstration data;
- decorative gradients/contours must not masquerade as signal energy.

### R8 — Medium — native audio playback can vary cross-browser

Microphone QA includes layout growth when the native `<audio controls>` appears. Native control height/appearance can vary between browser engines.

Resolution required:

- PR4 reserves a stable playback region based on actual Chromium/Firefox/WebKit rendering rather than one-browser dimensions;
- keep native audio controls unless there is a separately justified reason to replace them;
- do not solve the layout problem by building a custom media player without product value.

### R9 — Medium — PR1 is large but still coherent only under a stop condition

Foundation + global page header + three stress tools + browser test infrastructure is close to the upper bound of a reviewable PR.

It remains defensible because the purpose is to prove one shared system across spatial, analysis and guided-task archetypes before rolling it out further.

Resolution required:

- PR1 must not absorb unrelated homepage/SEO/other-tool redesign;
- existing audio engines/services remain untouched unless a stress-tool behaviour cannot be preserved otherwise;
- if implementation requires broad controller/service rewrites or the diff stops being cold-reviewable as one unit, split before Review #1 rather than rationalizing a giant PR.

### R10 — Medium — preserve implementation hooks during visual migration

The first plan says controllers stay the behaviour source of truth but does not explicitly protect existing DOM contracts.

Resolution required:

- preserve existing IDs and `data-*` hooks used by controllers/tests by default;
- when a hook must change, change the controller and affected tests deliberately in the same reviewed unit;
- visual class names may change freely; behaviour selectors may not change accidentally.

## Additional clarification

The desktop viewport budget applies to the page header plus **core instrument sheet**. Supporting Related Tools / explanatory / FAQ content below the tool is not expected to fit in the first viewport.

A user-opened secondary disclosure may extend the page below the fold. The closed/default primary workflow remains budgeted.

## Post-fix review target

Update `docs/21_SONIC_FIELD_PRODUCTION_MIGRATION.md` with R1–R10, then perform a second cold read of the revised plan before starting production code.
