# P7 SEO Runner Execution Contract

## Purpose

This file defines the reproducible evidence run required before Browser Audio Lab makes P7 SEO decisions.

It is an execution contract, not SEO evidence and not a decision record.

No route role, slug, internal-link emphasis, build/watch/reject decision or launch claim may be changed merely because this file exists.

## Runner prerequisite

The previously blocked prerequisite is now available in `DanilaH/super-converter-parser`.

Minimum required capability is the landed V2.1 analytical evidence pipeline, first merged as:

```text
be892b479d89cd8299adffa9eacf489ca2a4ce2b
```

The current observed Runner `main` while this contract was authored is:

```text
3a77b5280f7f1c6ca3409e6955983cb22df46332
```

The live Audio run must record the **actual Runner commit SHA used**. Do not silently treat either SHA above as the run SHA if Runner has advanced before execution.

Required Runner capabilities:

```text
direct seed discovery
fresh-cache bypass
SERP-overlap clustering
query-language suggestions
domain registration + first-seen evidence
ranking-page inspection
site-structure inspection
representative-query sets
entrant cohorts
cohort-history projection
provider-neutral traffic evidence import
finalist evidence matrix
```

If any of those commands/contracts are unavailable in the checkout used for the run, stop and do not call the result the P7 refresh.

## Research boundary

P7 evaluates the already-built 16-tool Audio catalog.

It does not reopen product scope merely to chase keyword variants.

The initial run is therefore **targeted**:

- source: `docs/evidence/P7_AUDIO_RUNNER_SEEDS.csv`;
- US-English research orientation;
- direct seeds only;
- `--force-refresh` required;
- **do not use `--expand` on the initial discovery run**.

Expansion is intentionally disabled because the immediate question is whether the existing distinct user jobs have target intent, accessible SERPs and useful acquisition roles. Adjacent ideas can be researched separately after launch or under a future explicit scope decision.

Query-language discovery is still allowed through the V2.1 `query_suggestions` enrichment module. Those suggestions are evidence and do not enter the discovery queue automatically.

## Seed provenance

The CSV intentionally uses the Runner's one-column `keyword` schema. The mapping below preserves why each query exists.

| Current route | Current job | Targeted seeds |
| --- | --- | --- |
| `/sound-test` | fast L/Both/R audio smoke test | `sound test`; `audio test` |
| `/speaker-test` | speaker/channel troubleshooting | `speaker test`; `speaker sound test` |
| `/headphone-test` | ear-specific channel/range/rattle check | `headphone test`; `headphone sound test` |
| `/stereo-test` | channel separation, center and pan | `stereo test`; `left right stereo test` |
| `/phase-test` | in-phase vs inverted comparison | `phase test`; `speaker polarity test` |
| `/surround-sound-test` | discrete surround-channel routing when available | `surround sound test`; `5.1 surround sound test` |
| `/bass-test` | low-frequency listening/rattle exploration | `bass test`; `subwoofer test` |
| `/tone-generator` | requested digital oscillator | `tone generator`; `frequency generator`; `online tone generator` |
| `/frequency-sweep` | controlled listening sweep | `frequency sweep`; `audio frequency sweep` |
| `/noise-generator` | reference noise generation | `noise generator`; `white noise generator`; `pink noise generator`; `brown noise generator` |
| `/microphone-test` | capture/level/waveform/record-playback | `microphone test`; `mic test` |
| `/spectrum-analyzer` | relative live frequency-energy display | `spectrum analyzer`; `audio spectrum analyzer` |
| `/pitch-detector` | musical pitch estimate | `pitch detector`; `online pitch detector` |
| `/decibel-meter` | digital dBFS + optional calibrated estimate | `decibel meter`; `sound meter`; `online decibel meter` |
| `/audio-latency-test` | browser latency information + manual AV sync | `audio latency test`; `av sync test`; `audio delay test` |
| `/hearing-frequency-test` | user-observed frequency exploration | `hearing frequency test`; `high frequency hearing test`; `hearing range test` |

Ambiguous terms are deliberate. Their purpose is to test intent fit, not to force the existing page to own an unrelated SERP.

## Stage 1 — fresh discovery

From the Runner repository, with Research Chrome + Keyword Surfer/CDP prepared, run:

```bash
npm run research -- \
  --seeds <ABSOLUTE_PATH_TO_AUDIO_REPO>/docs/evidence/P7_AUDIO_RUNNER_SEEDS.csv \
  --name audio-p7 \
  --force-refresh \
  --json-status
```

Do not omit `--force-refresh`. A normal completed keyword cache can remain valid for seven days; P7 is explicitly a fresh evidence checkpoint and must not accidentally become a warm-cache replay of an earlier Audio/frozen-corpus observation.

Do not add `--expand` to this first run.

Record after discovery:

```text
Runner commit SHA
research/run id
research directory
terminal state
market / hl / gl
processed keyword count
completed / partial / failed counts
geo warnings
Ahrefs DR state
results.zip path
```

### Repair rule

A terminal run with retryable primary-source failures is not silently accepted as complete evidence.

Use the current Runner repair path for retryable failed/partial primary checkpoints:

```bash
npm run research -- --resume <run-id> --retry-failed
```

Preserve retry history. Do not rebuild a new run merely to hide failures.

If remaining failures are non-retryable or provider/browser evidence is materially incomplete, record the gap explicitly and stop before making evidence-dependent SEO decisions.

## Stage 2 — canonical enrichment

