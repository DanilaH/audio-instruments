# 01 — Research and Evidence

## Purpose

This document defines how research evidence is interpreted.

Raw/manual competitor snapshots live in:

```text
docs/evidence/competitor-evidence.csv
docs/evidence/MANUAL_AHREFS_2026-08-28.md
```

P7 collection/provenance artifacts live in:

```text
docs/evidence/P7_AUDIO_RUNNER_SEEDS.csv
docs/evidence/P7_AUDIO_RUNNER_SEEDS_2026-08-30.csv
docs/evidence/P7_RUNNER_EXECUTION.md
docs/evidence/P7_AUDIO_EVIDENCE_2026-08-30.md
```

The dated P7 evidence record is the reviewed live-run decision record. The execution contract is methodology, not evidence by itself.

## Evidence ladder

```text
L0 interesting idea
L1 keyword demand
L2 potentially accessible SERP
L3 weak/young successful competitors
L4 own impressions
L5 rankings improving
L6 organic clicks
L7 ad revenue
L8 economics/support costs work
```

Current Audio research is still pre-launch evidence, primarily L1–L3.

## Current conclusion

The fresh P7 Runner pass is complete and reviewed for product/SEO decisions.

Observed pipeline state:

```text
63 / 63 discovery seeds completed
24 finalist SERP clusters
29 representative-query selections
203 entrant-cohort domain rows
37 weak-domain observations
cohort-history projection completed
finalist evidence matrix completed
traffic velocity unavailable
```

The evidence supports keeping the full 16-tool v1 catalog and refining acquisition priority/metadata. It does **not** justify synonym routes, catalog pruning, success-probability claims, or functional changes.

Current acquisition anchors:

```text
/tone-generator
/sound-test
/headphone-test
/microphone-test
/decibel-meter
/pitch-detector
```

Strong supporting tools:

```text
/speaker-test
/stereo-test
/surround-sound-test
/bass-test
/noise-generator
/spectrum-analyzer
/audio-latency-test
```

Completeness tools:

```text
/phase-test
/frequency-sweep
/hearing-frequency-test
```

Route ownership and the full cluster-level rationale live in `P7_AUDIO_EVIDENCE_2026-08-30.md`; SEO implementation ownership lives in `09_SEO_ARCHITECTURE.md`.

## Current notable signals

### Tone Generator

Fresh evidence is strongest here:

```text
tone generator: 18,100 volume
frequency generator: 12,100 volume in discovery
online tone generator: 8,100 volume; 4 / 8 weak domains; CPC 8.92
```

`hzgenerator.com` (DR ~2.3) is again observed in the current tone cohorts and retains older manual target-intent traffic proof.

### Sound / Speaker / Stereo

The fresh SERP clustering groups `sound test`, `speaker test` and `stereo test` together.

`/sound-test` is therefore the broad acquisition anchor, while Speaker and Stereo remain separate useful product jobs without trying to create three keyword-stuffed versions of the same page.

`soundtest.io` (DR ~21) is repeatedly observed across the current cluster and retains older manual direct traffic proof.

### Microphone

`microphone test` has the largest direct observed demand at 135,000, but only 1 / 10 current entrant domains is weak by the Runner threshold.

The route remains an acquisition anchor by demand/upside, not because the SERP is easy.

Older `micworker.com` / `mictest.vip` traffic observations remain product/demand context; those domains were not observed in the current finalist cohorts.

### Decibel Meter

`decibel meter` shows 40,500 direct demand with 2 / 9 weak domains.

SEO wording must remain measurement-honest: browser dBFS is the default measurement; calibrated physical-level language stays explicitly conditional/estimated.

### Headphone / Pitch / Latency

```text
headphone test: 6,600; 3 / 10 weak domains
pitch detector: 8,100; 2 / 8 weak domains
audio latency test: 880; 4 / 8 weak domains
```

Headphone and Pitch justify acquisition emphasis. Latency is lower-demand but unusually accessible in the observed SERP, so it remains a strong supporting tool.

## P7 limitations

The live evidence record preserves these material gaps:

```text
Google physical location detected as Chelyabinsk Oblast, Russia despite US/en/us config
first-seen provider unavailable
domain-age/site-structure deep modules capped at 30 of 102 discovered domains
14 page-inspection fetch/403 failures
exact local Runner git SHA not persisted in the output archive
no provider-neutral V2.1 traffic snapshot import
traffic velocity unavailable
```

Missing evidence is unknown, not zero.

The exact local Runner SHA is not reconstructed from GitHub timing. `3b60a0b41ee8ed8892ad3c5abd3cfeefdcc84158` was GitHub `main` at discovery start and is recorded only as upstream timing evidence, not proof of local HEAD.

## False-positive rule

Domain traffic is not target-tool proof by itself.

A domain is useful traffic proof only when target intent is validated or the evidence is explicitly described as mixed.

## Traffic Value

Traffic Value is a PPC-equivalent estimate.

It is not:

```text
display-ad revenue
profit
cash payout
```

One traffic snapshot is proof of observed third-party estimate only. It is not velocity.

## Backlink interpretation

Do not treat raw referring-domain count as a complete moat.

Consider:

```text
dofollow share
quality/relevance
network/owned-link suspicion
domain vs page scope
history
```

## P7 Runner evidence matrix

The V2.1 finalist matrix remains an evidence surface across independent blocks:

```text
Demand
SERP accessibility
Organic traffic proof
Entrant repeatability
Moat
Geo/monetization
Product feasibility
```

It is not a single opportunity score.

Accepted human build decisions remain:

```text
build
watch
reject
unknown
```

Accepted SEO/product roles remain:

```text
acquisition_anchor
strong_supporting_tool
completeness_tool
experimental
not_applicable
```

## Evidence provenance requirement

New evidence rows should record, when available:

```text
observed_at
source
scope: domain or URL
top-keyword summary
geo summary
artifact/screenshot reference
checked_by
limitations
```

The record must make it possible to reconstruct **why** an observation was accepted, not only preserve a number.
