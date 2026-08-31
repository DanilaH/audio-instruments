# P8 Release Validation Evidence — 2026-08-31

## Scope

This ledger records the automation-executable P8 release evidence collected after P8.3 and the remaining boundaries that still require rollout or physical-device work.

Current merged product baseline:

```text
main = acdd9b6eb1178fa5d6e081434879e88b59c31b26
```

The evidence below does not authorize production indexing by itself.

## Full release browser validation

PR `#67` repaired the previously stale cross-browser Playwright baseline without weakening product safety or measurement contracts.

Exact reviewed PR head:

```text
91837399a48144415aacef8ecc50c35eb47a79bc
```

Full Validation run `#658` (`33418681358`) completed successfully and included:

```text
pnpm install --frozen-lockfile PASS
pnpm format:check PASS
pnpm lint PASS
pnpm check PASS
pnpm test PASS (172/172)
pnpm test:indexing PASS
Chromium / Firefox / WebKit installation PASS
full pnpm test:browser PASS
merge-gate PASS
```

A final residual matrix covering the last three cross-engine race/selector cases passed `54/54` before the exact-head full run.

PR `#67` was squash-merged to `main` as:

```text
acdd9b6eb1178fa5d6e081434879e88b59c31b26
```

Cold review result before merge:

```text
BLOCKER 0
MAJOR 0
MINOR 0
```

## Visual QA

Audited page scope: `/` plus all 16 live tool routes. `/privacy` was not part of this screenshot matrix; it remains covered by the P8.2 static audit, positive indexing validation and the full Playwright release suite.

Disposable workflow run `33421576945` checked out the exact merged product baseline `acdd9b6eb1178fa5d6e081434879e88b59c31b26` and captured:

```text
17 audited pages (homepage + 16 tool routes) × 4 viewport screenshots = 68
17 audited pages (homepage + 16 tool routes) × 2 full-page screenshots = 34
102 screenshots total
```

Viewport matrix:

```text
1440×900
1366×768
1024×768
390×844
```

Reviewed result:

```text
no confirmed horizontal-overflow defect
no confirmed clipping/wrap defect
no broken first-viewport primary flow
no mobile layout regression requiring a polish PR
```

The temporary workflow commit existed only to host the evidence runner; it was not a product change and its branch was reset to `main` after capture.

## Runtime accessibility audit

Audited page scope: `/` plus all 16 live tool routes. `/privacy` was not part of this one-off axe matrix; do not generalize the zero-violation result beyond these 17 audited pages.

Disposable workflow run `33422511414` checked out the same exact merged product baseline and audited:

```text
17 audited pages (homepage + 16 tool routes) × desktop/mobile = 34 runtime surfaces
axe WCAG 2.0 / 2.1 A/AA rules
horizontal overflow
```

Result:

```text
34/34 surfaces audited
axe violations = 0
horizontal overflow = 0
scrollWidth == clientWidth on all audited surfaces
```

`axe-core` was installed only inside the disposable evidence runner. It is not a permanent runtime or development dependency.

## Cross-engine visual spot-check

Disposable workflow run `33422831640` checked out the exact merged product baseline and captured the highest-risk pages in:

```text
Chromium
Firefox
WebKit
```

at:

```text
1366×768
390×844
```

Six representative/high-risk routes were reviewed across all three engines (`36` screenshots total).

Result:

```text
no confirmed clipping
no confirmed wrap/layout divergence
no broken control geometry
```

Observed differences were limited to expected native browser rendering details such as range thumbs and number-input spinners. No custom-control rewrite was justified.

## Analytics rollout decision

Selected v1 rollout provider:

```text
Cloudflare Web Analytics
```

Decision status:

```text
selected for v1 rollout
not enabled yet
no analytics script/provider integration is present in the current product baseline
```

Why it fits the initial release:

```text
free/privacy-first page analytics
referrer/path/browser/device/OS dimensions
real-user Core Web Vitals
low maintenance burden
no need to instrument microphone/audio content
```

Official Cloudflare documentation reviewed on 2026-08-31 states that Web Analytics does not use cookies or localStorage for usage metrics and does not fingerprint individuals for Vitals collection. It also currently does not support custom events or UTM parameters.

References:

```text
https://developers.cloudflare.com/web-analytics/about/
https://developers.cloudflare.com/web-analytics/faq/
https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/
https://developers.cloudflare.com/web-analytics/data-metrics/dimensions/
```

Therefore product-event analytics such as `tool_start` / `tool_complete` are deferred rather than forcing a heavier provider into v1.

Before Cloudflare Web Analytics is actually enabled:

```text
update /privacy to describe the real provider/network behavior
decide consent behavior for the actual deployment jurisdictions
verify the final integration sends no microphone/recording content
enable only on the chosen production deployment
```

## Repository-gate observation

The repository is now public.

Observed on 2026-08-31:

```text
main branch metadata: protected = false
repository rulesets endpoint: []
```

The previous documentation rationale based on a private/free-plan repository is therefore stale.

Manual PR/review/full-CI/merge-gate discipline remains mandatory until mechanical protection is explicitly configured and verified. Repository protection is a repository-hardening task, not evidence that the product runtime is broken.

## Remaining P8 work

Still not completed by the automated evidence above:

```text
actual Safari macOS smoke QA
actual iOS Safari smoke QA
actual Android Chrome smoke QA
actual Edge smoke QA
real microphone/output-device smoke QA where practical
real production domain selection
production deployment
Cloudflare Web Analytics enablement + privacy/consent release review
Search Console setup
explicit SITE_INDEXING=enabled + real HTTPS SITE_ORIGIN production activation
post-deploy indexing/canonical/sitemap verification
```

Automated WebKit is regression coverage only; it is not evidence of physical Safari/iOS hardware behavior.

## Release interpretation

The codebase has passed the automation-executable browser, visual, runtime-accessibility, formatting, type, unit and indexing gates available before deployment.

P8 remains **in progress** only because the remaining gates depend on real devices or rollout decisions. Do not reopen functional development, SEO route strategy, or speculative visual polish without new material evidence.
