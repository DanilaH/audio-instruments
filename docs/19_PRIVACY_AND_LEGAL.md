# 19 — Privacy and Legal

## Purpose

`/privacy` is a real static route from P0 onward.

Its copy must describe actual site behavior, not generic boilerplate.

## Core v1 baseline

Before analytics/ads are added, the page states plainly:

```text
No account is required.
Core microphone tools process audio locally in the browser.
Core v1 does not upload microphone recordings/audio to our server.
A local calibration setting may be stored in browser storage for the selected input device.
```

Do not claim:

```text
the site stores absolutely nothing
no third parties ever receive network data
zero cookies forever
```

unless that remains technically true at release.

## Local storage disclosure

If Decibel Meter calibration is used:

```text
browserAudioLab.dbCalibration.v2
```

is local browser storage.

Explain:

```text
purpose
device-scoped calibration metadata
how Reset removes the relevant calibration
```

No raw microphone audio is stored there.

## Analytics / ads

Before enabling any analytics/ad provider:

1. inventory network requests, identifiers, cookies and browser storage;
2. update `/privacy`;
3. implement required consent behavior for target jurisdictions/providers;
4. confirm no microphone/audio content is sent;
5. record provider name/purpose in release docs.


## Selected analytics provider for rollout

The selected v1 provider is **Cloudflare Web Analytics**. The repository integration is fail-closed and **disabled by default**; production activation is not authorized merely because the integration exists.

Official Cloudflare documentation was refreshed on 2026-09-02 before implementation. Its Web Analytics usage-metric collection does not use cookies or localStorage and does not fingerprint individual visitors for this analytics collection. Cloudflare's RUM documentation states that source IP is received during ordinary HTTP handling but discarded at the nearest Cloudflare data center rather than stored in the RUM service's core databases/logs. Custom events and UTM analytics are not part of this v1 integration.

That makes it suitable for the initial page/referrer/browser/device/Core-Web-Vitals need without introducing a broader product-event analytics surface.

`/privacy` now reflects the actual build state: default builds state that analytics is disabled, while an explicitly authorized analytics build discloses Cloudflare Web Analytics and the technical data boundary. Activation still requires the real deployment-jurisdiction privacy/consent review and a real Cloudflare site token. Microphone audio, recordings, live FFT/pitch/meter values and Decibel calibration payloads remain prohibited from Browser Audio Lab analytics.

The technical activation contract is:

```text
SITE_ANALYTICS=cloudflare-web-analytics
ANALYTICS_PRIVACY_REVIEW=approved
CLOUDFLARE_WEB_ANALYTICS_TOKEN=<Cloudflare site token>
```

The approval flag is a release-control mechanism, not a legal guarantee. Evidence: `docs/evidence/P8_ANALYTICS_READINESS_2026-09-02.md`.

## Indexing

The Privacy route follows the same environment-level indexing gate as the rest of the public site unless a later SEO decision explicitly changes it.

## Acceptance

No legal guarantee is implied by this technical spec.

Before monetized production, privacy/compliance copy should receive an explicit release review appropriate to the chosen providers and target jurisdictions.
