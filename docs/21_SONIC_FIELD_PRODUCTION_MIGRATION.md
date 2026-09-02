# 21 — Sonic Field Production Migration

Status: **production migration complete / canonical completion record**.

This document records the approved Sonic Field v3.1 production migration for the 16 live Browser Audio Lab tools, including the historical QA baseline, execution units and completion gates.

The goal is not to copy the prototype screenshot literally. The goal is to preserve the product-specific visual grammar that survived prototype stress testing while fixing the remaining manual-QA issues in the real tools.

## 1. Decision

Sonic Field v3.1 is the target visual direction.

Do not continue producing unrelated v4/v5 visual concepts unless a production implementation exposes a concrete failure of the system.

The production language is:

- audio relationships made visible;
- one coherent instrument sheet rather than nested cards;
- field / rail / state hierarchy;
- color attached to signal, state or position rather than decoration;
- compact page chrome so the tool is the first-screen object;
- desktop viewport budgeting rather than unconstrained fixed-height canvases;
- mobile proximity between output and primary controls;
- tool-specific visualizations only when they correspond to real audio semantics.

The direction must remain visibly distinct from Hardware Testing. A design that can be transplanted to a mouse/keyboard tester with only label changes is a failure.

### 1.1 Source-of-truth after migration

The migration is complete. `docs/04_VISUAL_SYSTEM.md` and `docs/05_UX_UI.md` are the canonical current visual/UX contracts; this document preserves the migration rationale, historical QA baseline, execution sequence and completion provenance.

Soft Sonic Studio is superseded. Do not treat historical rollout language below as permission to restore a second active visual system. Measurement, safety, browser and architecture contracts remain authoritative in their existing topic documents.

## 2. Non-negotiable visual rules

### 2.1 Color

The viewport should remain predominantly low-chroma neutral.

Semantic families:

- teal / blue-green: active signal, observed state, local analysis;
- amber: current position, focus, sweep/playhead;
- rust/red: warning, negative/opposing state where semantically justified.

Do not restore:

- lavender/purple branding;
- per-tool pastel accent surfaces;
- decorative gradients/glow blobs;
- color merely to distinguish panels.

Purple focus treatment is not approved. Production uses a dedicated non-purple focus treatment that must remain clearly visible and satisfy the existing contrast/accessibility contract; choose future adjustments by rendered contrast/visibility, not palette fashion.

### 2.2 Geometry

Production targets:

- outer working-sheet radius roughly 8–12 px;
- control-group radius roughly 4–8 px;
- circular geometry only for spatial/channel/frequency nodes or other inherently circular semantics;
- use structural rules/dividers before introducing nested cards.

Avoid 24–32 px work-panel radii and pill-heavy layouts.

### 2.3 Typography

Keep typography secondary to the audio state.

Production defaults:

- compact desktop tool title, approximately 36–48 px rather than marketing-scale 5.6rem;
- tabular numerals for measurements and changing frequency values;
- uppercase micro-labels only for compact metadata/rulers/state labels;
- do not switch to serif or monospace merely to signal “human” or “technical”.

### 2.4 Motion

Remove generic website motion from working tools:

- hover lift;
- decorative card translation;
- shadow bloom used only as delight;
- speaker/headphone nodes translating vertically just because they become active.

Keep motion that communicates audio:

- meter attack/decay;
- waveform/spectrum updates;
- sweep/playhead progression;
- stereo/spatial position;
- smooth return from a spatial sweep to centre;
- signal-state transitions.

A mode change must not move the stable visual stage unless the movement itself represents the audio state.

### 2.5 Signal/data honesty in graphics

The prototype was allowed to use synthetic data to explore composition. Production is not.

Rules:

- waveform/spectrum/spectrogram/meter shapes that look measured must derive from real tool state/data;
- structural grids, rulers, channel geometry and idle guides are allowed when they do not imply a measurement;
- synthetic/demo signal data belongs in tests/prototypes unless unmistakably labelled as demonstration data;
- decorative contours/gradients must not masquerade as measured signal energy;
- a prettier visualization is never a reason to invent data.

## 3. Viewport budget contract

### 3.1 Desktop

Primary target viewports:

- 1366 × 768;
- 1440 × 900.

Compact-desktop stress viewport:

