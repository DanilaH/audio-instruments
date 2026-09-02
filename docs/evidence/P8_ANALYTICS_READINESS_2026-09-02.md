# P8 Analytics Readiness — 2026-09-02

## Purpose

Evidence record for the repository-side Cloudflare Web Analytics readiness unit.

This record does **not** certify or claim that analytics is active in production. It records the fail-closed integration, privacy boundary and automated build validation that make later deployment activation possible without silently enabling tracking in preview/default builds.

## Provider decision

Selected v1 provider:

```text
Cloudflare Web Analytics
```

Official Cloudflare Web Analytics / RUM documentation was refreshed on 2026-09-02 before implementation. The implementation relies on the documented boundary that Web Analytics does not use cookies or localStorage for usage metrics and does not fingerprint individual visitors for this analytics collection. The manual beacon is loaded from `https://static.cloudflareinsights.com/beacon.min.js`; Browser Audio Lab explicitly configures `spa: false` because the product is an Astro multi-page application.

Cloudflare documentation also states that the RUM service receives the source IP address during ordinary HTTP handling but discards it at the nearest Cloudflare data center rather than storing it in the RUM service's core databases or logs.

Custom product events and UTM analytics are not part of this v1 integration.

## Fail-closed activation contract

The repository remains analytics-disabled unless all three build-time inputs are present together:

```text
SITE_ANALYTICS=cloudflare-web-analytics
ANALYTICS_PRIVACY_REVIEW=approved
CLOUDFLARE_WEB_ANALYTICS_TOKEN=<Cloudflare site token>
```

Missing review approval, missing token or an unknown provider causes explicit configuration failure rather than silent partial activation. Ordinary/default builds contain no Cloudflare beacon.

The privacy-review flag is a technical release gate only. It does not itself make a legal determination about consent requirements in every deployment jurisdiction.

Manual snippet installation is the single v1 analytics installation owner. Cloudflare supports automatic edge injection for proxied sites; that mode must be disabled / changed to manual JS snippet installation for the production hostname before activation so it cannot bypass the repository's fail-closed state or create a duplicate beacon.

## Data boundary

Browser Audio Lab does not add these values to analytics:

```text
microphone audio
recording contents
live FFT data
pitch measurements
meter measurements
Decibel calibration payloads
```

Core microphone processing remains local to the browser as specified by the existing measurement/privacy contracts.

## Build validation

Targeted validation run:

```text
GitHub Actions run 33661574654
head 5d52ba5504ae9a3cdf1a7e5f0f9750303367bf91
```

Result:

```text
pnpm format:check                     PASS
pnpm lint                             PASS
pnpm check                            PASS
pnpm test                             PASS
pnpm test:analytics                   PASS
pnpm test:indexing                    PASS
Chromium install                      PASS
Chromium shell/browser smoke          PASS
```

`pnpm test:analytics` builds all 18 HTML routes twice:

1. analytics disabled — verifies no Cloudflare beacon URL or synthetic token is emitted and `/privacy` reports analytics disabled;
2. synthetic authorized Cloudflare state — verifies exactly one Cloudflare beacon/token on every HTML route and verifies the enabled-state privacy/audio-content boundary.

The synthetic token is test input only and is not a production Cloudflare credential.

`pnpm test:indexing` remained green in the same run, so analytics readiness does not weaken the independent fail-closed indexing contract.

## Not completed by this unit

Still external / rollout-dependent:

```text
real Cloudflare account/site creation or selection
real Cloudflare Web Analytics site token
Cloudflare automatic beacon injection disabled / manual snippet mode confirmed
production-domain decision
DNS or Cloudflare proxy configuration
deployment
jurisdiction-specific privacy/consent approval
real analytics network verification in production
real-device/browser smoke QA
Search Console
SITE_INDEXING=enabled production activation
post-deploy canonical/sitemap/indexing verification
```

No item above may be inferred complete merely because the repository can now emit a correctly gated analytics beacon.
