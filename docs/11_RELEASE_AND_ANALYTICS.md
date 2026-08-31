# 11 — Release and Analytics

## Release gate

Before indexing:

```text
production domain
canonical origin
sitemap
robots/indexing
metadata
analytics
privacy copy
real-device smoke QA
browser QA
visual QA
measurement-claims audit
green CI
```

P8.3 has implemented and positively build-tested the sitemap/canonical/robots artifact path. That closes the technical artifact prerequisite only; it does not waive the remaining release gate above.


## Automated P8 release evidence

`docs/evidence/P8_RELEASE_VALIDATION_2026-08-31.md` records the completed automation-executable P8 gates on the merged 2026-08-31 baseline:

```text
full hosted Chromium/Firefox/WebKit release suite PASS
required-viewport visual QA complete
runtime axe A/AA audit complete with zero violations on 34 surfaces
cross-engine visual spot-check complete
repository-wide format/lint/type/unit/indexing gates PASS
```

These results do not replace actual-device QA or authorize production indexing.

## Analytics boundary

Track product interactions, not audio content.

Possible events:

```text
tool_start
tone_play
speaker_channel_test
mic_permission_granted
mic_permission_denied
mic_recording_started
spectrum_started
related_tool_click
```

Never send:

```text
microphone audio
recording contents
raw personal audio
```

If a future custom-event provider is explicitly approved, instrument code should use a small provider-neutral `trackEvent()` adapter rather than coupling core tool logic to that vendor.

Do not couple core tool logic to a specific analytics vendor.


## Selected v1 analytics provider — rollout decision

Selected for the initial production rollout:

```text
Cloudflare Web Analytics
```

Status: **selected, not enabled**.

The v1 reason is deliberately narrow: page/referrer/browser/device/OS visibility and real-user Core Web Vitals are useful immediately, while a heavier custom-event analytics surface is not yet justified. Official Cloudflare documentation reviewed on 2026-08-31 states that Web Analytics does not use cookies or localStorage for usage metrics and does not fingerprint individuals for Vitals collection. It currently does not support custom events or UTM parameters.

Therefore the possible provider-neutral product events listed above remain a future extension rather than a v1 requirement. Do not add a fake `trackEvent()` implementation that silently drops events merely to satisfy the old possibility list.

Before Cloudflare Web Analytics is enabled, update `/privacy`, determine required consent behavior for the actual deployment jurisdictions, verify that no microphone/recording content enters analytics, and record the final deployment behavior.

Current product baseline contains no analytics provider integration.

## Search Console

After launch:

```text
submit sitemap
verify indexing
observe impressions
observe queries
observe positions
observe clicks
```

## Ads

Later monetization must preserve:

```text
tool prominence
layout stability
clear distinction from controls
safe interaction
```

## Critical rollback/fix conditions

```text
audio continues after stop/navigation
mic privacy/lifecycle bug
unsafe loud default
misleading measurement
broken mobile primary flow
major layout regression
```

## Privacy/compliance gate for analytics and ads

Core local tools do not justify silently adding tracking/storage later.

Before enabling a chosen analytics or advertising provider:

1. inventory cookies/local storage/identifiers/network data introduced by the provider;
2. update the privacy policy to match actual behavior;
3. determine and implement any consent mechanism required for the target deployment/traffic jurisdictions;
4. ensure ads/analytics do not capture microphone/audio content;
5. document the provider and resulting privacy boundary.

This is a production gate, not a P0 implementation blocker.

Do not copy a generic consent banner without first knowing what the selected providers actually store/process.

## Explicit indexing activation

Preview/staging/non-final builds remain non-indexable by default.

P8 requires before final activation:

```text
real SITE_ORIGIN
SITE_INDEXING=enabled only in production
real-browser QA matrix recorded
real-device smoke QA completed
measurement/claims audit passed
remaining release validation accepted
```

Do not enable indexing merely because the build runs in production mode or because `PRODUCTION_INDEXING_ARTIFACTS_READY = true`.

## Sitemap/robots production ownership

Implemented in P8.1/P8.3:

```text
@astrojs/sitemap@3.7.3
src/pages/robots.txt.ts
SITE_ORIGIN validation
SITE_INDEXING gate
positive indexed-build verifier
```

Astro config is the single owner of activation. Runtime canonical/robots behavior derives from resolved `Astro.site`, so sitemap, canonical and robots cannot independently activate through separate environment-reading paths.

Public preview remains crawlable `noindex,nofollow` with no production canonical or sitemap.

Private staging requires hosting-layer access control rather than relying on robots.txt.

## Positive indexing validation

P8.3 added:

```text
pnpm test:indexing
```

The verifier performs a real static Astro build with a synthetic HTTPS origin and checks:

```text
/, /privacy and all 16 live tool routes
index,follow metadata
canonical origin-lock
sitemap-index.xml
sitemap-0.xml
robots.txt Sitemap directive
canonical ↔ sitemap membership consistency
```

Supported local execution on Node `24.16.0` / pnpm `11.21.0` passed `pnpm test:indexing` and is recorded in:

```text
docs/evidence/P8_INDEXING_VALIDATION_2026-08-30.md
```

The synthetic origin is test input only. Production still requires a real domain and the remaining release gates.

## Artifact readiness vs release authorization

```text
PRODUCTION_INDEXING_ARTIFACTS_READY = true
```

means only:

```text
sitemap/canonical/robots/indexing artifacts are implemented
positive indexed-build evidence exists
```

It does not mean:

```text
production domain selected
browser/device QA complete
analytics/privacy gate complete
deployment complete
Search Console configured
indexing activation authorized
```

Keep `SITE_INDEXING` disabled until those remaining production decisions are explicitly completed.