- 1280 × 720.

For ordinary active/representative states at the primary targets:

- the complete core instrument sheet should fit in the viewport;
- target at least 24 px of visible bottom breathing room;
- the sheet should start high enough that the user does not need to scroll to begin the task;
- controls must not be shrunk below practical readability/touch requirements merely to satisfy fit.

At 1280 × 720:

- target complete primary-sheet fit with visible bottom air when user-opened secondary disclosures are closed;
- 16 px is the minimum acceptable bottom breathing room for this stress viewport;
- if a specific tool cannot meet this without harming readability/accessibility or its primary workflow, document the exception before merge rather than silently weakening the test.

This is a layout budget, not a screenshot-specific pixel lock. Use viewport-responsive field height with sensible min/max bounds.

A long secondary disclosure opened by the user may extend below the fold; the primary default/active workflow should not.

The first-screen budget applies to the site/tool header plus **core instrument sheet**. Related Tools, explanation, troubleshooting, FAQ and other supporting content below the tool are not expected to fit in that viewport.

### 3.2 Mobile

Mobile does not require the entire tool to fit one screen in every state.

Required instead:

- title/chrome is compact;
- the main working field appears early;
- primary controls remain close to the output/state they affect;
- avoid a repeated scroll ping-pong between output and buttons;
- no horizontal overflow at 320 px and 390 px;
- secondary explanatory/detail content may continue below.

## 4. Production architecture

Do not create 16 unique art-directed layouts.

Create a shared Sonic Field production layer with a small set of primitives, then compose tool-specific fields from them.

Expected shared primitives:

1. **ToolPageHeader / revised ToolShell header** — compact page heading and description.
2. **SonicInstrument / InstrumentSheet** — neutral working surface, stable viewport-budget shell.
3. **FieldZone** — visualization / spatial / frequency / time area.
4. **ControlRail** — compact primary controls and metrics on the same instrument plane.
5. **StateStrip** — one-line safety/capability/state context.
6. **SignalNode** — accessible spatial/channel target where the visual itself is an action.
7. **Metric** — tabular changing readout with compact label/qualification.
8. **Disclosure** — secondary metadata/calibration/details.

Existing controllers and browser services should remain the source of product behaviour. Do not rewrite audio engines merely to implement the visual system.

### 4.1 Behaviour-hook preservation

Visual markup may change substantially, but behaviour contracts may not change accidentally.

Default migration rule:

- preserve existing IDs and `data-*` hooks used by controllers/tests;
- visual class names may change freely;
- if a behaviour hook must change, update the controller and affected tests deliberately in the same reviewed unit;
- do not duplicate selector hooks when a controller expects an exact element count;
- prefer moving an existing behaviour hook onto the new semantic control over inventing a parallel action.

Example: `HeadphoneTestController` currently requires exactly six `[data-headphone-mode]` controls and three advanced panels. The production visual L / Both / R nodes should replace the old channel-mode buttons while Phase / Sweep / Bass remain the other three mode controls, preserving the six-control topology unless an explicitly reviewed controller change becomes necessary.

## 5. Tool archetypes

The 16 tools should use shared primitives through a small number of audio-native archetypes.

### A — Spatial output / channel relationship

Tools:

- Headphone Test;
- Speaker Test;
- Stereo Test;
- Surround Sound Test;
- Phase Test.

Primary grammar:

- listener/speaker/channel field;
- L / Both / R or channel nodes as the direct target where practical;
- phase/spatial state visible in the same field;
- mode-specific controls contextual, not a detached right-side dashboard.

### B — Frequency / generated signal

Tools:

- Tone Generator;
- Frequency Sweep;
- Bass Test;
- Noise Generator;
- Sound Test.

Primary grammar:

- frequency/time field;
- current frequency or signal type is dominant state;
- sweep/playhead is real state, not decorative animation;
- primary controls remain close to the field.

### C — Input / analysis / measurement

Tools:

- Microphone Test;
- Spectrum Analyzer;
- Decibel Meter;
- Pitch Detector.

Primary grammar:

- live data is the interface;
- secondary capture/device metadata is disclosed, not visually dominant;
- claims and units remain explicit and measurement-honest.

### D — Guided temporal task

Tools:

- Hearing Frequency Test;
- Audio Latency Test.

