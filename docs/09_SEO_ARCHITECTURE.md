# 09 — SEO Architecture

## Language/market baseline

```text
English-only
US-English SEO/copy orientation
```

## Working tool routes

```text
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

Non-tool route:

```text
/privacy
```

Exact tool slugs may be refined before launch.

## Route rule

One distinct user job per tool route.

No thin singular/plural/order/synonym pages.

Only live tool routes are linked publicly.

## Tool-first rule

Interactive tool precedes long explanatory copy.

Useful below-tool content:

```text
how to use
what result means
common problems
limitations
browser behavior
FAQ
related live tools
```

No filler/minimum word count.

## Internal-link clusters

### Output

```text
Sound
Speaker
Headphone
Stereo
Phase
Surround
Bass
```

### Signal/frequency

```text
Tone
Sweep
Noise
Bass
Hearing Frequency
```

### Input/analysis

```text
Microphone
Spectrum
Pitch
Decibel Meter
```

Render related links only when target registry status is `live`.

## Indexing environments

### Public preview / staging

Default:

```text
crawlable
noindex,nofollow
no production canonical
no production sitemap
```

Do **not** robots-disallow these same public pages, because crawlers must be able to read the `noindex` directive.

### Private staging

If a staging environment must not be publicly crawlable:

```text
use real access control/authentication at the hosting layer
```

Do not treat `robots.txt` as privacy/security.

### Production indexing

Requires both:

```text
SITE_INDEXING=enabled
valid absolute HTTPS SITE_ORIGIN
```

Validate `SITE_ORIGIN` at build time:

```text
URL parses successfully
protocol === "https:"
hostname is non-empty
no path/query/hash beyond "/"
```

When indexing is enabled:

```text
robots = index,follow
canonical = SITE_ORIGIN + normalized pathname
sitemap origin = SITE_ORIGIN
```

## Sitemap / robots implementation ownership

P8 adds official package:

```text
@astrojs/sitemap
```

Astro config includes the sitemap integration only when the indexing gate is satisfied.

For non-indexable builds:

```text
do not enable @astrojs/sitemap
```

`src/pages/robots.txt.ts` is environment-aware:

Public noindex preview:

```text
User-agent: *
Allow: /
```

Production indexed:

```text
User-agent: *
Allow: /
Sitemap: <SITE_ORIGIN>/sitemap-index.xml
```

Private staging is protected at hosting level; robots.txt is not its protection mechanism.

## Canonical

Production canonical uses:

```text
new URL(normalizedPathname, SITE_ORIGIN)
```

No canonical is emitted when indexing gate is disabled.

## P7 research refresh

When upgraded runner is ready:

```text
representative-query cohort
target-intent validation
traffic snapshots/velocity
domain/page/history moat
role update
slug review
internal-link emphasis review
```

Do not rewrite functional product behavior merely because acquisition priority changes.

## Post-launch

Use GSC evidence:

```text
impressions
queries
positions
clicks
```
