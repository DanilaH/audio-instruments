# 15 — Development Workflow

This workflow is mandatory for agent-driven implementation.

## Goal

Keep development sequential, reviewable and controlled:

```text
development
→ PR
→ review
→ commit/fixes
→ review
→ full validation
→ green CI
→ merge
→ continue development
```

## Git mechanics note

A pull request cannot exist without at least one commit pushed to a branch.

Therefore the repository uses a **checkpoint commit** solely to make an early Draft PR possible.

That checkpoint commit is not treated as final reviewed implementation.

## Empty-repository initialization

The canonical PR loop assumes `main` already exists.

For a brand-new empty repository only, the reviewed documentation/tooling baseline may be seeded directly to `main` before branch protection exists. This is a one-time repository-birth exception, not a roadmap-development shortcut.

After the baseline seed:

```text
main exists
→ configure/verify repository gate availability
→ all P0+ implementation work uses the normal branch → Draft PR → review → CI workflow
```

If GitHub plan/visibility does not expose protected branches/rulesets, record manual-gate mode and do not describe the workflow as mechanically enforced.

## Canonical workflow

### Step 1 — Start from current main

Before a new roadmap unit:

```text
checkout main
pull/update main
create a dedicated branch
```

One coherent roadmap task/PR per branch.

Avoid unrelated changes.

### Step 2 — Development

Implement the scoped task according to:

```text
relevant docs
acceptance criteria
architecture boundaries
```

During this phase:

- inspect behavior manually as needed;
- use narrow/local debugging checks if required to implement the feature;
- do **not** run the full project-wide validation gate yet.

The formal typecheck/test/lint/browser/CI gate belongs later.

### Step 3 — Checkpoint commit and push

Because Git requires commits for a PR:

```text
create the minimum coherent checkpoint commit
push branch
```

The purpose is to publish the work for review.

Do not interpret the checkpoint as approval.

### Step 4 — Open Draft PR

Open a **Draft PR** immediately after the branch can be reviewed.

PR must contain:

```text
scope
affected docs/spec
what changed
known limitations
screenshots when visual
manual notes when browser/hardware behavior matters
```

Do not mark ready to merge.

### Step 5 — Independent Review #1

Perform a substantive first review by a reviewer independent from the implementing agent.

Implementer self-review does not satisfy this step.

Review for:

```text
scope correctness
architecture
product behavior
measurement honesty
visual/UX direction
resource lifecycle
obvious duplication
```

At this stage, the goal is to catch design/implementation mistakes before paying the cost of the full validation gate.

### Step 6 — Fix review #1 findings

Implement review findings.

Then create normal reviewed implementation commit(s).

Commit scope should remain understandable.

Do not hide unrelated refactors inside fixes.

### Step 7 — Independent Review #2

A reviewer independent from the implementing agent reviews the updated PR again.

This may be the same independent reviewer as Review #1 or another independent reviewer.

Review #2 checks:

```text
review #1 findings actually fixed
no regressions introduced by fixes
final diff still matches scope
architecture remains clean
claims remain honest
```

Only after Review #2 is satisfactory may the PR leave Draft state.

### Step 8 — Authorize full CI, then mark Ready

After independent Review #2 is satisfactory, while the PR is still Draft:

```text
add label: full-ci-approved
```

Then:

```text
Draft
→ Ready for review
```

Full CI requires both the Ready state and that label.

The branch-protection gate is `merge-gate`.

Before authorization, that gate intentionally fails; it never relies on skipped-job success.

The CI mechanics are defined in `16_CI_AND_REPOSITORY_GATES.md`.

### Step 9 — Full validation gate

**Only here** run the complete repository validation suite.

Required as applicable:

```text
format:check
lint
astro/type check
unit/service tests
Playwright/browser tests
build
required screenshot checks
CI
```

Wait for `full-validation` to succeed and required `merge-gate` to become green.

This is the formal quality gate.

### Step 10 — Validation failures

If any check or CI job fails:

```text
fix the issue
→ commit the fix
→ re-review the changed area
→ rerun the relevant full gate
→ wait for green CI
```

If the fix materially changes product behavior/architecture/UX:

```text
perform a full review again
```

Do not merge merely because the final CI run is green if the fix changed the reviewed product behavior.

### Step 11 — Merge

Merge only when:

```text
review #1 completed
review #2 completed
review findings resolved
full validation executed
full-validation successful
required merge-gate green
PR acceptance criteria satisfied
```

No direct-to-main merge.

### Step 12 — Continue development

After merge:

```text
update local/main state
close/delete old branch as appropriate
select next roadmap unit
create a fresh branch
continue development
```

Do not carry unrelated unfinished work through the merged branch.

## Sequence summary

```text
MAIN
  ↓
NEW BRANCH
  ↓
DEVELOPMENT
  ↓
CHECKPOINT COMMIT + PUSH
  ↓
DRAFT PR
  ↓
REVIEW #1
  ↓
FIXES
  ↓
COMMIT(S)
  ↓
INDEPENDENT REVIEW #2
  ↓
ADD full-ci-approved
  ↓
MARK READY FOR REVIEW
  ↓
FULL TYPECHECK / TEST / LINT / BROWSER / BUILD / CI
  ↓
FAIL? ── yes ─→ FIX → COMMIT → RE-REVIEW → RERUN
  ↓ no
GREEN CI
  ↓
MERGE
  ↓
UPDATE MAIN
  ↓
NEXT BRANCH / NEXT DEVELOPMENT UNIT
```

## PR sizing rule

Prefer a PR that one reviewer can understand as one coherent change.

Do not combine:

```text
new tool
architecture refactor
visual redesign
SEO rewrite
unrelated cleanup
```

unless they are inseparable.

## Review artifacts

For visual work include screenshots at relevant target sizes.

For browser capability work include:

```text
browser tested
capability observed
fallback observed
```

For real hardware behavior, clearly distinguish:

```text
automated/browser validation
```

from:

```text
real-device validation
```

## Validation timing rule

The repository intentionally does **not** use:

```text
full suite after every small edit
```

The full suite is a post-review gate.

This rule optimizes agent workflow cost while preserving a strict pre-merge quality gate.

Targeted debugging during implementation is allowed when necessary, but it does not replace or pre-empt the formal validation stage.

## Review independence

A qualifying required review must inspect the actual PR diff and be performed by:

```text
human reviewer
separate review agent/model
or separate ChatGPT review context acting as reviewer
```

Implementer self-review is encouraged as hygiene but does not count toward Review #1 or Review #2.

Record review findings durably in the PR conversation or equivalent review artifact.

## Merge strategy

Default:

```text
squash merge
```

Rationale:

- checkpoint commit exists only to make the early Draft PR possible;
- review-fix commits remain visible during review;
- `main` receives one coherent roadmap-unit commit.

Do not rebase/squash away review history before review is complete.

## Post-validation changes

If validation causes only a mechanical formatting/config fix, re-review the changed lines.

If validation causes a material change to:

```text
product behavior
architecture
UX
claims
privacy
safety
```

perform another substantive independent review before merge.

## Re-opening the review gate

If a material post-validation fix changes product behavior, architecture, UX, claims, privacy or safety:

```text
convert PR to Draft
remove full-ci-approved
perform independent review
add full-ci-approved only after the new Review #2
mark Ready again
```
