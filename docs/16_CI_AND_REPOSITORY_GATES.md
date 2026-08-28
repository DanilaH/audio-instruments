# 16 — CI and Repository Gates

## Purpose

Define and execute the project merge discipline:

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

The project owner has explicitly accepted this manual mode as the current operating model. No visibility change or paid GitHub plan is required for P0–P8. The assistant still treats a green `merge-gate` as mandatory before performing a merge, while documenting that GitHub itself does not make the rule unbypassable.

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

`full-ci-approved` is added only after the Review #2 cold pass while the PR is still Draft.

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

## Repository-gate operating mode

The ideal mechanical target remains:

```text
Require a pull request before merging
Require status check: merge-gate
Block force pushes
Block branch deletion
Disable bypass where supported
```

The current private/free repository cannot expose those controls. The owner explicitly accepts manual enforcement, so P0 is complete when the process itself is followed and the latest `merge-gate` is green.

Current mandatory policy:

```text
no direct roadmap pushes to main
PR stays Draft through Review #2
full-ci-approved only after Review #2
Ready triggers full-validation
merge only after full-validation + merge-gate success
squash merge by default
```

Do not describe this as mechanically unbypassable GitHub protection. Do not repeatedly reopen the unavailable-protection issue unless repository visibility or plan changes.