Primary grammar:

- progress/path/timeline;
- current step and decision are attached to that path;
- results do not appear as unrelated cards that reflow the tool.

A tool may borrow a primitive from another archetype where the audio semantics justify it.

## 6. Manual QA findings — historical pre-migration baseline

The following list is preserved from manual testing before the Sonic Field rollout. Its per-item `Status` lines describe the pre-migration baseline inspected at `main` `68fef62`; they are historical findings, not the current production state. Their implementation resolution is represented by the completed PR sequence in section 8 and the post-release closure evidence.

### QA-01 — Speaker Test moves/jerks when switching to Sweep

Status: **confirmed / only partially covered by tests**.

Current code reserves a minimum panel height, but active visual states deliberately translate speaker nodes vertically. Existing mobile footprint tests only compare the outer surface/document height and therefore do not detect perceptual movement inside the visual stage.

Production requirement:

- stable stage geometry across mode switches;
- remove generic active-state `translateY` movement;
- reserve mode-control footprint where necessary;
- channel nodes may change state/color/rings without changing their physical anchor.

### QA-02 — Microphone Test shifts when recording/playback UI appears

Status: **confirmed architecture risk**.

Current recording notice and native `<audio>` element are conditionally `display:none`/shown, so the controls column can gain height during the session.

Production requirement:

- reserve a stable local-recording region or replace hidden/show layout with a stable slot;
- playback controls must not push the visualization/control relationship around;
- mobile output-to-record controls remain close;
- size the reserved native-audio region against Chromium/Firefox/WebKit rather than assuming one engine’s controls height;
- keep native audio controls unless replacing them has independently justified product value.

### QA-03 — Headphone Test mode switching shifts; headphone illustration moves vertically

Status: **confirmed**.

Current active headphone cups use vertical translation; the inverted phase state uses another vertical transform.

Production requirement:

- fixed L / Both / R anchors;
- no decorative vertical movement on mode change;
- phase may change orientation/relationship without moving the stage baseline;
- Left / Both / Right become accessible direct visual controls in the production field;
- retain explicit text/shape/state so color is not the only cue;
- preserve the controller’s existing six-mode topology as described in 4.1.

### QA-04 — Stereo pan marker snaps back to centre after playback

Status: **confirmed**.

The controller immediately sets the visual state to centre on finish/stop.

Production requirement:

- natural completion animates the marker back to centre over a short deterministic duration;
- user Stop may return promptly but should avoid an ugly instantaneous spatial jump when practical;
- audio playback must already be stopped; the visual return is presentation only;
- respect reduced-motion preferences by allowing immediate return.

### QA-05 — Surround Test scene/layout shifts strongly

Status: **confirmed structural risk**.

Capability check, mode selector and the 5.1 / experimental-eight / stereo-preview panels are conditionally shown, while the spatial map changes topology.

Production requirement:

- spatial field footprint stays fixed;
- mode/capability controls occupy a stable rail/slot;
- speaker/channel nodes themselves are clickable test targets where capability permits;
- keep the distinction between verified discrete routing and stereo preview explicit;
- never imply physical speaker verification from requested digital routing.

### QA-06 — Bass slow sweep should show current frequency

Status: **confirmed missing behaviour**.

Current sweep readout is a static range (`low–high`) while playback runs.

Production requirement:

- display the current scheduled sweep frequency while the sweep runs;
- derive it from the same logarithmic sweep definition/timing contract used for playback;
- the readout is presentation state, not a claim that browser output was acoustically measured;
- stop/finish restores the appropriate idle readout.

### QA-07 — Tool title/header is too large; too much gap before instrument

Status: **confirmed**.

Current `ToolShell` uses a large 2.8–5.6rem title outside the special `max-height:900px` media query, creating a discontinuity around desktop heights.

Production requirement:

- remove the brittle height breakpoint behaviour;
- use one continuous compact tool-page header system;
- instrument should appear immediately below the intro;
- default desktop active sheet should satisfy the viewport budget in section 3.

### QA-08 — Hearing Frequency Test shifts heavily when answer UI appears

Status: **confirmed structural risk**.

The answer panel is conditionally hidden/shown in the controls column while the left side also contains separate current-frequency/result cards.

Production requirement:

