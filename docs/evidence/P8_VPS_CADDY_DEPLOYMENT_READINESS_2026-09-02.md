# P8 VPS + Caddy deployment readiness — 2026-09-02

## Purpose

Repository-side evidence for Browser Audio Lab's static production deployment contract.

This record does **not** claim that a production domain has been registered, DNS has been changed, the VPS has been modified, TLS has been issued, or a real deployment has occurred.

## Deployment decision

The v1 deployment shape is intentionally small:

```text
Astro static dist/
→ immutable VPS release directory
→ atomic /srv/browser-audio-lab/current symlink replacement
→ Caddy static file server
→ real-origin live verifier
```

No Node production process, SSR adapter, reverse proxy, Dockerized application runtime, database or backend service is required for Browser Audio Lab.

Canonical runbook:

```text
docs/22_PRODUCTION_DEPLOYMENT.md
```

Canonical Caddy configuration:

```text
deploy/Caddyfile
```

## Caddy contract

The repository configuration is domain-agnostic:

```text
SITE_DOMAIN=<real production hostname>
SITE_ROOT=/srv/browser-audio-lab/current
```

The Caddyfile:

- serves static files only;
- enables zstd/gzip;
- rewrites Astro extensionless routes to `/route/index.html` before file serving;
- applies immutable caching to `/_astro/*` assets;
- contains no production hostname;
- contains no `reverse_proxy` directive;
- contains no explicit `redir` directive.

The extensionless rewrite exists to avoid depending on a directory redirect for Astro route URLs.

## Deterministic contract validation

Repository command:

```text
pnpm test:deploy-contract
```

It validates the domain/root placeholders, static-only ownership, route rewrite, asset caching and absence of hard-coded production hosting decisions.

This command is part of authoritative Full Validation.

## Real Caddy targeted validation

Targeted GitHub Actions run:

```text
run 33672285099
head abae7136d1dec9680a94e43b9840aafea9186473
```

Result:

```text
pnpm format:check                                      PASS
pnpm lint                                              PASS
pnpm check                                             PASS
pnpm test:deploy-contract                              PASS
pnpm test:live-release-contract                        PASS
pnpm test:analytics                                    PASS
pnpm test:indexing                                     PASS
fail-closed Astro static build                         PASS
Caddy 2.11.4 caddy validate                            PASS
Caddy 2.11.4 local static runtime smoke                PASS
GET /sound-test = HTTP 200                             PASS
GET /sound-test has no Location redirect               PASS
```

The Caddy runtime smoke used the official `caddy:2.11.4-alpine` image with a synthetic local listener (`:8080`) and mounted the real fail-closed `dist/` output. The synthetic listener is validation input only and is not a production hostname.

## Initial production state

The first real deployment remains explicitly fail-closed:

```text
SITE_INDEXING=disabled
SITE_ANALYTICS=disabled
```

After HTTPS is live on the real production hostname, the required first live gate is:

```text
pnpm verify:live-release -- \
  --origin https://<REAL_PRODUCTION_DOMAIN> \
  --indexing disabled \
  --analytics disabled
```

A green local Caddy smoke does not replace this real-origin verification.

## Cold Review #1 remediation

Cold Review #1 on clean head `48ea47c1d969d2d4cb03b40a91fed66a2321110d` found:

```text
BLOCKER 0
MAJOR 1
MINOR 2
```

Remediation:

1. the runbook no longer calls direct `ln -sfn ... current` an atomic deployment switch; activation and rollback now build `current.next` and atomically rename that symlink over `current` with Linux `mv -Tf`;
2. the rollout roadmap distinguishes the first fail-closed real-origin verification from later verifier reruns after analytics/indexing state changes;
3. the runbook explicitly requires the real hostname to resolve to the VPS and inbound TCP 80/443 to be reachable before relying on Caddy automatic HTTPS. An intentionally published AAAA record must also route to this Caddy instance.

The Caddyfile itself did not change during review remediation; the real Caddy 2.11.4 runtime evidence above therefore remains applicable to the same server configuration.

## Rollback ownership

Releases are immutable directories under:

```text
/srv/browser-audio-lab/releases/<git-sha>/
```

Activation/rollback prepares:

```text
/srv/browser-audio-lab/current.next
```

and atomically renames that symlink over:

```text
/srv/browser-audio-lab/current
```

A partial upload must never be copied directly into the live `current` path.

## Still external / incomplete

```text
real production domain registration
DNS A configuration to the VPS
DNS AAAA configuration only if IPv6 is intentionally served
public TCP 80/443 reachability
VPS filesystem and Caddy service configuration
real TLS certificate issuance
first fail-closed deployment
real-origin live verifier run
real Safari macOS smoke QA
real iOS Safari smoke QA
real Android Chrome smoke QA
real Edge smoke QA
physical microphone/output-device smoke QA
real Cloudflare site/token/manual-snippet-mode configuration
analytics privacy/consent activation decision
Cloudflare ingestion confirmation
Search Console setup
SITE_INDEXING=enabled production activation
post-indexing real-origin canonical/sitemap verification
mechanical GitHub main-branch protection
```

No item above may be inferred complete from repository deployment readiness alone.
