# P7 Audio SEO Evidence — 2026-08-30

## Purpose

This is the reviewed evidence/decision record for the fresh P7 Audio Runner pass.

It records what the run supports, what it does not support, and the SEO decisions applied to the already-built 16-tool catalog.

It is not a ranking forecast and does not express a launch-success probability.

## Provenance

Audio baseline before the live run:

```text
repository: DanilaH/audio-instruments
main commit: 00b131d21f53441c9449bd38361afe5649f9b0e3
```

Discovery:

```text
run id: 20260830084817127_cf2b71d4-e4fd-4149-9f9b-aacd1d97f00c
state: completed
input: 63 direct seeds
completed: 63
partial: 0
failed: 0
force refresh: yes
market: US
Google hl: en
Google gl: us
Ahrefs DR: 140 / 140 domains with numeric DR
```

The actual discovery input was the expanded 63-seed cohort now preserved as:

```text
docs/evidence/P7_AUDIO_RUNNER_SEEDS_2026-08-30.csv
```

This deliberately extends the original 38-seed contract with 25 task/problem-intent variants such as `how to test speakers`, `test my microphone`, `online ...`, and `what frequencies can i hear`.

The change did **not** enable Runner `--expand`: all 63 queries were explicit direct seeds. The original 38-seed file remains the initial contract artifact; the dated 63-seed file is the actual-run provenance artifact.

Enrichment:

```text
enrichment id: 20260830090605698_c45a9028-a431-460a-a0e4-08659ecc7e3f
state: completed
deep shortlist: 29 representative candidate queries
SERP clusters: 24
representative revision: 1
representative query selections: 29
manual representative overrides: 0
entrant cohort domains: 203
entrant ranking occurrences: 232
weak domains: 37 / 203 with known DR
repeated domains across representative queries: 17
entrant fingerprint: 265131504cb59b45ad96acfd4949b38883a142e9f9e93bab3510e989533190c1
```

History policy chosen before the first projection:

```text
young-domain-max-age-days: 730
recent-web-presence-max-age-days: 365
repurpose-gap-min-days: 730
```

History result:

```text
cohort domains: 203
checked: 105
omitted by cap: 98
registration date known: 93
young domains: 3
first-seen observations: 0
comparable registration-vs-first-seen history: 0
```

### Runner SHA provenance gap

The output archive does not persist the local Runner git SHA, so the exact checkout used cannot be reconstructed from the artifact alone.

GitHub `main` at the discovery start time was:

```text
3b60a0b41ee8ed8892ad3c5abd3cfeefdcc84158
```

That is useful upstream timing evidence, **not proof of the local Runner HEAD**. The missing exact local SHA is retained as a provenance limitation rather than being fabricated.

The output artifacts themselves demonstrate the required V2.1 capabilities used by this review: clustering, query suggestions, domain age, page/site inspection, representatives, entrant cohort, cohort history, and finalist evidence matrix.

## Known evidence limitations

### Google physical location mismatch

All discovery observations used:

```text
RESEARCH_MARKET=US
GOOGLE_HL=en
GOOGLE_GL=us
```

but Google reported the physical location:

```text
Chelyabinsk Oblast, Russia
```

All 63 discovery rows therefore carry the geo warning. Treat volume/CPC and the configured US market as useful inputs, but do not describe the SERP sample as a clean physically-US-localized observation.

### Domain/page coverage caps

Deep enrichment discovered 102 domains for capped domain-level modules.

```text
domain age observed: 30
site structure observed: 30
domain-age omitted by cap: 72
site-structure omitted by cap: 72
page inspections: 70
page inspection errors: 14
```

The 14 page failures are ordinary fetch/403 gaps. Missing observations remain unknown rather than negative evidence.

### First-seen/history

The first-seen provider was unavailable, so recent web-presence and repurpose-gap evidence cannot be evaluated. Registration-age evidence is partial because of the domain cap.

### Traffic evidence / velocity

No V2.1 provider-neutral traffic snapshot was imported into this enrichment:

```text
imported traffic snapshots: 0
traffic velocity: unavailable
```

A `low-base-organic-traffic-threshold` was therefore not selected: the contract requires it before the first traffic projection, and no traffic projection was performed.

The older manual Ahrefs observations in `MANUAL_AHREFS_2026-08-28.md` remain supplemental traffic proof where current SERP ownership still matches. They are single third-party snapshots, not velocity.

Current SERP observations independently re-confirm two especially useful manual-evidence domains:

- `hzgenerator.com` (DR ~2.3) appears in `online tone generator`, `sweep tone generator`, and `tone generator` cohorts;
- `soundtest.io` (DR ~21) appears in the broad sound/speaker/stereo cohort and also ranks for bass, headphone, online tone, and surround intents.

`micworker.com` and `mictest.vip` were not observed in the current finalist cohorts, so their older manual traffic snapshots remain product/demand context rather than current entrant-cohort evidence.

## Finalist intent review

The 24 explicitly selected clusters remain mapped to existing jobs. No cluster justifies a thin synonym route.