- guided path/current step/answer lives in one stable composition;
- answer controls occupy a reserved decision area;
- result updates must not change the outer footprint;
- preserve all hearing-safety language and non-diagnostic claims.

### QA-09 — Spectrum Analyzer spectrogram is too faint / insensitive

Status: **confirmed as a technical audit item, not yet a predetermined fix**.

The renderer maps analyser dB values directly through the existing display-ratio function into a pale RGB/alpha ramp. User feedback indicates weak perceptual response, but simply increasing saturation is not an acceptable fix.

Required audit:

- input dB floor/ceiling;
- analyser smoothing;
- FFT size/resolution;
- spectrogram time history;
- amplitude → luminance/color mapping;
- alpha behaviour;
- low-level signal visibility without misrepresenting magnitude.

Production requirement:

- establish an evidence-based display mapping;
- prefer monotonic/perceptually useful luminance progression;
- keep the view truthful to relative browser-stream FFT energy;
- do not imply calibrated SPL/frequency response;
- add targeted renderer/model tests for mapping decisions.

### QA-10 — Stop icon can render like a broken glyph

Status: **needs live verification, but worth hardening**.

Current tool controls use the Phosphor regular icon-font/CSS payload and `ph-stop` classes. The class usage is structurally valid, but manual QA observed a broken-looking glyph.

Production requirement:

- PR1 verifies Stop rendering in Chromium/Firefox/WebKit on the first migrated tools;
- if the issue reproduces, fix the transport-icon rendering in the shared foundation during PR1 rather than carrying a known defect forward;
- if it does not reproduce, record the rendering path/browsers checked and perform the wider hardening pass with the remaining migrated transport controls;
- for primary transport controls, prefer a rendering path that cannot silently become a missing icon glyph if a change is required (for example inline SVG or a simple CSS/HTML transport shape consistent with accessibility/tooling policy);
- text labels remain present, so the icon is never the sole control label.

Do not globally add additional icon weights just to fix one glyph.

### QA-11 — Decibel Meter checkbox is unclear; tool contains too much text

Status: **confirmed**.

The checkbox currently asks the user to confirm Z / Flat / Linear external-meter weighting inside a visually dominant calibration block.

Production requirement:

- primary meter / Start-Stop / input state remains first-order;
- reference calibration is explicitly optional and collapsed/secondary by default;
- the weighting requirement must remain technically explicit when calibration is opened;
- rewrite the control label so the reason for the confirmation is clear;
- keep capture metadata secondary;
- preserve measurement-honesty caveats rather than deleting them to reduce text.

## 7. Additional product decisions from QA

### 7.1 Direct L / R / Both visual controls

Accepted where the visual field corresponds exactly to the playback target.

Apply first to:

- Headphone Test;
- Speaker Test;
- Stereo Test;
- Surround Test channel nodes where capability permits.

Requirements:

- real `<button>` semantics or equivalent accessible interactive elements;
- visible focus;
- descriptive accessible name;
- state communicated by more than color;
- controller behaviour remains the single playback source of truth;
- preserve existing behaviour hooks/topology where possible.

Do not duplicate the exact same primary action in both a visual node row and a separate button grid unless there is an accessibility/compact-layout reason.

### 7.2 Secondary content below the tool

SEO/content/Related Tools/FAQ areas should remain visually quieter than the working instrument.

Do not spread signal-field graphics into informational copy merely for branding.

The tool should be the high-information object; supporting content should use restrained editorial layout.

## 8. Implementation sequence — completed

The migration completed through reviewed units following `15_DEVELOPMENT_WORKFLOW.md`:

- PR #79 — foundation + Headphone / Spectrum visual / Hearing stress trio;
- PR #81 — spatial output family;
- PR #83 — generated-signal family;
- PR #85 — input / measurement family;
- PR #86 — Spectrum display-response audit;
- PR #87 — Audio Latency;
- PR #88 — post-release Sonic Field contrast closure.

The detailed per-PR scopes below are preserved as the execution record, not as open future work.

### PR 1 — Foundation + stress trio — COMPLETED (#79)

Scope:

