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

Instrument code should call a small provider-neutral `trackEvent()` adapter.

Do not couple core tool logic to a specific analytics vendor.

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

P8 requires:

```text
real SITE_ORIGIN
SITE_INDEXING=enabled only in production
real-browser QA matrix recorded
real-device smoke QA completed
measurement/claims audit passed
```

Do not enable indexing merely because the build runs in production mode.

## Sitemap/robots production ownership

P8 explicitly adds/configures:

```text
@astrojs/sitemap
src/pages/robots.txt.ts
SITE_ORIGIN validation
SITE_INDEXING gate
```

Public preview remains crawlable `noindex,nofollow`.

Private staging requires hosting-layer access control rather than relying on robots.txt.

## P8-only positive indexing validation

During P0–P6:

```text
only default noindex behavior is implemented/tested
@astrojs/sitemap is not required
```

During P8:

```text
install @astrojs/sitemap
enable environment-aware sitemap/robots implementation
run positive SITE_INDEXING + SITE_ORIGIN tests
```

Do not pull release-only sitemap dependencies into earlier implementation phases merely to satisfy future tests.
