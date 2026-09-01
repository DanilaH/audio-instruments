from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing replacement target: {label}")
    return text.replace(old, new, 1)


readme = Path("README.md")
text = readme.read_text(encoding="utf-8")
text = replace_once(text, "Documentation baseline: **v1.17**", "Documentation baseline: **v1.19**", "README version")
text = replace_once(
    text,
    "visual QA across the homepage + all 16 tool routes at the required viewport matrix is complete",
    "historical visual QA across the homepage + all 16 tool routes at 1440×900, 1366×768, 1024×768 and 390×844 is complete; the separate 2026-09-01 adversarial audit adds validated 320×844 browser/state/geometry coverage",
    "README visual provenance",
)
text = replace_once(
    text,
    "    └── P8_RELEASE_VALIDATION_2026-08-31.md",
    "    ├── P8_RELEASE_VALIDATION_2026-08-31.md\n    └── P8_FINAL_ADVERSARIAL_AUDIT_2026-09-01.md",
    "README evidence tree",
)
text = replace_once(
    text,
    "Current private-plan/manual-gate limitations and the recorded no-runner incident do not change the normative CI contract.",
    "The current public-repository/manual-gate state and the recorded no-runner incident do not change the normative CI contract.",
    "README repository gate",
)
text = replace_once(
    text,
    "v1.17 records completed automated P8 release evidence: green hosted full validation including Chromium/Firefox/WebKit, required-viewport visual QA, runtime accessibility audit, cross-engine visual spot-checks, public-repository gate state and the selected-but-not-enabled Cloudflare Web Analytics rollout decision.",
    "v1.19 records completed automated P8 release evidence: green hosted full validation including Chromium/Firefox/WebKit, the historical 1440×900 / 1366×768 / 1024×768 / 390×844 visual matrix, the separate validated 320×844 browser/state/geometry audit, runtime accessibility audit, cross-engine visual spot-checks, public-repository manual-gate state and the selected-but-not-enabled Cloudflare Web Analytics rollout decision.",
    "README freeze summary",
)
readme.write_text(text, encoding="utf-8")

release = Path("docs/11_RELEASE_AND_ANALYTICS.md")
text = release.read_text(encoding="utf-8")
old = """full hosted Chromium/Firefox/WebKit release suite PASS
required-viewport visual QA complete
runtime axe A/AA audit complete with zero violations on 34 surfaces
cross-engine visual spot-check complete
repository-wide format/lint/type/unit/indexing gates PASS
```

These results do not replace actual-device QA or authorize production indexing."""
new = """full hosted Chromium/Firefox/WebKit release suite PASS
2026-08-31 visual QA complete for 1440×900 / 1366×768 / 1024×768 / 390×844
runtime axe A/AA audit complete with zero violations on 34 surfaces
cross-engine visual spot-check complete
repository-wide format/lint/type/unit/indexing gates PASS
```

The later 320×844 adversarial check is recorded separately in `docs/evidence/P8_FINAL_ADVERSARIAL_AUDIT_2026-09-01.md`; it supplements rather than rewrites the historical 2026-08-31 visual matrix.

These results do not replace actual-device QA or authorize production indexing."""
text = replace_once(text, old, new, "release evidence block")
release.write_text(text, encoding="utf-8")