| Cluster | Canonical query | Median volume | Weak DR cohort | Decision | Existing route ownership |
| --- | --- | ---: | ---: | --- | --- |
| cluster-1 | sound test | 9,900 (max 33,100) | 2 / 11 | build | `/sound-test` primary; `/speaker-test` and `/stereo-test` remain distinct supporting jobs |
| cluster-2 | bass test | 1,690 | 3 / 10 | build | `/bass-test` |
| cluster-3 | speaker polarity test | 195 | 2 / 9 | build | `/phase-test` |
| cluster-4 | white noise generator | 3,200 | 3 / 11 | build | `/noise-generator` |
| cluster-5 | audio frequency sweep | 0 | 0 / 7 | watch | covered by `/frequency-sweep`; do not create another route |
| cluster-6 | audio latency test | 880 | 4 / 8 | build | `/audio-latency-test` |
| cluster-7 | audio spectrum analyzer | 1,600 | 1 / 7 | build | `/spectrum-analyzer` |
| cluster-8 | av sync test | 320 | 2 / 6 | build | `/audio-latency-test` |
| cluster-9 | decibel meter | 40,500 | 2 / 9 | build | `/decibel-meter` |
| cluster-10 | frequency sweep | 480 | 0 / 7 | build | `/frequency-sweep` |
| cluster-11 | headphone test | 6,600 | 3 / 10 | build | `/headphone-test` |
| cluster-12 | hearing frequency test | 2,400 | 0 / 9 | build | `/hearing-frequency-test` |
| cluster-13 | high frequency hearing test | 320 | 0 / 9 | build | `/hearing-frequency-test` |
| cluster-14 | how to test speakers | 590 | 1 / 8 | build | supporting informational intent on `/speaker-test`; no guide route |
| cluster-15 | microphone test | 135,000 | 1 / 10 | build | `/microphone-test` |
| cluster-16 | online tone generator | 8,100 | 4 / 8 | build | `/tone-generator` |
| cluster-17 | pink noise generator | 1,300 | 0 / 6 | build | `/noise-generator` |
| cluster-18 | pitch detector | 8,100 | 2 / 8 | build | `/pitch-detector` |
| cluster-19 | sine wave generator | 2,900 | 1 / 9 | build | `/tone-generator` |
| cluster-20 | spectrum analyzer | 9,900 | 0 / 8 | build | `/spectrum-analyzer` |
| cluster-21 | surround sound test | 1,600 | 2 / 7 | build | `/surround-sound-test` |
| cluster-22 | sweep tone generator | 50 | 3 / 8 | watch | covered by `/frequency-sweep`; no synonym route |
| cluster-23 | tone generator | 18,100 | 1 / 10 | build | `/tone-generator` |
| cluster-24 | what frequencies can i hear | 0 | 0 / 8 | watch | optional language around `/hearing-frequency-test`; no expansion mandate |

`build` means retain/optimize the existing route coverage. It does not mean create a new route for every cluster.

## Route roles after P7

All 16 v1 routes remain live. SEO priority changes do not alter functional behavior.

### Acquisition anchors

```text
/tone-generator
/sound-test
/headphone-test
/microphone-test
/decibel-meter
/pitch-detector
```

Rationale:

- Tone has the best combined evidence: `tone generator` 18.1k, `online tone generator` 8.1k with 4/8 weak domains, and live weak-authority proof from `hzgenerator.com`.
- Sound owns the broad current `sound test` / `speaker test` / `stereo test` SERP cluster; `soundtest.io` provides repeated weak-domain evidence and supplemental traffic proof.
- Headphone has 6.6k direct demand with 3/10 weak entrant domains.
- Microphone has the largest direct demand (135k) and older direct traffic proof, but the current SERP is comparatively stronger; it is an anchor by upside, not by ease.
- Decibel has 40.5k direct demand and 2/9 weak domains, while measurement claims must remain explicitly dBFS-first.
- Pitch has 8.1k direct demand and 2/8 weak domains; history coverage is limited, so accessibility remains evidence rather than certainty.

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

Notable interpretation:

- Speaker and Stereo stay separate product jobs even though their primary SERPs overlap the broad Sound cluster. The SEO response is to avoid competing keyword-stuffed pages, not to merge useful tools.
- Audio Latency has modest demand but unusually accessible observed SERPs (4/8 weak domains for the direct latency cluster).
- Spectrum has real demand but a harder direct SERP (0/8 weak domains for `spectrum analyzer`), so it should not receive disproportionate acquisition effort.

### Completeness tools

```text
/phase-test
/frequency-sweep
/hearing-frequency-test
```

These remain useful distinct jobs. Their current acquisition evidence does not justify extra routes, aggressive content expansion, or priority above the stronger anchors.

## P7 repository changes justified by evidence

The route set and slugs remain unchanged.

The existing homepage already gives Tone Generator primary hero emphasis and features Tone, Speaker, Microphone, and Headphone. That composition is compatible with the fresh evidence and does not need churn merely to mirror a ranking table.

Metadata may use proven task wording where it does not change claims:

```text
Tone Generator      → emphasize online tone/frequency-generator intent
Microphone Test     → emphasize online microphone-test intent
Headphone Test      → emphasize online headphone-test intent
Pitch Detector      → emphasize online pitch-detector intent
Decibel Meter       → emphasize online decibel-meter intent while retaining dBFS-first claims
Noise Generator     → expose white/pink/brown generator intent
```

No evidence justifies:

```text
new synonym routes
slug migrations
functional changes
removing lower-priority tools
weakening measurement/safety language
claiming traffic velocity
claiming a success probability
```

## P7 acceptance

The live evidence collection and human review are complete enough for the current product/SEO decisions.

Unresolved provenance/data gaps are explicitly retained above and are not silently converted into positive or negative evidence.

P7 can close after the evidence-backed metadata/status changes pass the normal Audio PR + cold-review workflow. P8 remains the next phase and owns production indexing, sitemap/canonical implementation, real browser/device QA, analytics, and release decisions.
