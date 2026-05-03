# `/ship-sdlc` — Full Pipeline Orchestrator

## Overview

Chains six sub-skills into a single end-to-end shipping pipeline: execute the plan, commit, review, fix critical issues, version, and open a PR. Evaluates review findings against a configurable severity threshold and conditionally triggers a fix loop, keeping feature work and review fixes as separate commits. Persists pipeline state after each step so a crashed run can be resumed from where it left off.

---

## Who Should Use This

This skill is for **expert users working on projects with established quality guardrails**. It trusts your project's automated gates — review dimensions, test suites, commit conventions — to make decisions on your behalf. Weak guardrails produce weak automated reviews, and issues slip through silently.

**Before using `/ship-sdlc`, your project should have:**

- **Review dimensions configured** via `/setup-sdlc --dimensions` — these drive the automated review step. Without dimensions, `/review-sdlc` has nothing to evaluate against.
- **A passing test suite** — the pipeline does not run tests itself. It assumes your CI or pre-commit hooks catch regressions.
- **Commit conventions** — `/commit-sdlc` detects and follows your project's commit style. If you have no conventions, it still works, but the generated messages will be generic.

**If your project isn't there yet:**

- No review dimensions? Start with `/setup-sdlc --dimensions` to scaffold them.
- No commit conventions? `/commit-sdlc` works standalone and will establish a style from your existing history.
- Want to ship a single step? Each sub-skill (`/commit-sdlc`, `/pr-sdlc`, etc.) works independently. `/ship-sdlc` is the orchestrator, not a prerequisite.

**The philosophy:** this skill automates the sequencing and decision-making between steps. It does not replace the quality of each step. A pipeline is only as strong as the review dimensions, test coverage, and conventions behind it.

---

## Usage

```text
/ship-sdlc [--auto] [--steps <csv>] [--quality full|balanced|minimal] [--bump patch|minor|major] [--draft] [--dry-run] [--resume] [--init-config]
```

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--auto` | Non-interactive mode. Forwards `--auto` to sub-skills that support it (commit-sdlc, version-sdlc, pr-sdlc). Pipeline still pauses at received-review-sdlc (intentionally interactive). | Off |
| `--steps <csv>` | Comma-separated list of steps to run, fully replacing the resolved step list. Valid values: `execute`, `commit`, `review`, `version`, `pr`, `archive-openspec`. The single source of truth for pipeline composition is `ship.steps[]` in `.sdlc/local.json`; CLI `--steps` is a one-shot override. | From config or built-in defaults |
| `--quality <full\|balanced\|minimal>` | Forwarded to execute-plan-sdlc as `--quality` (model tier). Only forwarded when the user explicitly passes `--quality` to ship; otherwise execute-plan-sdlc applies its own selection. (Renamed from `--preset` in #190 to disambiguate from `--steps`.) | Not forwarded |
| `--bump patch\|minor\|major` | Version bump type forwarded to version-sdlc. | `patch` |
| `--draft` | Create the PR as a draft. | Off |
| `--dry-run` | Display the full pipeline plan and stop. No steps are executed. | Off |
| `--resume` | Resume from the most recent state file for the current branch. Completed steps are skipped; in-progress steps are retried. | Off |
| `--init-config` | Launch interactive config creation for `.sdlc/local.json`, then stop. No pipeline execution. | Off |
| `--workspace branch\|worktree\|prompt` | Workspace isolation mode forwarded to execute-plan-sdlc. `branch` creates a feature branch, `worktree` creates a git worktree, `prompt` asks interactively. In worktree mode, the version step is auto-skipped (tags are repo-global) and `--label skip-version-check` is added to the PR step to bypass the CI version check. | `prompt` |
| `--openspec-change <name>` | Explicitly select the OpenSpec change to archive, overriding branch-name matching. Used when the branch name does not match the change directory name. | — |


**Removed (#190 hard-remove):** `--preset` and `--skip` are no longer accepted. Passing either produces an error pointing at `--steps <csv>` (for step composition) and `--quality <full|balanced|minimal>` (for the execute-plan-sdlc model tier). Legacy on-disk v1 configs (`ship.preset`/`ship.skip`) are still auto-migrated to v2 by `lib/config.js`.

To omit the `archive-openspec` step from a single run: `--steps <csv>` listing the desired steps without `archive-openspec`. Or omit it from `ship.steps[]` in `.sdlc/local.json` for a persistent change.

---

## How the Pipeline Works

The pipeline runs 7 steps sequentially. Two steps are conditional on the review verdict, and two steps pause even in `--auto` mode because they require human sign-off.

```
                          /ship-sdlc
                              |
                    Step 1: Load Config
                    Parse Flags, Detect Context
                              |
                    Step 2: Build Pipeline Plan
                    (auto-skip logic applied)
                              |
                    Step 3: Validate Pipeline
                    (gh auth, branch checks)
                              |
                    Step 4: Confirm
                    (dry-run stops here)
                              |
               +--------------+--------------+
               |              |              |
           [skipped?]    [skipped?]     [always]
               |              |              |
   +-----------+    +---------+    +---------+
   |                |              |
   v                v              v
