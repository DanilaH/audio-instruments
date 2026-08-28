# 16 — CI and Repository Gates

## Purpose

Mechanically enforce:

```text
development
→ Draft PR
→ Review #1
→ fixes
→ Review #2
→ full-ci-approved
→ Ready
→ full validation
→ merge gate
→ merge
```

The required branch-protection check must never become successful merely because an authorization condition skipped a job.

## Repository initialization and current enforcement mode

The CI workflow is designed for repositories that already have a `main` branch.

A brand-new empty repository may receive the reviewed baseline as a one-time direct bootstrap before normal PR enforcement exists. After that seed, roadmap implementation uses PRs.

Current observed state on 2026-08-28:

```text
repository visibility = private
GitHub protected-branch/ruleset API = unavailable on current plan
repository gate mode = manual
```

Therefore the workflow may run and provide the `merge-gate` check, but the repository must not claim that GitHub mechanically prevents an administrator from bypassing it until protected branches/rulesets become available.

Resolution options:

```text
make the repository public
upgrade to a GitHub plan supporting protected private repositories
or obtain explicit user approval for temporary manual enforcement
```

## Tracked PR events

Workflow listens to:

```text
opened
ready_for_review
converted_to_draft
labeled
unlabeled
synchronize
reopened
```

Cheap authorization/merge-gate jobs may run before Review #2.

The **expensive validation suite does not**.

## Authorization

Authorized means both:

```text
pull_request.draft == false
full-ci-approved label present
```

`full-ci-approved` is added only after independent Review #2 while the PR is still Draft.

Then the PR is marked Ready.

## Job architecture

Three jobs:

```text
authorization
full-validation
merge-gate
```

### authorization

Always runs on tracked PR events.

It only computes:

```text
authorized = true | false
```

No checkout/typecheck/tests/browser suite.

### full-validation

Depends on `authorization`.

It uses a job-level condition:

```text
authorized == true
```

This job may legitimately be skipped before Review #2 because it is **not** the branch-protection required check.

### merge-gate

Depends on:

```text
authorization
full-validation
```

It uses:

```text
if: always()
```

It has **no authorization job-level skip**.

It fails unless:

```text
authorized == true
AND
full-validation result == success
```

Therefore:

```text
unauthorized → merge-gate FAIL
authorized + validation failed → merge-gate FAIL
authorized + validation skipped → merge-gate FAIL
authorized + validation success → merge-gate PASS
```

## Branch protection

Required status check:

```text
merge-gate
```

Do **not** require conditional `full-validation` as the sole merge-protection check.

Also configure:

- no direct pushes to main;
- pull request required;
- Draft cannot merge;
- squash merge default.

## Full-validation suite

Runtime:

```text
Node >=24.16 <25
pnpm 11.21.0
```

Actions:

```text
actions/checkout@v7
pnpm/setup@v2
```

Package/scripts are governed by `20_P0_TOOLING_CONTRACT.md`.

Suite:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm check
pnpm test
pnpm exec playwright install --with-deps chromium firefox webkit
pnpm test:browser
```

`pnpm test:browser` performs its own production build before Playwright preview.

## Full-CI authorization cycle

Canonical:

```text
Draft
→ Review #1
→ fixes
→ Review #2
→ add full-ci-approved
→ Ready
→ full-validation
→ merge-gate
```

If a material post-validation change reopens product/architecture/UX/claims/privacy/safety review:

```text
convert to Draft
remove full-ci-approved
review/fix
new Review #2
add label
Ready
```

`converted_to_draft` / `unlabeled` events cause merge-gate to return to failure.

## Browser tests

`playwright.config.ts`:

```text
webServer.command = pnpm preview
baseURL = http://127.0.0.1:4321
projects = chromium / firefox / webkit
retries = 0
```

CI media mocks verify state machines/fallbacks only.

Real audio hardware/browser behavior remains P8 manual QA.

## Permissions and dependency updates

Workflow permissions:

```text
contents: read
```

Action version policy:

```text
reviewed major tags
+ Dependabot weekly monitoring
```

See `20_P0_TOOLING_CONTRACT.md`.

## Branch-protection hardening

Before the first roadmap PR is mergeable, configure the `main` rule/ruleset with:

```text
Require a pull request before merging
Require status check: merge-gate
Required-check source/app: GitHub Actions where the UI supports source binding
Do not allow bypassing the above settings
Block force pushes
Block branch deletion
```

Repository administrators/maintainers must not retain a practical bypass path for the normal roadmap workflow.

If the repository/account plan does not support these protections for the current repository visibility:

```text
P0 surfaces the limitation explicitly
do not claim the workflow is mechanically enforced
either:
- change repository visibility/plan/settings so the gate is enforceable
or
- obtain explicit user approval for a temporary manual enforcement mode
```

Do not silently downgrade to “we will remember not to bypass it”.
