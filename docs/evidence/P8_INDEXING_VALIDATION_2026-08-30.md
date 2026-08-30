# P8.3 Indexing Validation — 2026-08-30

## Scope

This record covers the P8.3 production-indexing artifact gate for Browser Audio Lab.

It does **not** certify the complete P8 release.

P8.3 establishes that the repository can intentionally produce a coherent indexable static build when both production-indexing environment inputs are explicitly supplied, while the ordinary/default build remains non-indexable.

## Implemented contract

P8.3 adds and validates:

```text
@astrojs/sitemap@3.7.3
Astro config as the single SITE_INDEXING / SITE_ORIGIN activation owner
shared strict HTTPS origin validation
runtime canonical/robots policy derived from resolved Astro.site
conditional sitemap integration only for enabled valid-origin builds
default noindex,nofollow build with no production canonical
no default sitemap output
positive build-level indexing verifier
CI full-validation invocation of the positive indexing verifier
```

## Supported local validation

Validated execution commit:

```text
5d2bde8e5b51c26507abb4b63e0da1e043998ea5
```

Runtime:

```text
Node v24.16.0
pnpm 11.21.0
```

Results reported from the clean supported-runtime validation:

```text
pnpm install --frozen-lockfile  PASS
pnpm check                    PASS
pnpm test                     PASS — 172/172
pnpm test:indexing            PASS
```

`pnpm test:indexing` performed a real Astro static build with:

```text
SITE_INDEXING=enabled
SITE_ORIGIN=https://indexing-test.example
```

The synthetic origin is validation input only. It is not a production-domain choice and must never be copied into production configuration.

## Positive build assertions

The verifier checked all 18 HTML routes:

```text
/
/privacy
/sound-test
/speaker-test
/headphone-test
/stereo-test
/phase-test
/surround-sound-test
/bass-test
/tone-generator
/frequency-sweep
/noise-generator
/microphone-test
/spectrum-analyzer
/pitch-detector
/decibel-meter
/audio-latency-test
/hearing-frequency-test
```

For the indexed synthetic build it verified:

```text
index,follow metadata on every HTML route
canonical URL present on every HTML route
canonical remains inside the configured origin
/sitemap-index.xml exists
/sitemap-0.xml exists
/robots.txt contains the sitemap index URL
every canonical URL appears in the generated sitemap
```

The successful output reported:

```text
Indexed build verified for 18 HTML routes at https://indexing-test.example.
```

## Default-build safety boundary

The default branch behavior remains intentionally non-indexable unless activation is explicit.

Without the enabled production-indexing configuration:

```text
robots meta = noindex,nofollow
production canonical = omitted
robots.txt = crawlable Allow: /
Sitemap directive = omitted
/sitemap-index.xml = absent
```

This separates crawler accessibility from indexing authorization.

## Single activation path

The first P8.3 draft exposed a split-brain risk because Astro config and runtime pages could read environment values through different mechanisms.

Cold Review #1 rejected that design.

The corrected path is:

```text
SITE_INDEXING + SITE_ORIGIN
→ resolveSiteIndexingConfig()
→ astro.config.ts
→ Astro.site
→ runtime canonical + robots policy
```

The sitemap integration is activated by the same validated config-time decision.

Runtime pages do not independently re-read SITE_INDEXING or SITE_ORIGIN.

## Validation follow-up findings

The supported-runtime validation also exposed unrelated or adjacent repository/tooling issues that were investigated rather than automatically classified as environment failures.

Follow-up fixes on the P8.3 branch included:

```text
Windows Node 24.16 pnpm.cmd spawn compatibility in the indexing verifier
LF checkout policy through .gitattributes
strict TypeScript compatibility fixes exposed by current tooling
local Playwright preview-server reuse disabled to avoid validating against a stale server
targeted Audio Latency and Bass first-viewport compaction after Chromium layout failures
```

These follow-up commits did not change the P8.3 indexing activation/configuration/verifier contract after the successful `pnpm test:indexing` execution at `5d2bde8e5b51c26507abb4b63e0da1e043998ea5`.

## Explicit limitations

This evidence does **not** claim:

```text
hosted GitHub Actions green CI
full Playwright Chromium/Firefox/WebKit release suite pass
real Chrome/Firefox/Edge/Safari support certification
real iOS/Android device certification
runtime accessibility certification
complete visual QA
analytics/privacy-provider approval
production deployment success
Google Search Console verification
production indexing activation
```

Hosted GitHub Actions has an observed no-runner/pre-step failure mode in this repository. Any affected run must remain recorded as infrastructure/no-runner evidence, never as green CI.

## Release interpretation

`PRODUCTION_INDEXING_ARTIFACTS_READY = true` means:

> the sitemap/canonical/robots/indexing artifact path is implemented and has positive build evidence.

It does **not** mean:

> production indexing is authorized now.

Final activation still requires the remaining P8 release gates and an explicit real-domain deployment configuration:

```text
SITE_INDEXING=enabled
SITE_ORIGIN=https://<real-production-origin>
```

No production domain is selected or invented in P8.3.