Step 5a:       Step 5b:       Step 5c:
execute-       commit-sdlc    review-sdlc
plan-sdlc      (--auto if     (--committed)
(--quality X    auto mode)          |
 if forwarded)                      |
   |                |              |
   | git add -A     |    +---------+---------+
   +------->--------+    |                   |
                         v                   v
                   [critical/high       [medium/low/info
                    findings?]           or no findings]
                         |                   |
                         v                   |
                    Step 5d:                 |
                    received-review-sdlc     |
                    >>> ALWAYS PAUSES <<<    |
                    (human fix approval)     |
                         |                   |
                    [changes made?]          |
                    yes  |  no               |
                         v                   |
                    Step 5e:                 |
                    commit-sdlc              |
                    (fix commit)             |
                         |                   |
                         +----->-----+<------+
                                     |
                                     v
                   [skipped?]   Step 5f:
                        +-----> version-sdlc
                        |       >>> ALWAYS PAUSES <<<
                        |       (release approval)
                        |            |
                        +-----<------+
                                     |
                                     v
                                Step 5g:
                                pr-sdlc
                                (--auto, --draft
                                 if applicable)
                                     |
                                     v
                              Step 6: Summary
                              (decisions log,
                               deferred findings,
                               state file cleanup)
```

**Key points:**

- **Double-commit pattern**: The feature commit (step 5b) and the review fix commit (step 5e) are separate. This keeps feature work and review fixes distinct in git history.
- **One mandatory pause point in `--auto` mode**: received-review-sdlc (automated code changes need human sign-off). version-sdlc skips the release approval prompt when `--auto` is forwarded.
- **Staging gap**: execute-plan-sdlc creates files but does not stage them. The pipeline runs `git add -A -- ':!.sdlc/'` between execute and commit, excluding the `.sdlc/` runtime directory.
- **Pipeline plan is binding**: Steps marked "will run" in the pipeline table must execute. Step statuses are computed by `ship-prepare.js` — the LLM follows them mechanically and cannot unilaterally skip planned steps.
- **Agent-based dispatch**: Sub-skills are dispatched as Agents, not invoked via the Skill tool. Each Agent loads its sub-skill's SKILL.md in its own context and returns only a structured result (status, summary, artifacts). This keeps the ship pipeline's context clean — sub-skill definitions stay in the agent, not the orchestrator.
- **Skip provenance (`skipSource`)**: Each step in the `ship-prepare.js` output includes a `skipSource` field tracking why it was skipped: `"none"` (not skipped), `"cli"` (omitted from CLI `--steps`), `"config"` (omitted from `ship.steps[]` in `.sdlc/local.json`), `"auto"` (workspace rule), `"condition"` (precondition unmet), or `"default"` (excluded by built-in defaults).
- **Review threshold**: The severity that triggers the fix loop is configurable via `reviewThreshold` in config (default: `high`). At `high`, critical and high findings trigger fixes; medium and below are deferred to the summary.

---

## What Gets Printed

The pipeline prints every decision and state change. Here is a realistic full output for a run with `--auto --quality balanced`:

```
I'm using the ship-sdlc skill.

