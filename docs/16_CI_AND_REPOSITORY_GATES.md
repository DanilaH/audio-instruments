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

Current observed state on 2026-08-31:

```text
repository visibility = public
main branch metadata: protected = false
repository rulesets endpoint: []
repository gate mode = manual until protection is configured and verified
```

The old private/free-plan explanation is no longer current. The workflow provides a real `merge-gate` and it remains mandatory process policy, but GitHub does not currently mechanically prevent owner/admin bypass. Mechanical protection is now an explicit repository-hardening task rather than a plan-availability assumption.

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

The repository is now public, but current observed configuration still has no protected `main` and no repository rulesets. Manual enforcement remains active until protection is explicitly configured and verified. The latest `merge-gate` must still be green before merge.

Current mandatory policy:

```text
no direct roadmap pushes to main
PR stays Draft through Review #2
full-ci-approved only after Review #2
Ready triggers full-validation
merge only after full-validation + merge-gate success
squash merge by default
```

Do not describe the current repository as mechanically protected. Because visibility has changed to public, the former unavailable-protection rationale is closed; the relevant next step is actual protection configuration/verification when the owner chooses to harden the repository.
