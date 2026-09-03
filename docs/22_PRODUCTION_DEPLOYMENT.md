# 22 — Production deployment — VPS + Caddy

Status: **repository deployment contract ready; real domain/VPS deployment not yet executed**.

This is the production deployment path for Browser Audio Lab unless a later explicit decision replaces it.

## Scope

Browser Audio Lab is an Astro static site. Production does not require Node, a reverse proxy to an application process, SSR, a database or a long-running JavaScript server.

Deployment shape:

```text
build dist/
→ upload immutable release directory
→ atomically replace /srv/browser-audio-lab/current symlink
→ validate/reload Caddy
→ run real-origin live verifier
```

Do not introduce Docker, nginx, Vercel, Netlify, Cloudflare Pages or a Node production server merely for deployment convenience.

## Required external inputs

Before the first deployment, obtain the real values and network prerequisites:

```text
REAL_PRODUCTION_DOMAIN
VPS SSH access
DNS A record pointing to the VPS
DNS AAAA record pointing to the VPS only if IPv6 is intentionally served
inbound TCP 80 reachable by Caddy
inbound TCP 443 reachable by Caddy
```

Do not substitute a synthetic hostname for the production-domain gate.

Do not expect Caddy automatic HTTPS to succeed until the real hostname resolves to the VPS and the relevant public HTTP/HTTPS ports are reachable. If an AAAA record exists, its IPv6 destination must also reach this Caddy instance; do not leave a stale AAAA record pointing elsewhere.

## Server filesystem

Canonical layout:

```text
/srv/browser-audio-lab/
  releases/
    <git-sha>/
  current -> /srv/browser-audio-lab/releases/<git-sha>
```

Each uploaded release directory is immutable after publication. Rollback replaces only the `current` symlink.

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

Once the real hostname resolves to this VPS and public ports 80/443 are reachable, Caddy owns HTTPS certificate issuance/renewal for that hostname.

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

After upload is complete, prepare a temporary symlink and atomically rename it over `current`:

```text
ln -sfn /srv/browser-audio-lab/releases/<SHA> /srv/browser-audio-lab/current.next
mv -Tf /srv/browser-audio-lab/current.next /srv/browser-audio-lab/current
```

On the Linux VPS, the second command replaces the directory entry for `current` through a rename rather than mutating the live symlink in place. The target release directory already exists and is complete before that switch.

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

This first real-origin verification must prove the public origin still has:

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

Rebuild, publish a new immutable release, atomically switch `current`, then verify the new intended state:

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

Rebuild and deploy a new immutable release, then re-run the verifier against the final intended analytics/indexing state:

```text
pnpm verify:live-release -- \
  --origin https://<REAL_PRODUCTION_DOMAIN> \
  --indexing enabled \
  --analytics <actual-enabled-or-disabled-state>
```

Only a green real-origin enabled-indexing verifier permits sitemap submission to Search Console.

## Rollback

If a release has a critical defect, prepare a temporary symlink to the last known-good immutable release and atomically rename it over `current`:

```text
ln -sfn /srv/browser-audio-lab/releases/<PREVIOUS_SHA> /srv/browser-audio-lab/current.next
mv -Tf /srv/browser-audio-lab/current.next /srv/browser-audio-lab/current
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

Then run the live verifier using the analytics/indexing state expected for the rollback release.

Rollback does not authorize changing indexing or analytics state implicitly.

## Repository contract validation

The repository exposes:

```text
pnpm test:deploy-contract
```

It verifies that `deploy/Caddyfile` remains domain-agnostic, static-only, preserves extensionless Astro route handling, serves immutable Astro assets with long-lived caching and does not silently introduce a reverse proxy or explicit redirects.

Authoritative Full Validation also runs the real Caddy 2.11.4 configuration parser against the repository Caddyfile. Targeted deployment readiness additionally runtime-smoked a fail-closed Astro build through Caddy and verified `/sound-test` returns HTTP 200 without a trailing-slash redirect.

## Still external after this document exists

The document/configuration do not claim completion of:

```text
real domain registration
DNS propagation to the VPS
public TCP 80/443 reachability
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