Ship config loaded from .sdlc/local.json (schema v2)
  steps: [execute, commit, review, pr, archive-openspec], draft: false, bump: patch
  reviewThreshold: high

Flag resolution (CLI overrides config):
  auto:    true  (from CLI --auto)
  steps:   [execute, commit, review, pr, archive-openspec]  (from config)
  preset:  balanced  (CLI legacy sugar; expanded to steps before resolution)
  bump:    patch (from config default)
  draft:   false (from built-in default)

Context detection:
  Plan in context:     yes (from conversation)
  Uncommitted changes: 0 files modified
  Current branch:      feat/user-auth
  Default branch:      main
  gh CLI:              authenticated as myuser
  OpenSpec:            not detected

Auto-skip decisions:
  execute: WILL RUN — in steps[]
  commit:  WILL RUN — in steps[] (will check pending after execute)
  review:  WILL RUN — in steps[]
  version: SKIPPED — not in steps[] (from config)
  pr:      WILL RUN — in steps[]

Pipeline validation:
  [pass] gh CLI authenticated
  [pass] Not on default branch (feat/user-auth)
  [pass] 4 of 7 steps will run
  [pass] All skip values recognized
  [warn] If review finds critical/high issues, pipeline will pause for fix approval

Ship Pipeline
--------------------------------------------------------------------
Step  Skill                 Status       Args           Pause?
--------------------------------------------------------------------
1     execute-plan-sdlc     will run     --quality balanced no
2     commit-sdlc           will run     --auto         no
3     review-sdlc           will run     --committed    no
4     received-review-sdlc  conditional  (if crit/high) YES
5     commit-sdlc (fixes)   conditional  --auto         no
6     version-sdlc          skipped      ---            ---
7     pr-sdlc               will run     --auto         no
--------------------------------------------------------------------
Review threshold: critical or high findings trigger fix loop
Interactive pauses: received-review (if triggered)

Auto mode — proceeding without confirmation.

━━━ Ship Pipeline — Step 1/7: Execute ━━━
  Invoking: /execute-plan-sdlc --quality balanced
  Reason: plan detected in context, preset balanced from config
  Expectation: execute all plan tasks in waves

  [done] Step 1 complete: 6 tasks, 2 waves completed
  State saved to .sdlc/execution/ship-feat-user-auth-20260327T143000Z.json

Staging changes from execution:
  A  src/auth/oauth.ts
  A  src/auth/oauth.test.ts
  A  src/middleware/session.ts
  M  src/routes/index.ts
  M  src/config.ts
  M  package.json
  Total: 6 files staged
  Reason: execute-plan-sdlc creates files but does not stage them

━━━ Ship Pipeline — Step 2/7: Commit ━━━
  Invoking: /commit-sdlc --auto
  Reason: --auto forwarded from ship --auto mode
  Expectation: stage all changes, generate commit message, commit without approval prompt

  [done] Step 2 complete: a1b2c3d feat(auth): add OAuth2 PKCE flow
  State saved to .sdlc/execution/ship-feat-user-auth-20260327T143000Z.json

━━━ Ship Pipeline — Step 3/7: Review ━━━
  Invoking: /review-sdlc --committed
  Reason: reviewing committed changes on branch
  Expectation: load review dimensions, dispatch review agents, produce verdict

  [done] Step 3 complete: APPROVED WITH NOTES (2 medium, 1 low)
  State saved to .sdlc/execution/ship-feat-user-auth-20260327T143000Z.json

Review verdict: APPROVED WITH NOTES (2 medium, 1 low)
  Decision: CONTINUING — no critical/high issues found
  Deferred findings (2 medium, 1 low) will be shown in pipeline summary

