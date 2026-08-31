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

The selected v1 provider is **Cloudflare Web Analytics**, but it is **not enabled in the current product baseline**.

Official Cloudflare documentation reviewed on 2026-08-31 states that its Web Analytics usage-metric collection does not use cookies or localStorage and does not fingerprint individuals for Vitals collection. It currently does not support custom events or UTM parameters.

That makes it suitable for the initial page/referrer/browser/device/Core-Web-Vitals need without introducing a broader product-event analytics surface.

This decision does not change `/privacy` yet because no provider is active. Before enablement, the actual Cloudflare integration/network behavior and any required consent treatment must be reflected in `/privacy` and reviewed for the real deployment jurisdictions. Microphone/recording content remains prohibited from analytics.

## Indexing

The Privacy route follows the same environment-level indexing gate as the rest of the public site unless a later SEO decision explicitly changes it.

## Acceptance

No legal guarantee is implied by this technical spec.

Before monetized production, privacy/compliance copy should receive an explicit release review appropriate to the chosen providers and target jurisdictions.
