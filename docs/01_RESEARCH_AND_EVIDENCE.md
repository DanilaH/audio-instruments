# 01 — Research and Evidence

## Purpose

This document defines how research evidence is interpreted.

Raw/manual competitor snapshots live in:

```text
docs/evidence/competitor-evidence.csv
```

The canonical P7 live-run input and execution contract live in:

```text
docs/evidence/P7_AUDIO_RUNNER_SEEDS.csv
docs/evidence/P7_RUNNER_EXECUTION.md
```

Those P7 files define collection/provenance rules; they are not live evidence by themselves.

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

Current Audio research is pre-launch evidence, primarily L1–L3.

## Current conclusion

Audio has enough evidence to build and the full 16-tool v1 catalog is already implemented.

The upgraded SEO Runner V2.1 prerequisite is now available. The Audio-specific fresh P7 evidence run is still pending.

P7 is expected to refine:

```text
entrant repeatability
target-intent validation
traffic velocity
domain/page/history moat
acquisition-anchor priority
```

Do not treat Runner availability or the execution contract as evidence that those questions are already resolved.

## Current notable signals

### Tone Generator

`hzgenerator.com` provides strong evidence that a comparatively weak domain can obtain meaningful target-intent tone/frequency traffic.

Working role:

```text
likely acquisition anchor
```

### Speaker / Sound

`soundtest.io` provides strong direct traffic proof for speaker/sound-test intent and a broader audio utility cluster.

Working role:

```text
likely acquisition anchor
```

### Microphone

`micworker.com` strongly validates direct mic-test demand and traffic, but has a meaningful backlink/domain moat.

`mictest.vip` has target-intent traffic but also a strong domain/backlink profile.

Therefore:

```text
Mic Test = strong product/traffic proof
low-authority accessibility = less proven
```

## False-positive rule

Domain traffic is not target-tool proof by itself.

A domain is useful traffic proof only when:

```text
target_intent_status = validated
```

or the evidence is explicitly described as mixed.

## Traffic Value

Traffic Value is a PPC-equivalent estimate.

It is not:

```text
display-ad revenue
profit
cash payout
```

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

## Research limitations

Manual/free-source research is limited by:

```text
domain-level rather than page-level estimates
partial backlink samples
survivorship bias
incomplete geography
possible domain reuse
traffic-estimate noise
```

Never infer a success probability from observed winners.

## P7 Runner evidence matrix

The V2.1 finalist evidence matrix exposes the following evidence blocks for each selected finalist cluster:

```text
Demand
SERP accessibility
Organic traffic proof
Entrant repeatability
Moat
Geo/monetization
Product feasibility
```

The matrix remains an evidence surface, not a single opportunity score.

Separate:

```text
build/watch/reject
```

from:

```text
acquisition_anchor
strong_supporting_tool
completeness_tool
experimental
```

Human decisions are recorded only after the current live evidence is reviewed.

## Evidence provenance requirement

New manual evidence rows should record, when available:

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

The ledger must make it possible to reconstruct **why** a domain was accepted as target-intent evidence, not only preserve a traffic number.