━━━ Ship Pipeline — Step 4/7: Received Review ━━━
  Status: not triggered (no critical/high findings)

━━━ Ship Pipeline — Step 5/7: Commit Fixes ━━━
  Status: not triggered (no review fixes applied)

━━━ Ship Pipeline — Step 6/7: Version ━━━
  Status: skipped (not in steps[] from config)

━━━ Ship Pipeline — Step 7/7: PR ━━━
  Invoking: /pr-sdlc --auto
  Reason: --auto forwarded from ship --auto mode
  Expectation: generate PR description, create PR without approval prompt

  [done] Step 7 complete: https://github.com/myuser/myrepo/pull/42
  State saved to .sdlc/execution/ship-feat-user-auth-20260327T143000Z.json

Ship Pipeline Complete
================================================================
Step  Skill                 Result
================================================================
1     execute-plan-sdlc     [done] 6 tasks, 2 waves completed
2     commit-sdlc           [done] a1b2c3d feat(auth): add OAuth2 PKCE
3     review-sdlc           [done] APPROVED WITH NOTES (2 medium, 1 low)
4     received-review-sdlc  --- not triggered (no critical/high)
5     commit-sdlc (fixes)   --- not triggered
6     version-sdlc          --- skipped (config default)
7     pr-sdlc               [done] https://github.com/myuser/myrepo/pull/42
================================================================

Decisions log:
  - Steps resolved: [execute, commit, review, pr, archive-openspec] (from config; --quality balanced forwarded to execute-plan-sdlc because user passed --quality)
  - Version step skipped (from config default, bump type: patch)
  - Review found 2 medium, 1 low issues — below threshold, deferred
  - PR created (from --auto flag)

Deferred review findings (2 medium, 1 low):
  1. [medium] src/auth/oauth.ts:42 — Consider extracting token validation to a shared utility
  2. [medium] src/middleware/session.ts:18 — Missing rate limit on new session endpoint
  3. [low] src/config.ts:7 — Magic number for token expiry; extract to named constant
  -> Run /received-review-sdlc to address these

