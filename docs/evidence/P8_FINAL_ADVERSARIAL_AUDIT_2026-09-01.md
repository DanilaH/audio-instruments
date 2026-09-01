# P8 Final Adversarial Audit — 2026-09-01

## Scope

This record supplements the historical `P8_RELEASE_VALIDATION_2026-08-31.md` evidence. It does not retroactively claim that the 2026-08-31 screenshot matrix included 320 px.

Audit baseline: `229a48f56e9abe4ee2b475d86cfa790379d56321` (`main` at audit start).

The audit followed the final release instruction to re-check the project adversarially rather than infer readiness from green build/tests. It re-read current source-of-truth docs, reviewed the complete 18-HTML-route catalog and SEO intent boundaries, inspected prior visual evidence, and added a new narrow-mobile stress surface at 320×844.

## Historical visual-evidence boundary

The 2026-08-31 visual artifact remains valid for its recorded matrix:

```text
1440×900
1366×768
1024×768
390×844
```

It contains 102 screenshots from the then-required visual review. It must not be cited as 320×844 screenshot evidence.

## Finding 1 — homepage horizontal overflow at 320 px

The first 320×844 all-route geometry pass found a real defect on `/`:

```text
document.scrollWidth = 348 px
document.clientWidth = 320 px
```

The rendered hero heading was visibly clipped at the right edge in the failure screenshot. The cause was the homepage-local mobile heading rule, which resolved to a larger font at 320 px than the shared narrow-mobile typography could fit.

Fix:

```css
@media (max-width: 340px) {
  .hero h1 {
    font-size: 3rem;
  }
}
```

The fix is intentionally restricted to the narrow boundary and does not alter 390 px or desktop composition.

## Finding 2 — current source-of-truth drift

The audit also found stale current-state documentation:

- `AGENTS.md` still described the repository using the old private/free-plan rationale;
- `docs/MANIFEST.json` still represented older P8/CI/repository-gate state;
- `docs/13_BACKLOG_AND_ROADMAP.md` contained a second stale private/free-plan sentence;
- after 320×844 became a required viewport, phrases saying the historical 2026-08-31 artifact covered the “required viewport” matrix became ambiguous.

The current repository state was verified directly during the audit: the repository is public, `main` reports `protected=false`, and the repository rulesets endpoint returns no configured rulesets. Manual repository-gate enforcement remains the accepted policy until mechanical protection is configured.

## SEO/catalog review result

All 18 HTML routes were reviewed against current route purpose and the existing P7/P8 evidence. The 16 tool routes remain functionally distinct; no evidence justified slug changes, synonym routes, page mergers, title/H1/body churn or stronger measurement claims.

The positive indexed-build verifier continues to validate all 18 HTML routes for index metadata, canonical origin lock, robots policy and sitemap membership. Production indexing remains fail-closed by default.

## 320×844 validation

After the homepage fix, an exact-branch validation run completed:

```text
git diff --check PASS
pnpm format:check PASS
pnpm lint PASS
pnpm check PASS — 160 files, 0 errors, 0 warnings, 0 hints
pnpm test PASS — 172/172
pnpm test:indexing PASS — 18 HTML routes
pnpm build PASS — default noindex preview restored
Playwright narrow audit PASS — 300/300
```

The 300-test Chromium run used 320×844 as its default viewport and included the full existing browser/state/error/fallback/lifecycle suite plus a dedicated all-18-route geometry assertion for document/control overflow and single-H1 identity. Tests that intentionally set their own required viewport continued to exercise the established 1440/1366/1024/390 layout matrix.

The initial failure screenshot was reviewed to confirm the real homepage clipping. The post-fix 320 result is certified here by browser geometry/state tests, not misrepresented as part of the historical 102-screenshot visual matrix.

## Finding 3 — WebKit release-CI harness race

The first standard full-validation attempt for PR #74, workflow run `33469754486`, passed frozen install, formatting, lint, Astro/TypeScript checks, all 172 unit tests and the 18-route positive indexing verifier. The full Chromium/Firefox/WebKit browser stage then finished with:

```text
894 passed
2 skipped
1 failed
```

The only failure was the WebKit case `reanchors on offset changes, preserves the sign convention, and cancels old scheduled clicks` in `tests/browser/audio-latency.spec.ts`.

The failure artifact and Playwright trace showed that product behavior was correct. The active loop had switched to `−50 ms`, previously scheduled clicks had received cancellation stop times, and the newly re-anchored negative-offset clicks were scheduled at the expected lead. The assertion failed because the test captured `oscillators.length` and `AudioContext.currentTime` in separate asynchronous operations before dispatching the offset change. During that gap, the controller's normal 100 ms lookahead scheduler appended one more old-offset oscillator. The later assertion therefore indexed that stale oscillator rather than the first oscillator created by the offset change.

The fix is test-only. `setOffset()` now captures the oscillator count and context time atomically in the same page-context callback immediately before dispatching the `input` event, then returns that snapshot to the assertion. No production scheduler, timing constant, audio lifecycle or user-visible behavior was changed.

Targeted WebKit validation on hosted CI then ran the corrected scenario 30 times:

```text
Prettier PASS
ESLint PASS
Astro/TypeScript check PASS — 0 errors, 0 warnings, 0 hints
build PASS — 18 pages
WebKit re-anchor scenario PASS — 30/30
```

This finding is classified as a release-test harness race exposed by adversarial full CI, not as a product audio-timing defect.

## What this audit does not certify

This automated work does not simulate or certify:

- branded Safari on macOS;
- iOS Safari;
- Android Chrome;
- Microsoft Edge;
- physical microphone/output-device behavior, real permission UX or device switching;
- production hosting/domain behavior;
- analytics-provider privacy/consent compliance;
- Search Console;
- final real-domain indexing activation.

Those remain rollout/release gates.