- add the reviewed migration plan/evidence to production docs;
- update `04_VISUAL_SYSTEM.md` from Soft Sonic Studio to Sonic Field;
- update the relevant viewport/shared-primitive rules in `05_UX_UI.md`;
- shared production Sonic Field tokens/primitives;
- replace the old purple focus treatment with a rendered/contrast-validated Sonic Field focus treatment;
- compact `ToolShell` / page-header contract;
- production viewport-budget + perceptual-anchor browser test infrastructure;
- Headphone Test migration;
- Spectrum Analyzer visual migration (not the spectrogram-response algorithm change yet);
- Hearing Frequency Test migration;
- direct Headphone L / Both / R targets while preserving the six-mode controller topology;
- remove internal decorative vertical movement;
- verify Stop control rendering in Chromium/Firefox/WebKit and fix in the foundation if reproducible;
- preserve existing functional/browser contracts and behaviour selectors.

Why first:

These three tools were the successful prototype stress cases and exercise spatial playback, realtime analysis and guided sequence behaviour. Testing one shared system across three different archetypes before the remaining rollout is the reason this first PR is intentionally broader than later family PRs.

PR1 stop condition:

- do not absorb homepage/SEO/other-tool redesign;
- do not rewrite shared audio engines/services for visual convenience;
- if implementation requires broad controller/service rewrites or the diff stops being realistically cold-reviewable as one coherent unit, split the work before Review #1 rather than rationalizing a giant PR.

Required challenge states:

- **Headphone:** channel playback state and Sweep mode with sweep controls visible; verify fixed L/Both/R visual anchors across mode transitions;
- **Spectrum:** active Spectrogram state with post-permission/input controls present using the repository’s existing mocked browser-testing strategy; verify the data canvas remains the primary field;
- **Hearing:** Guided answer state with answer controls visible and populated current/session state; verify result/answer changes do not move the outer sheet.

Acceptance:

- 1366×768 and 1440×900 fit with >=24 px bottom air in the required challenge states;
- 1280×720 compact-desktop stress target follows section 3.1;
- 320×844 and 390×844 no horizontal overflow;
- mobile working field and primary control proximity remains practical;
- mode/answer state changes do not change outer instrument footprint;
- Headphone field anchors remain stable across mode changes;
- no synthetic signal-looking data is introduced into production visuals;
- no Hardware Testing visual clone;
- canonical visual/UX docs no longer prescribe the superseded Soft Sonic Studio system;
- all existing product behaviour tests for these tools remain green.

### PR 2 — Spatial output family — COMPLETED (#81)

Scope:

- Speaker Test;
- Stereo Test;
- Surround Sound Test;
- Phase Test;
- clickable spatial/channel targets where appropriate;
- stable mode/capability slots;
- Stereo smooth visual return to centre;
- Speaker/Surround manual-QA shift fixes.

### PR 3 — Generated-signal family — COMPLETED (#83)

Scope:

- Tone Generator;
- Frequency Sweep;
- Bass Test;
- Noise Generator;
- Sound Test;
- Bass live current-frequency readout;
- preserve the exact Noise Generator long-play safety reminder contract.

### PR 4 — Input / measurement family — COMPLETED (#85)

Scope:

- Microphone Test;
- Decibel Meter;
- Pitch Detector;
- stable local-recording/playback region validated against Chromium/Firefox/WebKit native audio controls;
- Decibel text hierarchy/calibration disclosure;
- wider Stop-icon hardening across remaining migrated primary transport controls when still needed.

Spectrum algorithm/display-response work is intentionally not hidden inside this visual PR unless review determines it is inseparable.

### PR 5 — Spectrum display-response audit — COMPLETED (#86)

Scope:

- reproduce the faint/insensitive spectrogram with controlled synthetic analyser frames in tests;
- document current mapping;
- choose/test revised amplitude-to-display mapping;
- verify Spectrum, Waveform and Spectrogram readability;
- add targeted unit/browser coverage;
- no claim changes beyond what evidence supports.

Synthetic frames in this PR are test fixtures and do not become unlabeled production data.

### PR 6 — Audio Latency + site-shell finishing pass — COMPLETED (#87)

Scope:

- Audio Latency migration;
- homepage/tool-page visual consistency only where needed;
- quieter Related Tools/supporting content;
- final cross-tool viewport and perceptual stability regression pass.

Do not redesign SEO copy/content structure without a separate reason.