State file cleaned up: .sdlc/execution/ship-feat-user-auth-20260327T143000Z.json deleted
```

---

## Examples

### Basic usage (interactive)

```text
/ship-sdlc
```

Loads config (if present), detects context, presents the pipeline plan, and asks for confirmation before each major step.

### Full auto mode with preset

```text
/ship-sdlc --auto --quality minimal
```

Runs the quality preset with no confirmation prompts except at received-review-sdlc (if triggered) and version-sdlc.

### Dry run to preview the pipeline

```text
/ship-sdlc --dry-run --steps execute,commit,review,pr,archive-openspec
```

Displays the full pipeline table showing which steps will run, which are skipped, and which flags are forwarded. No steps are executed.

### Skip execute and version

```text
/ship-sdlc --steps commit,review,pr,archive-openspec
```

Useful when you've already implemented the changes manually and want to commit, review, and open a PR.

### Draft PR with auto mode

```text
/ship-sdlc --auto --draft
```

Ships end-to-end and opens the PR as a draft for team review.

### Resume after a failure

```text
/ship-sdlc --resume
```

Finds the most recent state file for the current branch, skips completed steps, and retries from the point of failure.

### Set up project config

```text
/ship-sdlc --init-config
```

Walks through an interactive questionnaire and writes `.sdlc/local.json`. Does not run the pipeline.

---

## Configuration

Pipeline behavior is configured via `.sdlc/local.json`. Create it manually or run `/ship-sdlc --init-config` for guided setup.

### Schema versioning

The local config carries a top-level integer `version` field. The current schema version is **`2`**. Files lacking `version` (or with `version < 2`) are auto-migrated by the loader (`lib/config.js::readLocalConfig`) on the next read. Migration:

- Expands legacy `ship.preset` to `ship.steps[]` (full → all six, balanced → all except `version`, minimal → `[execute, commit, pr]`).
- Subtracts legacy `ship.skip[]` members from the expanded steps.
- Drops `ship.preset` and `ship.skip`; writes `version: 2` at the top level.
- Emits a single stderr deprecation notice on first migration; subsequent reads are silent.

To migrate explicitly, run `/setup-sdlc --migrate`.

### Config fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `version` (top-level) | `2` | `2` | Schema version literal. New configs MUST include `version: 2`. Legacy v1 configs are auto-migrated on read. |
| `steps` | `string[]` | `["execute","commit","review","version","pr","archive-openspec"]` | Pipeline steps to run. Allowed values: `execute`, `commit`, `review`, `version`, `pr`, `archive-openspec`. Replaces legacy `preset` / `skip`. |
| `bump` | `"patch"` \| `"minor"` \| `"major"` | `"patch"` | Default version bump type. |
| `draft` | `boolean` | `false` | Create PRs as drafts by default. |
| `auto` | `boolean` | `false` | Run in non-interactive mode by default. |
| `reviewThreshold` | `"critical"` \| `"high"` \| `"medium"` | `"high"` | Minimum severity that triggers the fix loop. |
| `workspace` | `"branch"` \| `"worktree"` \| `"prompt"` | `"prompt"` | Workspace isolation strategy forwarded to execute-plan-sdlc. |
| `rebase` | `true` \| `false` \| `"prompt"` | `true` | Rebase strategy before execution and versioning. |

### Migrating from v1

If your `.sdlc/local.json` was created before SDLC v2 schema (used `preset:` and `skip:`), the loader will auto-migrate on the next ship run and emit a one-line deprecation notice. The mapping is:

- `full` (or legacy `A`) → `[execute, commit, review, version, pr, archive-openspec]`
- `balanced` (or legacy `B`) → `[execute, commit, review, pr, archive-openspec]` (omits `version`)
- `minimal` (or legacy `C`) → `[execute, commit, pr]`

Any legacy `skip[]` entries are subtracted from the expanded set. To trigger the migration explicitly, run `/setup-sdlc --migrate`.

### Merge precedence

```
CLI --steps  >  .sdlc/local.json (ship.steps)  >  built-in defaults

