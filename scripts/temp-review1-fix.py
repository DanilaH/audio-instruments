from pathlib import Path
import json


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement target, found {count}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "AGENTS.md",
    "Automated P8 release evidence is complete and recorded in `docs/evidence/P8_RELEASE_VALIDATION_2026-08-31.md`: exact-head hosted full validation including Chromium/Firefox/WebKit is green; required-viewport visual QA, runtime accessibility audit and cross-engine visual spot-checks are complete. Cloudflare Web Analytics is selected for v1 rollout but is not enabled. Remaining P8 work is actual device/browser smoke QA, production domain/deployment, analytics privacy/consent activation review, Search Console and explicit production indexing activation.",
    "The 2026-08-31 automated P8 release evidence is recorded in `docs/evidence/P8_RELEASE_VALIDATION_2026-08-31.md`: exact-head hosted Chromium/Firefox/WebKit validation is green; visual QA covered the then-required 1440×900, 1366×768, 1024×768 and 390×844 matrix; runtime accessibility and cross-engine visual spot-checks are complete. A separate final adversarial audit on 2026-09-01 added 320×844 to the required matrix, fixed the homepage overflow found there, and validated the narrow browser/state/geometry surface; see `docs/evidence/P8_FINAL_ADVERSARIAL_AUDIT_2026-09-01.md`. Cloudflare Web Analytics is selected for v1 rollout but is not enabled. Remaining P8 work is actual device/browser smoke QA, production domain/deployment, analytics privacy/consent activation review, Search Console and explicit production indexing activation.",
)

replace_once(
    "docs/13_BACKLOG_AND_ROADMAP.md",
    "P8 in progress: P8.1–P8.3 complete; hosted full browser validation, required-viewport visual QA, runtime accessibility audit and cross-engine visual spot-check complete; real-device/rollout gates remain",
    "P8 in progress: P8.1–P8.3 complete; hosted full browser validation, the 2026-08-31 four-viewport visual matrix, runtime accessibility and cross-engine visual spot-checks are complete; the 2026-09-01 final adversarial audit adds validated 320×844 browser/state/geometry coverage; real-device/rollout gates remain",
)

replace_once(
    "docs/13_BACKLOG_AND_ROADMAP.md",
    "required viewport visual QA complete",
    "2026-08-31 visual QA complete for the then-required 1440×900 / 1366×768 / 1024×768 / 390×844 matrix",
)

replace_once(
    "docs/13_BACKLOG_AND_ROADMAP.md",
    "P8 must not enable production indexing merely because P7 has evidence or because P8.3 makes the positive build path technically available. Production indexability remains an explicit release decision after the remaining gates pass.",
    "P8 must not enable production indexing merely because P7 has evidence or because P8.3 makes the positive build path technically available. Production indexability remains an explicit release decision after the remaining gates pass.\n\nThe later 320×844 adversarial release check and its narrow homepage fix are recorded separately in `docs/evidence/P8_FINAL_ADVERSARIAL_AUDIT_2026-09-01.md`; this supplements rather than rewrites the historical 2026-08-31 visual evidence.",
)

replace_once(
    "docs/13_BACKLOG_AND_ROADMAP.md",
    "Mechanical branch-protection enforcement remains unavailable under the current private/free-plan repository mode and is tracked separately from the implemented tooling baseline.",
    "Mechanical branch-protection enforcement is currently not configured: the public repository reports `main` as unprotected and has no repository rulesets. Manual enforcement remains the accepted mode until protection is explicitly configured and verified.",
)

evidence = """# P8 Final Adversarial Audit — 2026-09-01

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
"""
Path("docs/evidence/P8_FINAL_ADVERSARIAL_AUDIT_2026-09-01.md").write_text(evidence)

manifest_path = Path("docs/MANIFEST.json")
manifest = json.loads(manifest_path.read_text())
manifest["version"] = "1.19"
manifest["status"] = "P0-P6.3 implemented and merged; all 16 core v1 tool routes are live; P7 fresh Runner evidence reviewed and applied; P8 automated release validation is complete with green hosted Chromium/Firefox/WebKit, historical 1440/1366/1024/390 visual QA, runtime accessibility and cross-engine visual evidence; the 2026-09-01 adversarial audit adds validated 320×844 browser/state/geometry coverage and fixes its homepage overflow; Cloudflare Web Analytics is selected but not enabled; real-device QA, deployment, Search Console and explicit production indexing activation remain pending"
ledger = "docs/evidence/P8_FINAL_ADVERSARIAL_AUDIT_2026-09-01.md"
if ledger not in manifest["evidence_ledgers"]:
    manifest["evidence_ledgers"].append(ledger)
manifest["implementation"]["p8_final_adversarial_audit"] = {
    "state": "complete",
    "evidence": ledger,
    "baseline_sha": "229a48f56e9abe4ee2b475d86cfa790379d56321",
    "new_required_viewport": "320x844",
    "real_findings": [
        "homepage_320_horizontal_overflow",
        "current_source_of_truth_drift",
    ],
    "validated_commands": {
        "pnpm_check": "pass_0_errors_0_warnings_0_hints",
        "pnpm_test": "pass_172_of_172",
        "pnpm_test_indexing": "pass_18_routes",
        "playwright_narrow_audit": "pass_300_of_300",
    },
    "historical_visual_boundary": "2026-08-31 screenshot artifact covers 1440x900, 1366x768, 1024x768 and 390x844; 320x844 is separate 2026-09-01 browser/state/geometry evidence",
}
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