## 9. Testing additions required by the migration

Existing layout tests stay valuable but are insufficient for the manual-QA class of bugs.

### 9.1 Desktop viewport fit

At minimum on migrated tools:

Primary:

- 1366×768;
- 1440×900.

Compact stress:

- 1280×720.

Measure:

- tool sheet top/bottom;
- bottom breathing room;
- horizontal overflow;
- required challenge-state footprint.

### 9.2 Perceptual anchor stability

For spatial tools, measure stable anchors before/after mode changes:

- L/R speaker/headphone node centre positions;
- central listener/signal anchor;
- surrounding stage bounds.

An unchanged outer surface height is not enough.

### 9.3 Dynamic-slot stability

For conditional UI:

- Hearing answer controls;
- microphone recording/playback;
- Surround capability/mode selection;
- mode-specific control blocks.

The reserved region may change content but should not move the field or the whole sheet.

### 9.4 Mobile control proximity

At 390×844, measure the distance from the bottom of the primary field to the top of the relevant primary action/control region. Use the v3.1 prototype as a qualitative reference, not a hard universal pixel constant.

Also verify 320 px horizontal fit because existing stability coverage already uses that width.

### 9.5 Reduced motion

Stereo smooth-return and any other signal motion must respect `prefers-reduced-motion`.

### 9.6 Transport icon rendering

For migrated primary Stop controls:

- verify the icon/shape is visibly rendered in Chromium/Firefox/WebKit;
- keep a text label;
- do not rely on an icon font glyph as the only semantic signal.

### 9.7 Data-visualization honesty

Tests/prototype fixtures may use synthetic analyser data.

Production browser state must not render synthetic measurement-looking data as if it came from the user’s live signal.

## 10. Safety / honesty contracts that redesign must not weaken

- Hearing Frequency Test remains non-diagnostic and must not resemble/claim a medical audiogram.
- Decibel Meter remains digital dBFS unless the user performs the existing one-point reference-calibration flow; even then the result is a user-calibrated estimate with existing limitations.
- Spectrum Analyzer remains relative browser-stream FFT data, not calibrated frequency response, SPL or pitch.
- Surround capability/routing claims remain limited to what Web Audio/browser readback supports.
- Generated-frequency tools remain bounded by runtime sample-rate capability.
- Noise Generator must retain the exact long-play reminder: `Long playback: keep device/headphone volume at a comfortable level.`
- No microphone input is routed to speaker output unless a tool specification explicitly requires it; current measurement tools do not.

## 11. Explicit non-goals

This migration does not:

- rewrite audio engines/services;
- introduce a framework;
- add a new design-system dependency;
- replace Astro/static output;
- change indexing/SEO rollout policy;
- enable analytics;
- redesign every informational page at once;
- fake measurements for prettier graphics;
- force every mobile state into one viewport;
- make every tool visually unique.

## 12. Release sequencing

Visual migration is not a reason to couple infrastructure deployment and a large UI refactor into one release unit.

If the existing `main` is deployed to VPS first, keep indexing fail-closed until the normal smoke/indexing decision is made.

The Sonic Field production migration completed independently through reviewed PRs. Its completion does not authorize indexing; do not turn indexing on merely because the visual migration merged.

## 13. Definition of done for the complete migration — SATISFIED

The migration is complete. The checklist below is retained as the completion contract; final post-release accessibility/overflow and CI evidence is recorded in `docs/evidence/SONIC_FIELD_POST_RELEASE_CLOSURE_2026-09-02.md`.

The migration was considered complete when:

- all 16 live tools use the shared production Sonic Field system;
- no tool retains the old pastel split-panel identity as its primary working surface;
- canonical visual/UX docs describe the production system rather than Soft Sonic Studio;
- the manual-QA items QA-01 through QA-11 are either fixed or have a documented evidence-based resolution;
- representative desktop active states fit the viewport budget;
- mobile output/control proximity is acceptable without horizontal overflow;
- visual nodes do not move for generic state decoration;
- Spectrum display-response audit is complete;
- measurement/safety claims remain intact;
- existing functional tests remain green;
- new viewport/perceptual stability tests are green;
- cross-browser Chromium/Firefox/WebKit validation is green;
- required PR reviews and merge gates are complete.