(Legacy CLI sugar `--preset` and `--skip` are hard-removed in #190; passing them produces an error.)
```

### Team-specific examples

**Solo developer — move fast:**

Skip version management, auto-commit, only pause on critical findings.

```json
{
  "$schema": "sdlc-local.schema.json",
  "version": 2,
  "ship": {
    "steps": ["execute", "commit", "review", "pr", "archive-openspec"],
    "auto": true,
    "bump": "patch",
    "draft": false,
    "reviewThreshold": "critical"
  }
}
```

**Team with guardrails — balanced review:**

Full pipeline with high-severity review threshold. PRs open as drafts for team review. Version step runs with manual approval.

```json
{
  "$schema": "sdlc-local.schema.json",
  "version": 2,
  "ship": {
    "steps": ["execute", "commit", "review", "version", "pr", "archive-openspec"],
    "auto": false,
    "bump": "minor",
    "draft": true,
    "reviewThreshold": "high"
  }
}
```

**CI-adjacent — maximum confidence:**

Smallest step set with widest review threshold. Suitable for regulated environments or release branches.

```json
{
  "$schema": "sdlc-local.schema.json",
  "version": 2,
  "ship": {
    "steps": ["execute", "commit", "pr"],
    "auto": false,
    "bump": "patch",
    "draft": false,
    "reviewThreshold": "medium"
  }
}
```

**Quick iteration — skip execute and review:**

For when you've already implemented and reviewed manually, and just need to commit, version, and open a PR.

```json
{
  "$schema": "sdlc-local.schema.json",
  "version": 2,
  "ship": {
    "steps": ["commit", "version", "pr"],
    "auto": true,
    "bump": "patch",
    "draft": true,
    "reviewThreshold": "high"
  }
}
```

---

## Resuming After Failure

When the pipeline fails or is interrupted, the state file is preserved at:

```
.sdlc/execution/ship-<branch>-<timestamp>.json
```

To resume:

```text
/ship-sdlc --resume
```

**What happens on resume:**

1. The skill finds the most recent state file for the current branch (matched by branch name in the filename).
2. Steps with status `completed` or `skipped` are skipped.
3. Steps with status `in_progress` are retried from the beginning.
4. Steps with status `pending` run normally.
5. The same flags from the original run are restored from the state file.

**If multiple state files exist** for the same branch (from multiple failed attempts), the one with the most recent timestamp is used.

**Manual cleanup:** If a state file is corrupt or you want to start fresh, delete it manually:

```bash
rm .sdlc/execution/ship-<branch>-<timestamp>.json
```

Or delete all state files:

```bash
rm -rf .sdlc/execution/
```

Then run `/ship-sdlc` without `--resume` to start a new pipeline.

---

## Prerequisites

- **`gh` CLI** — required for PR creation. Must be authenticated (`gh auth login`). The pipeline validates this before execution and stops with a clear error if authentication fails.
- **git** — must be run inside a git repository on a feature branch (not the default branch).
- **Review dimensions** — `.claude/review-dimensions/` must contain at least one dimension file for the review step. Run `/setup-sdlc --dimensions` to create them. If review is in the skip set, this is not required.
- **Plan in context** — for the execute step, a plan must be present in the conversation. If no plan is found and execute is not skipped, the step is auto-skipped.

### Harness Configuration

| Field | Value |
|---|---|
| `argument-hint` | `[--auto] [--steps <csv>] [--quality full\|balanced\|minimal] [--draft] [--dry-run]` |
| Plan mode | Graceful refusal (Step 0) |

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| `.sdlc/local.json` | Developer-local config. Gitignored by `.sdlc/.gitignore` (created by `--init-config` via `ship-init.js`). |
| `.sdlc/.gitignore` | Internal gitignore that prevents `.sdlc/` contents from being committed. Created by `--init-config` via `ship-init.js`. |
| `.sdlc/execution/ship-*.json` | Pipeline state file. Created at start, deleted on successful completion, retained on failure for `--resume`. |
| Git commits | Feature commit (step 2) and optionally a review fix commit (step 5). |
| Git tag | Created by version-sdlc if the version step runs. |
| GitHub PR | Opened or updated by pr-sdlc as the final step. |
| Step 1 context-heaviness advisory | When the latest transcript stats sidecar at `$TMPDIR/sdlc-context-stats.json` indicates `heavy: true` (transcript ≥60% of model budget), Step 1 emits a `/compact` advisory before the pipeline begins. Sidecar is written by the `UserPromptSubmit` hook `hooks/context-stats.js`. Surfaced through the `contextAdvisory` field of `skill/ship.js` output. Implementation: [`scripts/lib/context-advisory.js`](../../plugins/sdlc-utilities/scripts/lib/context-advisory.js). Pipeline state survives `/compact` (PreCompact + SessionStart hooks). |

---

## Related Skills

- [`/execute-plan-sdlc`](execute-plan-sdlc.md) — plan execution with wave-based parallel dispatch
- [`/commit-sdlc`](commit-sdlc.md) — smart commit with style detection
- [`/review-sdlc`](review-sdlc.md) — multi-dimension code review
- [`/received-review-sdlc`](received-review-sdlc.md) — process and fix review findings
- [`/version-sdlc`](version-sdlc.md) — semantic versioning and release tags
- [`/pr-sdlc`](pr-sdlc.md) — pull request creation
- [`/setup-sdlc`](setup-sdlc.md) — configure review dimensions via `--dimensions` flag

<!--
NOTE: This section is for GitHub markdown browsing only.
On the site (rnagrodzki.github.io/sdlc-marketplace), Related Skills are rendered
as styled SkillCard tiles auto-generated from `site/src/data/skills-meta.ts` connections.
The remark-strip-related-skills plugin removes this section before site rendering.
To add/update related skills on the site, edit the `connections` array in skills-meta.ts.
-->
