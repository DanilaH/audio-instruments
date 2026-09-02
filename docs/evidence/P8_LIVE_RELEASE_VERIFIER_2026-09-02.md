# P8 Live Release Verifier Readiness — 2026-09-02

## Purpose

Repository-side evidence for the post-deploy live release verifier.

This record does **not** claim that Browser Audio Lab has been deployed or that a real production origin has passed verification. No production domain is invented or substituted here.

## Implemented command

```text
pnpm verify:live-release -- --origin https://<REAL_PRODUCTION_ORIGIN> --indexing disabled --analytics disabled
```

The two expected states are independent. Later rollout phases can explicitly re-run with analytics and/or indexing enabled only after those production decisions are actually made.

## Live contract checked

The verifier checks all 18 HTML routes and requires the final response to remain on the exact expected HTTPS origin after redirects.

Per-page checks:

```text
HTTP 200
robots metadata matches expected indexing state
canonical absent when indexing is disabled
canonical exact-origin/path when indexing is enabled
Cloudflare beacon count = 0 when analytics is disabled
Cloudflare beacon count = 1 when analytics is enabled
data-cf-beacon count follows the same 0/1 contract
/privacy disclosure matches the expected analytics state
```

Indexing-disabled checks:

```text
robots.txt = User-agent: * + Allow: /
no sitemap directive
/sitemap-index.xml must be absent (404 or 410)
```

Indexing-enabled checks:

```text
robots.txt includes the exact production-origin sitemap directive
/sitemap-index.xml exists
/sitemap-0.xml exists
all sitemap <loc> values remain HTTPS on the exact production origin
all 18 canonical URLs are represented in the sitemap
```

The analytics count check is deliberately useful for Cloudflare rollout: it can detect both a missing repository-owned manual beacon and a duplicate beacon caused by accidental Cloudflare automatic edge injection.

## Deterministic contract validation

The repository also exposes a no-network self-test:

```text
pnpm test:live-release-contract
```

Initial targeted GitHub Actions validation:

```text
run 33666256019
head 5eae16cdaf6e43130ce94c463d72debac2f13724
```

Result:

```text
pnpm format:check                 PASS
pnpm lint                         PASS
pnpm check                        PASS
pnpm test:live-release-contract   PASS
pnpm test:analytics               PASS
pnpm test:indexing                PASS
```

The self-test covers origin validation, enabled/disabled HTML contracts, duplicate-beacon rejection, canonical escape rejection, robots states, sitemap origin lock, CLI expectation parsing and timeout validation.

## Cold Review #1

Cold Review #1 on clean head `14c1b4464b7eeb69caff1719d6dcc40082ef92d1` found:

```text
BLOCKER 0
MAJOR   0
MINOR   3
```

Findings and remediation:

1. removed an unreachable `status === 200` branch after the disabled-sitemap fetch had already constrained accepted statuses to 404/410;
2. tied Cloudflare `type="module"` and `data-cf-beacon` validation to the actual beacon `<script>` tag instead of accepting an unrelated module script elsewhere in the page;
3. changed `--timeout-ms` parsing to reject non-decimal input instead of partially accepting values through `parseInt`.

The self-test now includes a regression case where an unrelated module script is present while the Cloudflare beacon has the wrong type; that state must fail.

## Post-review validation

Post-remediation targeted run:

```text
run 33667069257
```

Result:

```text
pnpm format:check                 PASS
pnpm lint                         PASS
pnpm check                        PASS
pnpm test:live-release-contract   PASS
pnpm test:analytics               PASS
pnpm test:indexing                PASS
```

## What this verifier does not prove

Even a successful real-origin run would not by itself prove:

```text
Cloudflare received or displayed an analytics event
Search Console ownership or sitemap submission
Google indexing
real Safari / iOS Safari / Android Chrome / Edge smoke QA
physical microphone/output-device QA
deployment privacy/consent approval
mechanical GitHub main-branch protection
```

Those remain separate release gates.

## Required rollout usage

Recommended fail-closed sequence after a real origin exists:

1. deploy with production indexing and analytics still disabled;
2. run the live verifier with `--indexing disabled --analytics disabled`;
3. after analytics activation is separately approved/configured, re-run with the real expected analytics state;
4. only after explicit indexing activation, re-run with `--indexing enabled`;
5. record the real origin, command, timestamp and result as deployment evidence.

No live-release verification is complete until that real-origin evidence exists.
