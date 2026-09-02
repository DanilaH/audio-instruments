# 22 — Production deployment — VPS + Caddy

Status: **repository deployment contract ready; real domain/VPS deployment not yet executed**.

This is the production deployment path for Browser Audio Lab unless a later explicit decision replaces it.

## Scope

Browser Audio Lab is an Astro static site. Production does not require Node, a reverse proxy to an application process, SSR, a database or a long-running JavaScript server.

Deployment shape:

```text
build dist/
→ upload immutable release directory
→ switch /srv/browser-audio-lab/current symlink
→ validate/reload Caddy
→ run real-origin live verifier
```

Do not introduce Docker, nginx, Vercel, Netlify, Cloudflare Pages or a Node production server merely for deployment convenience.

## Required external inputs

Before the first deployment, obtain the real values:

```text
REAL_PRODUCTION_DOMAIN
VPS SSH access
DNS A/AAAA target for the VPS
```

Do not substitute a synthetic hostname for the production-domain gate.

## Server filesystem

Canonical layout:

```text
/srv/browser-audio-lab/
  releases/
    <git-sha>/
  current -> /srv/browser-audio-lab/releases/<git-sha>
```

Each uploaded release directory is immutable after publication. Rollback changes only the `current` symlink.

## Caddy contract

Repository configuration:

```text
deploy/Caddyfile
```

It requires:

```text
SITE_DOMAIN=<real hostname>
SITE_ROOT=/srv/browser-audio-lab/current
```

`SITE_ROOT` defaults to `/srv/browser-audio-lab/current` in the Caddyfile.

The server must persist `SITE_DOMAIN` for the Caddy service. One acceptable systemd drop-in is:

```ini
[Service]
Environment=SITE_DOMAIN=<REAL_PRODUCTION_DOMAIN>
Environment=SITE_ROOT=/srv/browser-audio-lab/current
```

After changing the drop-in:

```text
sudo systemctl daemon-reload
```

The repository Caddy block may be copied into the server's managed Caddy configuration or imported from a site-specific file. Preserve any unrelated existing VPS sites.

Before every reload:

```text
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Then:

```text
sudo systemctl reload caddy
```

Caddy owns HTTPS certificate issuance/renewal for the real hostname.

## Initial fail-closed build

The first public deployment must keep both indexing and analytics disabled:

```text
SITE_INDEXING=disabled
SITE_ANALYTICS=disabled
```

Build from the exact reviewed/merged release commit:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm check
pnpm test
pnpm test:analytics
pnpm test:indexing
pnpm test:live-release-contract
pnpm test:deploy-contract
SITE_INDEXING=disabled SITE_ANALYTICS=disabled pnpm build
```

Do not configure `SITE_INDEXING=enabled` in the initial deploy.

Do not configure the Cloudflare analytics token in the initial deploy.

## Upload and atomic activation

Let `<SHA>` be the exact merged commit being deployed.

Create the release directory on the VPS and upload the contents of `dist/` into it:

```text
/srv/browser-audio-lab/releases/<SHA>/
```

After upload is complete, switch atomically:

```text
ln -sfn /srv/browser-audio-lab/releases/<SHA> /srv/browser-audio-lab/current
```

Then validate/reload Caddy.

Do not upload directly into `current`; a partial copy must never become the live site.

## Immediate post-deploy gate

As soon as HTTPS is live, run from a trusted machine:

```text
pnpm verify:live-release -- \
  --origin https://<REAL_PRODUCTION_DOMAIN> \
  --indexing disabled \
  --analytics disabled
```

A failure blocks further rollout.

This stage must prove the real public origin still has:

```text
all 18 HTML routes reachable
same-origin HTTPS redirects only
noindex,nofollow
no production canonical
no public sitemap
no Cloudflare analytics beacon
/privacy reports the disabled build state
```

Record the exact origin, deployed Git SHA, verifier command and result in a new deployment evidence file.

## Analytics activation — separate gate

Only after the deployment-jurisdiction privacy/consent decision and real Cloudflare site setup are complete:

```text
SITE_ANALYTICS=cloudflare-web-analytics
ANALYTICS_PRIVACY_REVIEW=approved
CLOUDFLARE_WEB_ANALYTICS_TOKEN=<real token>
```

For a Cloudflare-proxied hostname, automatic Web Analytics injection must remain disabled / manual snippet mode must be selected so the repository-owned beacon remains the single installation owner.

Rebuild, publish a new immutable release, switch `current`, then verify:

```text
pnpm verify:live-release -- \
  --origin https://<REAL_PRODUCTION_DOMAIN> \
  --indexing disabled \
  --analytics enabled
```

Also verify actual Cloudflare ingestion separately; HTML beacon presence alone does not prove dashboard ingestion.

## Indexing activation — final gate

Only after real-device smoke QA, analytics/privacy disposition, deployment verification and Search Console preparation are accepted:

```text
SITE_INDEXING=enabled
SITE_ORIGIN=https://<REAL_PRODUCTION_DOMAIN>
```

Rebuild and deploy a new immutable release, then run:

```text
pnpm verify:live-release -- \
  --origin https://<REAL_PRODUCTION_DOMAIN> \
  --indexing enabled \
  --analytics <actual-enabled-or-disabled-state>
```

Only a green real-origin enabled-indexing verifier permits sitemap submission to Search Console.

## Rollback

If a release has a critical defect, point `current` back to the last known-good immutable release:

```text
ln -sfn /srv/browser-audio-lab/releases/<PREVIOUS_SHA> /srv/browser-audio-lab/current
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

Then run the live verifier using the state expected for the rollback release.

Rollback does not authorize changing indexing or analytics state implicitly.

## Repository contract validation

The repository exposes:

```text
pnpm test:deploy-contract
```

It verifies that `deploy/Caddyfile` remains domain-agnostic, static-only, preserves extensionless Astro route handling, serves immutable Astro assets with long-lived caching and does not silently introduce a reverse proxy or explicit redirects.

This deterministic check is part of authoritative Full Validation.

## Still external after this document exists

The document/configuration do not claim completion of:

```text
real domain registration
DNS propagation
VPS filesystem/config changes
TLS issuance
first fail-closed deployment
real-origin live verification
physical-device/browser smoke QA
Cloudflare analytics activation/ingestion
Search Console
production indexing activation
mechanical GitHub main protection
```
