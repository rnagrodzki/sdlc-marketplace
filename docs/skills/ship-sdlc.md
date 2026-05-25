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
/ship-sdlc [--auto] [--steps <csv>] [--quality full|balanced|minimal] [--bump patch|minor|major|<label>] [--draft] [--dry-run] [--resume] [--init-config] [--gc] [--ttl-days <N>]
```

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--auto` | Non-interactive mode. Forwards `--auto` to sub-skills that support it (commit-sdlc, version-sdlc, pr-sdlc). Pipeline still pauses at received-review-sdlc (intentionally interactive). | Off |
| `--steps <csv>` | Comma-separated list of steps to run, fully replacing the resolved step list. Valid values: `execute`, `commit`, `review`, `version`, `archive-openspec`, `pr`, `verify-pipeline` (opt-in), `await-remote-review` (opt-in), `learnings-commit`. The single source of truth for pipeline composition is `ship.steps[]` in `.sdlc/local.json`; CLI `--steps` is a one-shot override. | From config or built-in defaults |
| `--quick` | Run the project's quick step profile (`ship.quick` in `.sdlc/local.json`) instead of `ship.steps[]`. Useful for fast local iterations (e.g. execute+commit+pr without review or versioning). Mutually exclusive with `--steps` (R-quick-5). Requires `ship.quick` to be configured (R-quick-6). | Off |
| `--quality <full\|balanced\|minimal>` | Forwarded to execute-plan-sdlc as `--quality` (model tier). Only forwarded when the user explicitly passes `--quality` to ship; otherwise execute-plan-sdlc applies its own selection. (Renamed from `--preset` in #190 to disambiguate from `--steps`.) | Not forwarded |
| `--bump patch\|minor\|major\|<label>` | Version bump type forwarded to version-sdlc. The `<label>` form (e.g. `--bump rc`, `--bump beta`) is forwarded verbatim and interpreted by version-sdlc as `--bump patch --pre <label>`. Labels must match `^[a-z][a-z0-9]*$` (lowercase, start with a letter, alphanumeric). Example: `ship-sdlc --bump rc` produces a `1.2.4-rc.1` style release. | `patch` (or `version.preRelease` from `.sdlc/config.json` when set and no CLI `--bump` is passed — see R63) |
| `--draft` | Create the PR as a draft. | Off |
| `--dry-run` | Display the full pipeline plan and stop. No steps are executed. | Off |
| `--resume` | Resume from the most recent state file for the current branch. Completed steps are skipped; in-progress steps are retried. | Off |
| `--init-config` | Launch interactive config creation for `.sdlc/local.json`, then stop. No pipeline execution. | Off |
| `--workspace branch\|worktree\|prompt` | Workspace isolation mode forwarded to execute-plan-sdlc. `branch` creates a feature branch, `worktree` creates a git worktree, `prompt` asks interactively. Default value comes from `ship.workspace` in `.sdlc/local.json` via config fallback — the SKILL.md example no longer hardcodes `--workspace branch` (fixes #371). In worktree mode, the version step is auto-skipped (tags are repo-global) and `--label skip-version-check` is added to the PR step to bypass the CI version check. | From `ship.workspace` config or `"prompt"` |
| `--branch` | Shortcut for `--workspace branch`. Mutually exclusive with `--workspace` and `--tree`. | — |
| `--tree` | Shortcut for `--workspace worktree`. Mutually exclusive with `--workspace` and `--branch`. | — |
| `--openspec-change <name>` | Explicitly select the OpenSpec change to archive, overriding branch-name matching. Used when the branch name does not match the change directory name. | — |
| `--gc` | Prune stale ship- and execute- state files from `.sdlc/execution/`, then stop without running the pipeline. A file is pruned only when it is older than the TTL AND its branch is no longer in `git branch --list`. Fixes orphan accumulation from interrupted runs (issue #223). | Off |
| `--ttl-days <N>` | TTL in days used by `--gc` and the terminal cleanup step. Files newer than this are kept regardless of branch existence (in-flight pipelines on detached HEAD or freshly-deleted branches must not be wiped). Configurable via `state.gc.ttlDays` in `.sdlc/config.json`; CLI overrides config. | `7` (or `state.gc.ttlDays`) |
| `--plan-file <path>` | Explicit path to the active plan markdown; overrides the `plansDirectory` scan. Forwarded verbatim to execute-plan-sdlc as `--plan-file` so plan discovery is stable across compaction. Useful when multiple plan files exist or when the auto-scan would pick the wrong file. | auto (plansDirectory scan) |

To enable post-PR CI verification, add `verify-pipeline` to `ship.steps` in `.sdlc/local.json` (or pass it via `--steps`). To await an automated reviewer's verdict, add `await-remote-review`. See R41 / R50 in `docs/specs/ship-sdlc.md`.


**Removed (#190 hard-remove):** `--preset` and `--skip` are no longer accepted. Passing either produces an error pointing at `--steps <csv>` (for step composition) and `--quality <full|balanced|minimal>` (for the execute-plan-sdlc model tier). Legacy on-disk v1 configs (`ship.preset`/`ship.skip`) are still auto-migrated to v2 by `lib/config.js`.

To omit the `archive-openspec` step from a single run: `--steps <csv>` listing the desired steps without `archive-openspec`. Or omit it from `ship.steps[]` in `.sdlc/local.json` for a persistent change.

---

## How the Pipeline Works

The pipeline runs 8 steps sequentially. Two steps are conditional on the review verdict, and two steps pause even in `--auto` mode because they require human sign-off. The final step (`learnings-commit`) is a no-op when no learnings were captured this run.

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
                       [verify-pipeline ∈ steps[]?]
                                     |
                                     v
                                Step 5g-i:    (opt-in, R41-R49)
                                verify-pipeline
                                (poll gh pr checks;
                                 on failure: AskUserQuestion
                                 or dispatch
                                 verify-pipeline-sdlc
                                 under --auto)
                                     |
                       [await-remote-review ∈ steps[]?]
                                     |
                                     v
                                Step 5g-ii:   (opt-in, R50-R56)
                                await-remote-review
                                (poll for Copilot/etc
                                 review; on actionable
                                 dispatch
                                 received-review-sdlc)
                                     |
                                     v
                                Step 5h:
                                learnings-commit
                                (inline shell —
                                 no-op if log unchanged)
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
- **Workspace isolation ownership (R60, fixes #378, #379)**: ship-sdlc owns the full workspace-isolation lifecycle under both `--workspace branch` and `--workspace worktree` — implements spec I8. Before dispatching execute-plan-sdlc, ship-sdlc's main context runs the same five-step skeleton in both modes: (1) derive branch name from the plan title via `lib/branch-name.js` driven by `workspace.branch` config; (2) run ship state migration (`state/ship.js migrate --from <oldSlug> --to <newName>`) **before** creating the branch — critical because `state/ship.js read` must still resolve the OLD slug filename at migration time (load-bearing ordering); (3) create the branch — `git checkout -b` for branch mode, `util/worktree-create.js` for worktree mode; (4) `cd <worktreePath>` for worktree mode only (Bash cwd persists; all downstream Agent dispatches inherit it automatically); (5) dispatch execute-plan-sdlc with `--branch <name>` so it skips its own workspace-isolation block. Branch-mode and worktree-mode follow an identical skeleton — the only difference is step (3) and the worktree-only `cd` in step (4). Under `--workspace continue` (non-default branch only), all five steps are skipped and no `--branch` flag is passed. (Fixes #378, #379.)
- **Staging gap**: execute-plan-sdlc creates files but does not stage them. The pipeline runs `git add -A -- ':!.sdlc/'` between execute and commit, excluding the `.sdlc/` runtime directory.
- **Pipeline plan is binding**: Steps marked "will run" in the pipeline table must execute. Step statuses are computed by `ship-prepare.js` — the LLM follows them mechanically and cannot unilaterally skip planned steps.
- **Per-step dispatch mode**: Each step's `dispatchMode` field (emitted by `ship.js`) controls how it is dispatched. All sub-skills — including `execute-plan-sdlc` — use `dispatchMode: 'agent'` (per spec requirement `R-execute-agent-dispatch`): each is dispatched as an Agent so it loads its SKILL.md in its own context and returns only a structured result (status, summary, artifacts) to ship's main-context loop. `execute-plan-sdlc` returns a Step-9-formatted result (waves completed, files modified, state file path) so ship can drive R37 branch migration, the staging window, and remaining steps after execute completes. Inline-Bash steps (`archive-openspec`, `learnings-commit`, `cleanup`) use `dispatchMode: null` and run directly in main context. This architecture maintains context isolation for every leaf sub-skill while preserving pipeline continuity in ship's orchestrator (fixes #366; reverts the #353 dispatch exception).
- **Skip provenance (`skipSource`)**: Each step in the `ship-prepare.js` output includes a `skipSource` field tracking why it was skipped: `"none"` (not skipped), `"cli"` (omitted from CLI `--steps`), `"config"` (omitted from `ship.steps[]` in `.sdlc/local.json`), `"auto"` (workspace rule), `"condition"` (precondition unmet), or `"default"` (excluded by built-in defaults).
- **Review threshold**: The severity that triggers the fix loop is configurable via `reviewThreshold` in config (default: `high`). Allowed values: `critical`, `high`, `medium`, `low`. Mapping:
  - `critical` → trigger on any critical finding
  - `high` → trigger on any critical OR high finding
  - `medium` → trigger on any critical, high, OR medium finding
  - `low` → trigger on any finding except `info`

  Findings below the threshold are deferred to the pipeline summary.

  **Correlation with `receivedReview.alwaysFixSeverities`:** These two settings must be aligned. `reviewThreshold` gates whether `received-review-sdlc` is dispatched at all; `alwaysFixSeverities` controls what gets auto-implemented once it is running. Setting `alwaysFixSeverities: ["critical","high","medium","low"]` while keeping `reviewThreshold: "high"` has no effect on medium/low findings — the fix loop never starts. Set `reviewThreshold` to the lowest severity in your `alwaysFixSeverities` list (e.g. `"low"`) so the two values are consistent.

---

## What Gets Printed

### Task tray (Claude Code progress UI)

ship-sdlc surfaces live pipeline progress in the Claude Code task tray by
issuing TodoWrite calls from the MAIN thread of `SKILL.md`. You'll see one
todo per substep, transitioning `pending → in_progress → completed` as the
pipeline advances:

- **commit** — stash unstaged, generate message, commit, restore stash
- **review** — dispatch review dimensions, collect verdicts
- **execute** — one todo per plan task (mirrors the plan you accepted)
- **pr** — push branch, draft body, `gh pr create`, apply labels
- (other steps emit their own substep todos; see `R-todowrite-visibility` in `docs/specs/ship-sdlc.md`)

Each TodoWrite call is also paired with a stdout marker in the form:

```
[task-tray] step commit: pending=12, in_progress=1, completed=4
```

This marker is a stdout audit trail when the tray is collapsed or running
non-interactively. On `--resume`, the tray is reconstructed from the
persistent state file — completed steps appear `completed`, the resume target
appears `in_progress`/`pending`. On step failure, in_progress todos for the
failed step are closed with an `" (failed)"` `activeForm` suffix (no todo
lingers in_progress).

The existing verbose progress headers (`━━━ Ship Pipeline — Step 2/7: Commit ━━━`),
the pipeline table, and the final summary are **unchanged** — the tray is
additive.

The pipeline prints every decision and state change. Here is a realistic full output for a run with `--auto --quality balanced`:

```
I'm using the ship-sdlc skill.

Ship config loaded from .sdlc/local.json (schema v2)
  steps: [execute, commit, review, archive-openspec, pr], draft: false, bump: patch
  reviewThreshold: high

Flag resolution (CLI overrides config):
  auto:    true  (from CLI --auto)
  steps:   [execute, commit, review, archive-openspec, pr]  (from config)
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
Review threshold: high (any critical OR high finding triggers fix loop)
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
  - Steps resolved: [execute, commit, review, archive-openspec, pr] (from config; --quality balanced forwarded to execute-plan-sdlc because user passed --quality)
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
/ship-sdlc --dry-run --steps execute,commit,review,archive-openspec,pr
```

Displays the full pipeline table showing which steps will run, which are skipped, and which flags are forwarded. No steps are executed.

### Skip execute and version

```text
/ship-sdlc --steps commit,review,archive-openspec,pr
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

### Post-PR CI verification + Copilot review (interactive)

```text
/ship-sdlc --steps execute,commit,review,archive-openspec,pr,verify-pipeline,await-remote-review,learnings-commit
```

After the PR is opened, ship-sdlc polls `gh pr checks` until CI converges. On failure, it prompts via `AskUserQuestion` (analyze | skip | abort). Once CI is green (or skipped), it polls for a Copilot review and dispatches `received-review-sdlc` on actionable verdicts. The two opt-in steps can also be set persistently in `ship.steps[]` in `.sdlc/local.json`. (R41–R56)

### Post-PR full automation

```text
/ship-sdlc --auto --steps execute,commit,review,archive-openspec,pr,verify-pipeline,await-remote-review,learnings-commit
```

Same flow as above, but on CI failure ship-sdlc dispatches `verify-pipeline-sdlc` (subagent) directly with the failed-check log excerpts; on `fix-applied` verdict, ship-sdlc commits and pushes the fix and re-polls (capped at `verifyPipelineMaxIterations`, default 3). On a Copilot review, ship-sdlc dispatches `received-review-sdlc --auto`. (R46, R47, R52)

### Set up project config

```text
/ship-sdlc --init-config
```

Walks through an interactive questionnaire and writes `.sdlc/local.json`. Does not run the pipeline.

### Run the project's quick profile (R-quick-1, R-quick-2)

First, define a quick profile in `.sdlc/local.json` (or via `--init-config`):

```json
{
  "ship": {
    "steps": ["execute", "commit", "review", "version", "archive-openspec", "pr", "learnings-commit"],
    "quick": ["execute", "commit", "pr"]
  }
}
```

Then invoke:

```text
/ship-sdlc --quick                # runs execute → commit → pr (the quick profile)
/ship-sdlc --quick --dry-run      # preview which steps would run
```

Combining `--quick` with `--steps` is a hard error (R-quick-5):

```text
/ship-sdlc --quick --steps execute,commit   # error: use --quick or --steps, not both
```

If `ship.quick` is absent from config (R-quick-6):

```text
/ship-sdlc --quick   # error: No quick profile defined. Run `ship-sdlc --init-config` to set one.
```

### Prune stale state files (issue #223)

```text
/ship-sdlc --gc
```

Prunes orphaned `ship-*.json` and `execute-*.json` state files in `.sdlc/execution/` whose branches no longer exist (older than 7 days by default). Skips the pipeline entirely. Useful after interrupted runs leave stale state behind.

```text
/ship-sdlc --gc --ttl-days 0
```

Prunes every state file whose branch is absent from `git branch --list`, regardless of age. Files for currently-existing branches are always kept.

---

## Post-execute completeness gate

After `execute-plan-sdlc` returns and before ship-sdlc advances to the commit step, ship-sdlc runs a blocking invariant check: `state/execute.js verify-completeness`. This gate ensures that every task the execute agent was asked to complete is accounted for in the state file before the pipeline moves on.

**What triggers it:**

The gate runs automatically after every successful `execute-plan-sdlc` dispatch. It cannot be skipped.

**Exit outcomes:**

| Exit code | Meaning | Pipeline action |
|-----------|---------|-----------------|
| 0 | All planned task IDs accounted | Pipeline advances to commit |
| 65 | One or more task IDs missing from state | Execute step marked `failed`; pipeline halts |
| 2 | `plannedTaskIds` absent from state (pre-#432 state file or corrupted init), OR `execute.js` script not found | Pipeline halts with structural error |

**What exit 65 looks like:**

```
ERROR: execute-plan-sdlc returned but planned tasks are unaccounted. Pipeline halted.
{"missingIds":["T3","T7"],"totalPlanned":8,"totalAccounted":6}
```

The JSON on stderr names the exact task IDs that did not complete. The execute step is marked `failed` in the pipeline state file.

**What to do:**

- **Exit 65 (missing task IDs):** The execute agent completed but some tasks were not confirmed. Run `/ship-sdlc --resume` — ship resumes from the execute step, and execute-plan-sdlc will retry the unaccounted tasks.
- **Exit 2 (plannedTaskIds missing):** The state file predates issue #432 (or init was interrupted). Start a fresh run without `--resume`; the new init will record `plannedTaskIds` correctly.
- **Exit 2 (script not found):** The plugin installation is incomplete. Reinstall the plugin.

---

## Terminal cleanup

Every ship pipeline run ends with a deterministic `cleanup` step (after `pr`, `archive-openspec`, and `learnings-commit`). The step is added by `skill/ship.js`, is not user-configurable, and runs as a direct Bash invocation of `state/ship.js cleanup-pipeline` (not as an Agent). Behavior:

- **Success path:** validates the pipeline contract (no `pending`/`in_progress` steps), deletes the current run's state file, then sweeps stale ship- and execute- state files older than the TTL whose branch is no longer present.
- **Failure path:** when an earlier step ended in `failed`, the skill invokes the same script with `--force` — the contract check is skipped and the current run's state file is preserved (so `--resume` works), but stale orphans are still pruned.

Listing `cleanup` in `--steps` or `ship.steps[]` produces a validation error. See issue #223 for the rationale.

---

## Configuration

Pipeline behavior is configured via `.sdlc/local.json`. Create it manually or run `/ship-sdlc --init-config` for guided setup.

### Schema versioning

The local config carries a top-level integer `schemaVersion` field. The current schema version is **`4`**. Files lacking `schemaVersion` (or with an older schema version) are auto-migrated by the loader (`lib/config.js::readLocalConfig`) on the next read. Migration:

- Expands legacy `ship.preset` to `ship.steps[]` (full → all six, balanced → all except `version`, minimal → `[execute, commit, pr]`).
- Subtracts legacy `ship.skip[]` members from the expanded steps.
- Drops `ship.preset` and `ship.skip`; writes `schemaVersion: 4` at the top level.
- Emits a single stderr deprecation notice on first migration; subsequent reads are silent.

To migrate explicitly, run `/setup-sdlc --migrate`.

### Config fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `schemaVersion` (top-level) | `4` | `4` | Schema version literal. New configs MUST include `schemaVersion: 4`. Legacy configs are auto-migrated on read. |
| `steps` | `string[]` | `["execute","commit","review","version","archive-openspec","pr","learnings-commit"]` | Pipeline steps to run. Allowed values: `execute`, `commit`, `review`, `version`, `archive-openspec`, `pr`, `learnings-commit`. Replaces legacy `preset` / `skip`. |
| `quick` | `string[]` | unset | Optional shortened step list activated by `--quick`. Same allowed values as `steps`. Unset means `--quick` is unavailable (R-quick-1). |
| `bump` | `"patch"` \| `"minor"` \| `"major"` | `"patch"` | Default version bump type. |
| `draft` | `boolean` | `false` | Create PRs as drafts by default. |
| `auto` | `boolean` | `false` | Run in non-interactive mode by default. |
| `reviewThreshold` | `"critical"` \| `"high"` \| `"medium"` \| `"low"` | `"high"` | Minimum severity that triggers the fix loop. `low` triggers on any finding except `info`. |
| `workspace` | `"branch"` \| `"worktree"` \| `"prompt"` | `"prompt"` | Workspace isolation strategy forwarded to execute-plan-sdlc. |
| `rebase` | `true` \| `false` \| `"prompt"` | `true` | Rebase strategy before execution and versioning. |
| `verifyPipelineTimeout` | `integer` (≥30) | `1200` | Maximum seconds verify-pipeline polls before giving up with a warning. (R57) |
| `verifyPipelineInterval` | `integer` (≥10) | `60` | Seconds between verify-pipeline poll attempts. (R57) |
| `verifyPipelineMaxIterations` | `integer` (1–10) | `3` | Maximum analyze-fix-recheck iterations before verify-pipeline emits a warning and proceeds. (R47, R57) |
| `awaitRemoteReviewTimeout` | `integer` (≥30) | `600` | Maximum seconds await-remote-review polls before giving up with a warning. (R57) |
| `awaitRemoteReviewInterval` | `integer` (≥10) | `60` | Seconds between await-remote-review poll attempts. (R57) |
| `awaitRemoteReviewers` | `string[]` (minItems 1) | `["copilot"]` | Logins (case-insensitive) whose reviews satisfy await-remote-review. When the login is `copilot`, the reviewer must also be a Bot. (R56, R57) |
| `execute.commitWaves` | `boolean` | `false` | Forwards `--commit-waves` to the execute step. When `true`, execute-plan-sdlc commits each wave as `wip(execute): wave N — <titles>` after G9+G11 pass; commit-sdlc then squashes those WIP commits via soft-reset into the final feature commit. User-facing pipeline behavior is unchanged — WIPs accumulate, then squash. (Fixes #392 / R35.) |

### `version.preRelease` implicit `--bump` override (R63)

`version.preRelease` lives in `.sdlc/config.json` (the project-shared `version` section, NOT in `.sdlc/local.json`'s `ship` section). When set to a valid label (e.g. `"rc"`, `"beta"`, matching `^[a-z][a-z0-9]*$`) and the user does NOT pass `--bump` on the CLI, ship-sdlc forwards it as `--bump <label>` to version-sdlc — equivalent to `--bump patch --pre <label>`. An explicit CLI `--bump` (any value, including `patch`) wins over the config value, allowing graduation out of the pre-release train (version-sdlc R16). See `docs/specs/ship-sdlc.md` R63 for the full rule.

### `execute.commitWaves` Forwarding

When `execute.commitWaves: true` in `.sdlc/local.json` → `ship` section, `scripts/skill/ship.js` appends `--commit-waves` to the execute step's `step.invocation`. Resolution is centralized in the prepare script (per `scripts-over-llm-logic` and `flag-coherence-cross-skill` guardrails); SKILL.md cites `step.invocation` verbatim and never reads `config.execute.commitWaves` directly. The execute step then commits per-wave WIPs; the subsequent commit step (commit-sdlc) auto-detects them and squashes via soft-reset to fork-point — the final PR history shows a single feature commit, not the per-wave WIPs.

To opt out for a single run without editing config, the user can omit the field (or set it to `false`). There is no CLI override for ship-sdlc; the user-facing knob is `execute.commitWaves` in `.sdlc/local.json`.

### Branch-verification guard

Ship-sdlc defends against a class of silent failure (#347, #348, #349) where a sub-skill's Agent — through LLM contract violation, hook bypass, or environment drift — lands its git operations on a different branch than the feature branch ship created. Without a guard, release tags can silently land on orphaned commits that never merge to main; the user discovers the problem only after the PR merges and finds main has no version bump.

**How it works:**

`scripts/skill/ship.js` resolves the feature branch at prepare time (from `state.data.branch` in the ship state file, falling back to `git branch --show-current`) and appends `--expected-branch <featureBranch>` to the invocation of every mutating sub-skill step: `commit`, `commit-fixes`, `version`, and `pr`. The resolved branch is also surfaced as `context.expectedBranch` in the prepare output.

Each sub-skill's prepare script (`skill/commit.js`, `skill/version.js`, `skill/pr.js`) validates the flag via `lib/branch-guard.js::validateExpectedBranch` immediately after resolving git state. On mismatch, the script exits non-zero and the sub-skill halts with:

```
Branch mismatch: expected 'feat/my-feature' but current is 'main'. The pipeline is
configured to operate on 'feat/my-feature'. Refusing to proceed to avoid orphaning
commits on the wrong branch (issues #347, #348, #349).
```

This flag is **internal — set by ship-sdlc** and does not appear in the user-facing invocation. When sub-skills are invoked standalone (outside ship-sdlc), the flag is absent and the guard is inactive.

**Post-version ancestry check:**

After the version step produces a tag, ship-sdlc additionally verifies the tag is an ancestor of the feature branch via `scripts/util/verify-tag-ancestry.js`. On failure:

```
Pipeline halted: tag v1.2.3 is not an ancestor of feat/my-feature.
Remediation: delete the tag (git push origin :refs/tags/v1.2.3; git tag -d v1.2.3)
and re-run version step on the correct branch.
```

This check is a no-op when the version step was skipped (e.g., `workspace: worktree` mode).

### Migrating legacy configs

If your `.sdlc/local.json` was created before the current schema (used `preset:` and `skip:`), the loader will auto-migrate on the next ship run and emit a one-line deprecation notice. The mapping is:

- `full` (or legacy `A`) → `[execute, commit, review, version, archive-openspec, pr]`
- `balanced` (or legacy `B`) → `[execute, commit, review, archive-openspec, pr]` (omits `version`)
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
  "schemaVersion": 4,
  "ship": {
    "steps": ["execute", "commit", "review", "archive-openspec", "pr"],
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
  "schemaVersion": 4,
  "ship": {
    "steps": ["execute", "commit", "review", "version", "archive-openspec", "pr"],
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
  "schemaVersion": 4,
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
  "schemaVersion": 4,
  "ship": {
    "steps": ["commit", "version", "pr"],
    "auto": true,
    "bump": "patch",
    "draft": true,
    "reviewThreshold": "high"
  }
}
```

**Strict review — surface every finding except `info`:**

For high-stakes branches where any low/medium/high/critical finding should trigger the fix loop.

```json
{
  "$schema": "sdlc-local.schema.json",
  "schemaVersion": 4,
  "ship": {
    "steps": ["execute", "commit", "review", "version", "pr"],
    "auto": false,
    "bump": "patch",
    "draft": false,
    "reviewThreshold": "low"
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

### Auto-resume after `/compact`

When a Claude Code `/compact` occurs mid-pipeline, the `SessionStart` hook emits an **Active pipeline:** reminder. On the next invocation of `/ship-sdlc`, the prepare script detects this reminder and automatically resumes from the last completed step — no `--resume` flag required.

A banner is shown before the pipeline table:
```
Resuming after compaction from step <step-name>.
Completed: <list>.
Pending:   <list>.
```

If the pipeline state file is missing or expired (older than 1 hour), you are prompted to start fresh or provide a state path.

**Manual cleanup:** If a state file is corrupt or you want to start fresh, delete it manually:

```bash
rm .sdlc/execution/ship-<branch>-<timestamp>.json
```

Or delete all state files:

```bash
rm -rf .sdlc/execution/
```

Then run `/ship-sdlc` without `--resume` to start a new pipeline.

### After plan-mode block

When `/ship-sdlc` was invoked in plan mode, a `ship-<slug>-<ts>.json` state file is written with all steps pending and the originally-resolved flags preserved. After exiting plan mode, re-invoke `/ship-sdlc` (no arguments needed). The implicit-resume mechanism (`detectResumeState` → `flags.implicitResume`) picks up the saved state file and resumes from the first pending step, preserving `--bump`, `--steps`, and other flags from the original invocation. (Fixes #400.)

ship-sdlc also removes the intermediate prepare output file (`$PLAN_MODE_OUTPUT_FILE`) after confirming the state file was written — the temp output file is distinct from the persistent state file in `.sdlc/execution/`.

---

## Prerequisites

- **`gh` CLI** — required for PR creation. Must be authenticated (`gh auth login`). The pipeline validates this before execution and stops with a clear error if authentication fails.
- **git** — must be run inside a git repository on a feature branch (not the default branch).
- **Review dimensions** — `.sdlc/review-dimensions/` must contain at least one dimension file for the review step. Run `/setup-sdlc --dimensions` to create them. If review is in the skip set, this is not required.
- **Plan in context** — for the execute step, a plan must be present in the conversation. If no plan is found and execute is not skipped, the step is auto-skipped.
- **Cwd in branch workspace mode** — when `ship.workspace = branch`, invoke ship-sdlc from the main worktree root. Invocations from inside a linked worktree path will abort with a diagnostic (R65, fixes #405).

### Harness Configuration

| Field | Value |
|---|---|
| `argument-hint` | `[--auto] [--steps <csv>] [--quality full\|balanced\|minimal] [--draft] [--dry-run]` |
| Plan mode | Graceful refusal at Step 0; pipeline state saved for auto-resume on next invocation (Fixes #400). |

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
