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

P7 found no evidence strong enough to justify a slug migration. Current tool slugs stay unchanged for launch.

## Route rule

One distinct user job per tool route.

No thin singular/plural/order/synonym pages.

Only live tool routes are linked publicly.

SERP overlap does not automatically collapse distinct product jobs. Conversely, distinct keyword formulations do not automatically create distinct routes.

## P7 route roles — reviewed 2026-08-30

### Acquisition anchors

```text
/tone-generator
/sound-test
/headphone-test
/microphone-test
/decibel-meter
/pitch-detector
```

### Strong supporting tools

```text
/speaker-test
/stereo-test
/surround-sound-test
/bass-test
/noise-generator
/spectrum-analyzer
/audio-latency-test
```

### Completeness tools

```text
/phase-test
/frequency-sweep
/hearing-frequency-test
```

These are acquisition-priority roles, not quality tiers. All 16 routes remain first-class live product tools.

Full evidence and cluster ownership: `docs/evidence/P7_AUDIO_EVIDENCE_2026-08-30.md`.

## Intent ownership notes

### Sound / Speaker / Stereo

Fresh clustering groups `sound test`, `speaker test` and `stereo test` into one broad SERP cluster.

SEO ownership is therefore:

```text
/sound-test   → broad quick sound/output-test acquisition intent
/speaker-test → focused speaker troubleshooting job
/stereo-test  → focused channel/separation job
```

Do not make Speaker or Stereo copy mimic the broad Sound page merely to chase the shared cluster.

### Tone / frequency / sine

`tone generator`, `online tone generator` and `sine wave generator` are separate observed SERP clusters, while `frequency generator` also has meaningful direct discovery demand.

All are satisfied by the existing oscillator job:

```text
/tone-generator
```

Do not create `/online-tone-generator`, `/frequency-generator` or `/sine-wave-generator` synonym routes.

### Noise

White, pink and brown generator intents are handled by the existing multi-mode:

```text
/noise-generator
```

Do not create color-specific thin routes unless a future product change creates materially different interaction/result jobs.

### Audio latency / AV sync

`audio latency test` and `av sync test` are separate observed SERP clusters but are intentionally combined in the current route because the page exposes two clearly separated evidence classes under one timing job.

Keep measurement wording explicit: browser-reported latency metadata is not end-to-end physical latency, and manual AV sync is perception-based.

## P7 metadata emphasis

Fresh evidence supports modest task-language refinement without changing claims:

```text
/tone-generator      → online tone + frequency generator wording
/headphone-test      → online headphone-test wording
/microphone-test     → online microphone-test wording
/pitch-detector      → online pitch-detector wording
/decibel-meter       → online decibel-meter wording, dBFS-first
/noise-generator     → white / pink / brown generator wording
```

Do not keyword-stuff H1/body copy when the existing tool label is already the clearest product name.

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

The current homepage and related-tool graph are compatible with P7 evidence. Do not churn them merely to reproduce acquisition-role ordering.

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

P7 live evidence collection and human review are complete.

Canonical records:

```text
docs/evidence/P7_AUDIO_RUNNER_SEEDS_2026-08-30.csv
docs/evidence/P7_AUDIO_EVIDENCE_2026-08-30.md
```

Material limitations remain explicit: physical Google location mismatch, capped domain history/site-structure coverage, unavailable first-seen evidence, missing exact local Runner SHA provenance, and unavailable traffic velocity.

Those gaps constrain claims; they do not justify fabricating evidence or reopening functional scope.

P7 closes only after this evidence-backed repository change passes the normal PR + cold-review workflow. P8 then owns production indexing and release work.

## Post-launch

Use GSC evidence:

```text
impressions
queries
positions
clicks
```
