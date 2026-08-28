# 17 — Technical References

External references support technical boundaries; repository specifications remain authoritative for product behavior.

## Web Audio

```text
https://www.w3.org/TR/webaudio-1.0/
https://webaudio.github.io/web-audio-api/
https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext
https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/sampleRate
```

Used for AudioContext processing/sample-rate behavior, automation and standardized 5.1 semantics.

## Media capture

```text
https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings
https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getSupportedConstraints
https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static
```

## BFCache/page lifecycle

```text
https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event
https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event
```

## Spectrum

```text
https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getFloatFrequencyData
```

## Playwright

```text
https://playwright.dev/docs/browsers
https://playwright.dev/docs/test-webserver
```

Playwright WebKit is not branded Safari certification.

`webServer` + `baseURL` are the current browser-test harness baseline.

## Google indexing

```text
https://developers.google.com/search/docs/crawling-indexing/block-indexing
```

A crawler must be able to access a public page to read its `noindex` directive; do not block the same public noindex page in robots.txt.

## CI / pnpm

```text
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
https://github.com/pnpm/setup
https://github.com/pnpm/setup/releases
https://github.com/actions/checkout/releases
https://github.com/actions/upload-artifact/releases
```

Current CI baseline:

```text
actions/checkout@v7
actions/upload-artifact@v7 (failure diagnostics only)
pnpm/setup@v2
pnpm 11.21.0
runtime node@24
```

## Motion

```text
https://motion.dev/docs/quick-start
```

Baseline package:

```text
motion
```

## Phosphor

```text
https://github.com/phosphor-icons/web
```

Baseline Vanilla JS package:

```text
@phosphor-icons/web
```

Do not replace it with framework-specific bindings.

## GitHub skipped required jobs

GitHub documents that a job skipped by a conditional can report a successful conclusion and not block merging even if its check is required.

Repository consequence:

```text
conditional full-validation is NOT the required branch-protection check
merge-gate is required and always executes
```

Reference:

```text
https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks
```

## Astro validation / formatting

Astro CLI checking requires:

```text
@astrojs/check
typescript
```

CLI Prettier support for `.astro` uses:

```text
prettier-plugin-astro
```

References:

```text
https://docs.astro.build/
https://docs.astro.build/en/editor-setup/
```

Astro ESLint baseline:

```text
eslint-plugin-astro
```

Reference:

```text
https://ota-meshi.github.io/eslint-plugin-astro/
```

## Web Audio latency units

`baseLatency` / `outputLatency` are reported in seconds.

UI conversion:

```text
milliseconds = seconds * 1000
```

Reference:

```text
https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency
```
