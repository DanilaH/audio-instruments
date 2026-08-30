# 20 — P0 Tooling Contract

## Purpose

Remove P0 ambiguity around Astro validation, linting, formatting and browser testing.

Exact resolved dependency versions are locked in `pnpm-lock.yaml`.

Package identities and responsibilities are fixed here.

## Runtime dependencies

P0 baseline:

```text
astro
motion
@phosphor-icons/web
```

P8.3 additionally installs the release-only build integration:

```text
@astrojs/sitemap@3.7.3
```

Do not install framework bindings for Motion or Phosphor.

## Development dependencies

P0 installs:

```text
typescript
@types/node
@astrojs/check

vitest

@playwright/test

eslint
@eslint/js
typescript-eslint
@typescript-eslint/parser
eslint-plugin-astro

prettier
prettier-plugin-astro
```

`@types/node` is required because repository TypeScript validation includes Node-hosted configuration such as `playwright.config.ts`, which reads `process.env.CI`.

The sitemap package was intentionally deferred until P8 and is now installed as part of P8.3. Do not back-project it into the P0–P6 baseline.

## pnpm 11 supply-chain baseline

Keep the pnpm 11 supply-chain defaults enabled.

In particular:

```text
minimum release-age verification remains enabled
strict dependency-build approval remains enabled
```

If a newly published dependency is rejected by the release-age policy, prefer a mature reviewed version rather than disabling the policy merely to take the newest release.

P0 requires:

```text
pnpm-workspace.yaml
```

with the narrow install-script allowlist:

```yaml
allowBuilds:
  esbuild: true
```

`esbuild` is approved because the validated Astro/Vite toolchain requires its install step.

Do not use `dangerouslyAllowAllBuilds`.

Any additional dependency lifecycle-script approval requires normal review and a documented reason.

## Astro type/check contract

`pnpm check` is:

```text
astro check
```

Required packages:

```text
@astrojs/check
typescript
@types/node
```

Strict TypeScript remains enabled through the Astro/TS config.

The official Phosphor web package exposes weight-specific side-effect imports such as the Regular CSS payload. Because that CSS subpath does not provide TypeScript declarations, P0 declares only the used Regular subpath in `src/env.d.ts`; this declaration must not be widened to hide unrelated missing-module errors.

## Vitest contract

Configuration file:

```text
vitest.config.ts
```

Unit discovery is explicitly limited to:

```text
tests/unit/**/*.test.ts
```

Vitest must not collect `tests/browser/**`; Playwright owns that suite.

## ESLint contract

Configuration file:

```text
eslint.config.mjs
```

It must lint both:

```text
TypeScript/JavaScript
Astro components
```

Baseline plugins/configs:

```text
@eslint/js recommended
typescript-eslint recommended
eslint-plugin-astro recommended flat config
```

Current lint script:

```text
eslint "src/**/*.{js,mjs,ts,astro}" "tests/**/*.{js,mjs,ts}" "scripts/**/*.{js,mjs,ts}" "playwright.config.ts" "vitest.config.ts" "astro.config.ts"
```

Do not use an ESLint invocation that silently skips `.astro` files.

Do not add formatting-as-ESLint rules; formatting belongs to Prettier.

## Prettier contract

Required:

```text
prettier
prettier-plugin-astro
```

Configuration:

```text
.prettierrc.mjs
```

The Astro plugin is explicitly registered.

`.astro` files use the Astro parser.

Formatting check uses the exact source/tests/scripts/config glob script defined below.

Do not expand it to `prettier --check .`; the documentation corpus is intentionally outside the formatting gate.

P8.3 also adds `.gitattributes` with LF normalization so Windows `core.autocrlf` checkouts do not make the repository-wide source/config Prettier gate depend on local line-ending policy.

## Exact scripts

Current `package.json` scripts:

```text
dev           = astro dev
build         = astro build
preview       = astro preview --host 127.0.0.1
check         = astro check
test          = vitest run
test:indexing = node scripts/verify-indexed-build.mjs
test:browser  = pnpm build && playwright test
lint          = eslint "src/**/*.{js,mjs,ts,astro}" "tests/**/*.{js,mjs,ts}" "scripts/**/*.{js,mjs,ts}" "playwright.config.ts" "vitest.config.ts" "astro.config.ts"
format:check  = prettier --check "src/**/*.{astro,css,js,mjs,ts}" "tests/**/*.{js,mjs,ts}" "scripts/**/*.{js,mjs,ts}" "playwright.config.ts" "vitest.config.ts" "eslint.config.mjs" ".prettierrc.mjs" "astro.config.ts" "pnpm-workspace.yaml" "package.json" "tsconfig.json"
```

`test` is never watch mode.

`test:indexing` is P8 release tooling. It performs a synthetic positive indexed build and verifies the generated sitemap/canonical/robots contract; it is not part of the historical P0–P6 acceptance baseline.

`test:browser` is standalone-safe on a clean checkout because it creates the static build before Playwright starts `pnpm preview`.

## Playwright

Configuration:

```text
playwright.config.ts
```

Required projects:

```text
chromium
firefox
webkit
```

Retries:

```text
retries = 0
```

Server reuse:

```text
reuseExistingServer = false
```

Every local/CI run must validate the preview produced by the current checkout rather than silently attach to an unrelated process already listening on port 4321.

Failure diagnostics:

```text
trace = retain-on-failure
screenshot = only-on-failure
CI uploads test-results on failure
```

A browser test either passes in the current run or fails the merge gate.

Do not turn a flaky first attempt into an accepted second-attempt pass.

## Phosphor payload policy

Global baseline:

```text
Regular only
```

Optional tool-local weights:

```text
Fill
Duotone
```

may be loaded only when that route actually uses them.

Do not globally load all Phosphor weights.

A route should normally use no more than:

```text
2 icon weights
```

unless visual review explicitly approves an exception.

## GitHub Actions dependency policy

Core workflow actions use the reviewed major release lines documented in `17_TECHNICAL_REFERENCES.md`.

v1 deliberately chooses:

```text
major-tag pins + Dependabot updates
```

instead of manually maintained full-SHA pins.

Reason:

```text
small private project
low workflow privilege
pull_request only
contents: read
regular dependency update visibility
```

`/.github/dependabot.yml` monitors:

```text
github-actions
npm/pnpm dependencies
```

Changing this policy requires a normal maintenance PR.

## Mandatory P0 bootstrap tests

P0 creates real tests; do not enable pass-with-no-tests behavior.

Required unit test:

```text
tests/unit/registry.test.ts
```

Minimum assertions:

```text
registry contains the complete 16-tool v1 set without duplicate ids/routes
registry entries satisfy the planned/live schema
public filtering returns only live entries
planned entries are excluded from public navigation data
```

Required browser smoke test:

```text
tests/browser/shell.spec.ts
```

Minimum assertions:

```text
GET /
→ page renders
→ no unhandled page error
→ no planned-tool link is exposed

GET /privacy
→ page renders
→ no unhandled page error

all planned tool routes
→ return 404 until explicitly promoted live and implemented

desktop smoke viewport
→ document has no horizontal overflow
```

These tests exist in P0 before the first Draft PR can reach the full-validation gate.

Do not enable any Vitest or Playwright option that treats an empty test suite as a successful run.

## Node baseline

Supported range:

```text
>=24.16 <25
```

Local baseline:

```text
.nvmrc = 24.16.0
```

CI may use the current Node 24 line through `runtime: node@24`, which is expected to resolve at or above the supported floor.

If CI/runtime resolution ever falls below `24.16`, validation must fail rather than silently using an unsupported local toolchain.