Use the same targeted seed CSV as the shortlist so all current jobs remain eligible for deep evidence even when a discovery score ranks some lower:

```bash
npm run enrich -- \
  --run <run-id> \
  --modules clusters,query_suggestions,domain_age,pages,site_structure \
  --shortlist-file <ABSOLUTE_PATH_TO_AUDIO_REPO>/docs/evidence/P7_AUDIO_RUNNER_SEEDS.csv
```

Record:

```text
enrichment id
enrichment directory
terminal state
module states
results.zip path
```

Do not use Score v1 as a build/no-build gate for the already-implemented Audio catalog.

## Stage 3 — select finalist intent clusters

Review `keyword-clusters.csv` / `.json` before running representative-query generation.

Select cluster ids explicitly. Do **not** use `--all-clusters` merely for convenience.

A selected finalist cluster should correspond to a current Audio user job or a clearly relevant search-intent variant of that job.

Rules:

- keep intent separation evidence-driven;
- do not create a new route for a synonym;
- do not merge materially distinct jobs solely because their SERPs overlap;
- do not delete an implemented core tool solely because its acquisition priority is weak;
- off-intent or ambiguous seed results are evidence about SEO role/wording, not a mandate to change product behavior;
- preserve the selected cluster-id list in the P7 evidence record.

## Stage 4 — representative queries

For the explicit selected finalist clusters:

```bash
npm run representatives -- \
  --enrichment <enrichment-id> \
  --clusters <comma-separated-cluster-ids>
```

Keep the Runner default representative count unless the evidence gives a concrete reason to override it.

Manual representative overrides require a written reason and must be preserved as provenance. Do not hand-pick representatives merely to improve the apparent outcome.

## Stage 5 — entrant cohort

```bash
npm run entrant-cohort -- --enrichment <enrichment-id>
```

Interpret the output descriptively.

The entrant cohort contains domains currently observed in representative-query top-10 SERPs. It does not contain failed/non-ranking entrants and therefore must not be converted into a launch-success probability.

## Stage 6 — history policy and cohort history

`domain_age` evidence is collected in Stage 2, but V2.1 intentionally has no hidden universal thresholds for `young`, recent web presence or possible history conflict.

Before the **first** Audio cohort-history projection, P7 review must choose and record explicit values for:

```text
young-domain-max-age-days
recent-web-presence-max-age-days
repurpose-gap-min-days
```

Do not invent these values during command entry. Persist the chosen policy in the P7 evidence record, then run:

```bash
npm run cohort-history -- \
  --enrichment <enrichment-id> \
  --young-domain-max-age-days <days> \
  --recent-web-presence-max-age-days <days> \
  --repurpose-gap-min-days <days>
```

Unknown/omitted provider observations remain unknown. They are not negative evidence.

## Stage 7 — traffic evidence and velocity

Existing manual Audio evidence in `competitor-evidence.csv` may be reused only after current cluster ownership is known and only when each imported entity can be mapped honestly to a current finalist cluster.

The V2.1 traffic import is provider-neutral and cluster-owned. Build a canonical import using the Runner's required schema:

```text
target_cluster_id
scope
entity
observed_at
provider_data_date
market
source
organic_traffic
traffic_value
traffic_value_currency
provenance
```

Rules:

- preserve domain vs URL scope;
- never turn domain traffic into page traffic;
- preserve mismatches rather than fuzzy-matching them away;
- choose and record the Audio `low-base-organic-traffic-threshold` before the first projection;
- one snapshot is traffic proof, not velocity;
- claim velocity only where at least two compatible same-entity/same-market/same-source effective observations exist.

Then run:

```bash
npm run traffic-evidence -- \
  --enrichment <enrichment-id> \
  --input <audio-traffic-evidence.csv> \
  --low-base-organic-traffic-threshold <value>
```

If comparable fresh traffic snapshots are unavailable, P7 must record velocity as unavailable rather than fabricate a trend.

## Stage 8 — finalist evidence matrix

Build the matrix only after the upstream evidence generation is current:

```bash
npm run finalist-evidence -- --enrichment <enrichment-id>
```

First build it **without human decisions**.

Review the independent evidence blocks:

```text
A Demand
B SERP accessibility
C Organic traffic proof
D Entrant repeatability
E Moat
F Monetization / geography
G Product feasibility
```

The matrix is an evidence surface, not an opportunity score.

Only after review may a separate decisions JSON be applied for current finalist clusters.

## P7 decision outputs

P7 may update:

```text
acquisition-anchor / supporting / completeness roles
slug wording where evidence is strong and the user job remains distinct
internal-link emphasis
metadata/query wording where it remains measurement-honest
```

P7 must not:

```text
invent success probability
convert missing evidence to zero
prune the sensible 16-tool product fan solely on SEO priority
create thin synonym routes
weaken measurement/safety claims for search wording
change tool behavior merely because acquisition priority changes
```

## Evidence acceptance record

Before P7 is considered complete, preserve at least:

```text
Audio repo commit used for the run
Runner commit SHA actually used
run id + enrichment id
research/enrichment artifact locations
source seed file hash or Audio commit
selected finalist cluster ids
representative revision
entrant fingerprint/generation where published
history policy values
traffic low-base policy value
manual traffic provenance
unresolved evidence gaps
finalist-evidence artifact identity
human decisions and whether evidenceCurrent=true
```

P7 is complete only when the resulting evidence has been reviewed and the justified role/slug/internal-link changes have passed the normal Audio PR + cold-review workflow.

P8 remains phase-gated until then.
