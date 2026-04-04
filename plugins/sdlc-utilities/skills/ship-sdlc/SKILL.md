---
name: ship-sdlc
description: "Use this skill when shipping a feature end-to-end after plan acceptance: executing, committing, reviewing, fixing critical issues, versioning, and opening a PR in one flow. Chains execute-plan-sdlc, commit-sdlc, review-sdlc, received-review-sdlc, version-sdlc, and pr-sdlc with conditional review-fix loop. Arguments: [--auto] [--skip <steps>] [--preset full|balanced|minimal] [--bump patch|minor|major] [--draft] [--dry-run] [--resume] [--init-config]. Triggers on: ship it, ship this, full pipeline, execute to PR, ship feature, run the whole thing."
user-invocable: true
argument-hint: "[--auto] [--skip <steps>] [--preset full|balanced|minimal] [--bump patch|minor|major] [--draft] [--dry-run] [--resume] [--workspace branch|worktree|prompt] [--init-config]"
---

# Ship Pipeline

End-to-end feature shipping: execute plan, commit, review, fix critical issues, version, and open a PR. Chains six sub-skills sequentially with a conditional review-fix loop.

**Announce at start:** "I'm using ship-sdlc (sdlc v{sdlc_version})." — extract the version from the `sdlc:` line in the session-start system-reminder. If no version is in context, omit the parenthetical.

## Step 0 — Plan Mode Check

If the system context contains "Plan mode is active":

1. Announce: "This skill requires write operations (git commit, gh pr create, git tag). Exit plan mode first, then re-invoke `/ship-sdlc`."
2. Stop. Do not proceed to subsequent steps.

---

## Step 1 (CONSUME): Load Config, Parse Flags, Detect Context

### 1a. --init-config handler

If `--init-config` was passed:

**Redirect:** Suggest running `/setup-sdlc` instead for unified configuration. If user insists on `--init-config`, proceed with the existing walkthrough.

1. Read `./config-format.md` and run the interactive walkthrough to collect the user's answers (preset, skip set, bump type, auto, threshold, workspace isolation).
2. Locate and call `ship-init.js` via Bash with the collected answers:
```bash
SCRIPT=$(find ~/.claude/plugins -name "ship-init.js" -path "*/sdlc*/scripts/util/ship-init.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/util/ship-init.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/util/ship-init.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate util/ship-init.js. Is the sdlc plugin installed?" >&2; exit 2; }

INIT_OUTPUT_FILE=$(node "$SCRIPT" --output-file --preset balanced --skip version --bump patch --auto --threshold high --workspace prompt)
EXIT_CODE=$?
echo "INIT_OUTPUT_FILE=$INIT_OUTPUT_FILE"
echo "EXIT_CODE=$EXIT_CODE"
```
3. Parse the output JSON from `$INIT_OUTPUT_FILE`:
   - If `errors` is non-empty, display them and stop.
   - Otherwise display the `created` files list and `config` JSON for user confirmation.
4. Stop. No pipeline execution.

### 1b. Load ship config

**Hook context fast-path:** If the session-start system-reminder contains a `Ship config:` line, note it for display. The prepare script (`skill/ship.js`) remains the authoritative source for config values — the hook line is a user-facing heads-up, not a data source.

Check for ship config via skill/ship.js output (reads from `.sdlc/local.json` → `ship` section, with legacy `.sdlc/ship-config.json` fallback). If found, read and merge. Print loaded config verbosely:
```
Ship config loaded from .sdlc/local.json
  preset: balanced, skip: [version], draft: false, bump: patch
  reviewThreshold: high
```
If not found: `No ship config found — using built-in defaults. Run /setup-sdlc to configure.`

### 1c. Prepare pipeline context

Locate and run `skill/ship.js` with all CLI flags to pre-compute flags, context, and step statuses:
```bash
SCRIPT=$(find ~/.claude/plugins -name "ship.js" -path "*/sdlc*/scripts/skill/ship.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/skill/ship.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/skill/ship.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate skill/ship.js. Is the sdlc plugin installed?" >&2; exit 2; }

PREPARE_OUTPUT_FILE=$(node "$SCRIPT" --output-file --has-plan --auto --skip version --preset balanced --bump patch --workspace branch)
EXIT_CODE=$?
echo "PREPARE_OUTPUT_FILE=$PREPARE_OUTPUT_FILE"
echo "EXIT_CODE=$EXIT_CODE"
```

Parse the output JSON from `$PREPARE_OUTPUT_FILE`. If `errors` is non-empty, display them and stop. The parsed output replaces manual computation in subsequent sub-steps (1d–1g).

**Gitignore warning:** If `context.sdlcGitignored` is `false` in the output, print:
```
⚠ Warning: .sdlc/ is not gitignored. Run --init-config to fix, or manually create .sdlc/.gitignore:
  printf '*\n' > .sdlc/.gitignore
```

### 1d. Parse flags

Print the `flags` object from the `skill/ship.js` output, including the `sources` map showing where each value came from (CLI, config, or default):
```
Flag resolution (from skill/ship.js):
  auto:    true  (source: cli)
  preset:  C     (source: cli, overrides config B)
  skip:    [version]  (source: config)
  bump:    patch (source: default)
  draft:   false (source: default)
```

### 1e. Resume check

**Hook context fast-path:** If the session-start system-reminder contains an `Active pipeline:` line, note the state file path and resume point. When the user does not pass `--resume` explicitly but the hook reported an active pipeline, use this to inform the resume prompt — skip the filesystem scan since the hook already found the state file. The hook context is a session-start snapshot.

Print `resume.found` and `resume.stateFile` from the `skill/ship.js` output. If `resume.found` is `true`, print the state file path and resume point. If `false`, print that no state file was found and the pipeline will start fresh.

Read `./state-format.md` when resuming from a state file.

### 1f. Context detection

Print the `context` object values from the `skill/ship.js` output:
```
Context detection (from skill/ship.js):
  Plan in context:     yes
  Uncommitted changes: 14 files modified
  Current branch:      feat/ship-sdlc
  Default branch:      main
  gh CLI:              authenticated as <user>
  OpenSpec:            not detected
  .sdlc/ gitignored:   yes
```

### 1g. Auto-skip logic

Print each step from the `steps` array in the `skill/ship.js` output with its `status`, `reason`, and `skipSource`:
```
Auto-skip decisions (from skill/ship.js):
  execute: will_run — plan detected in context
  commit:  will_run — uncommitted changes detected
  review:  will_run — not in skip set
  received-review: conditional — depends on review verdict
  commit (fixes): conditional — depends on received-review changes
  version: skipped (auto) — auto-skipped — tags are repo-global
  pr:      will_run — not in skip set
```

The parenthetical after `skipped` reflects the step's `skipSource` field:
- `(cli)` — user passed `--skip` on the command line
- `(config)` — skip set loaded from `.sdlc/local.json`
- `(auto)` — auto-skipped by `computeSteps` logic (e.g., worktree mode)
- `(condition)` — conditional step whose condition was not met

Steps with `skipSource: "none"` are not skipped and show no parenthetical.

The LLM does not compute these statuses — `skill/ship.js` is the source of truth.

---

## Step 2 (PLAN): Build Pipeline Plan

The pipeline table is generated from the `steps` array in the `skill/ship.js` output. Each row maps:
- Step number: array index + 1
- Skill: `step.skill`
- Status: `step.status`
- Args: `step.args`
- Pause: `step.pause ? 'YES' : 'no'`

| Step | Skill | Status | Args | Pause |
|------|-------|--------|------|-------|
| 1 | execute-plan-sdlc | will_run | `--preset balanced` | no |
| 2 | commit-sdlc | will_run | `--auto` | no |
| 3 | review-sdlc | will_run | `--committed` | no |
| 4 | received-review-sdlc | conditional | (if crit/high) | YES |
| 5 | commit-sdlc (fixes) | conditional | `--auto` | no |
| 6 | version-sdlc | skipped | — | — |
| 7 | pr-sdlc | will_run | `--auto --draft` | no |

### --auto Mode Audit

Not all sub-skills support `--auto`. This table is the source of truth:

| Sub-skill | --auto support | Behavior when ship runs with --auto |
|-----------|---------------|--------------------------------------|
| execute-plan-sdlc | No | Forwards `--preset` only. Preset selection prompt is skipped when preset is provided. |
| commit-sdlc | Yes | `--auto` forwarded. Skips commit approval prompt. |
| review-sdlc | No | No interactive prompts to skip — runs fully automatically already. |
| received-review-sdlc | Yes | `--auto` forwarded. Skips consent prompt. Critique gates and verification still run. Only "will fix" items auto-implemented. |
| version-sdlc | Yes | `--auto` forwarded. Skips release plan approval prompt. Pre-condition checks and critique gates still run. |
| pr-sdlc | Yes | `--auto` forwarded. Skips PR approval prompt. |

### Review verdict conditional logic

After review-sdlc completes, parse the conversation for a `Verdict:` line:

**CHANGES REQUESTED** (any critical OR >=3 high):
```
Review verdict: CHANGES REQUESTED (1 critical, 2 high)
  Decision: PAUSING PIPELINE — critical/high issues require your approval
  Invoking received-review-sdlc for interactive fix approval
```
Invoke received-review-sdlc. If it makes changes, run commit-sdlc (step 5).

**APPROVED WITH NOTES** (any high OR >=5 medium):
```
Review verdict: APPROVED WITH NOTES (3 medium, 1 low)
  Decision: CONTINUING — no critical/high issues found
  Deferred findings (3 medium, 1 low) will be shown in pipeline summary
```
If any high findings exist, invoke received-review-sdlc. If only medium/low/info, collect and defer to the summary report.

**APPROVED**:
```
Review verdict: APPROVED
  Decision: CONTINUING — no issues found
```
Skip received-review-sdlc, continue pipeline.

---

## Step 3 (CRITIQUE): Validate Pipeline

Print each validation check:
```
Pipeline validation:
  [pass] gh CLI authenticated
  [pass] Not on default branch (feat/ship-sdlc)
  [pass] 5 of 7 steps will run
  [pass] All skip values recognized
  [pass] Version step supports --auto (release approval prompt skipped in auto mode)
  [warn] If review finds critical/high issues, pipeline will pause for fix approval
```

Validation checks:
- `gh auth status` succeeds
- Current branch is not the default branch (warn if it is — do not block)
- All `--skip` values are recognized step names: `execute`, `commit`, `review`, `version`, `pr`
- At least one step will run
- Flag combinations are coherent (`--bump` without version step → warn)

---

## Step 4 (DO): Present Pipeline and Confirm

### Dry-run mode

If `--dry-run`, display the full pipeline table and stop:
```
Ship Pipeline (dry run)
────────────────────────────────────────────────────────────────
Step  Skill                 Status       Args              Pause?
────────────────────────────────────────────────────────────────
1     execute-plan-sdlc     will run     --preset balanced  no
2     commit-sdlc           will run     --auto            no
3     review-sdlc           will run     --committed       no
4     received-review-sdlc  conditional  (if crit/high)    YES
5     commit-sdlc (fixes)   conditional  --auto            no
6     version-sdlc          skipped      —                 —
7     pr-sdlc               will run     --auto --draft    no
────────────────────────────────────────────────────────────────
Review threshold: critical or high findings trigger fix loop
Interactive pauses: received-review (if triggered)
```

### Auto mode

Display the pipeline table for visibility, then proceed without prompting.

### Interactive mode

Display the pipeline table, then:

Use AskUserQuestion to ask:
> Run this pipeline?

Options:
- **yes** — execute as shown
- **edit** — change skip list, flags, or preset
- **cancel** — stop here

On **edit**: ask what to change, update flags, rebuild the pipeline table, and re-present. Loop until `yes` or `cancel`.

---

## Step 5 (EXECUTE): Run Pipeline Steps Sequentially

### Pre-step validation

Before dispatching each step, read its `status` from the skill/ship.js output:
1. `"will_run"` → dispatch as Agent. No exceptions. This is non-negotiable.
2. `"conditional"` → evaluate the runtime condition (e.g., review verdict). If condition met → dispatch as Agent. If not → print why with the specific condition that was not met.
3. `"skipped"` → print "skipped" with the `reason` and `skipSource` from the script output.

A step with `status: "will_run"` MUST be dispatched as an Agent. The LLM does not have authority to override this status. Printing a skip message for a "will_run" step is a pipeline violation.

### Context budget — agent isolation

Each sub-skill's SKILL.md is 200–550 lines. With the Skill tool, every invocation loads the full SKILL.md into the ship pipeline's context — 2000+ lines across a 7-step pipeline. Agent dispatch eliminates this: each Agent loads SKILL.md in its own context and returns only a structured result (5–10 lines). The ship pipeline's context receives structured data, not sub-skill definitions.

This is why all sub-skills are dispatched as Agents. Do not fall back to the Skill tool — it defeats the isolation and risks context exhaustion in later steps (version, PR).

### Agent dispatch protocol

All pipeline steps use the same dispatch protocol. No branching between simple and complex steps — uniform pattern for every sub-skill.

**Invocation source:** Each step in the skill/ship.js output includes an `invocation` field containing the skill name and computed args. Use `step.invocation` verbatim — do not construct invocations from the examples below.

For each step that will run:

1. **Print verbose progress header** to user:
   ```
   ━━━ Ship Pipeline — Step 2/7: Commit ━━━
     Skill: commit-sdlc
     Args: --auto
     Reason: --auto forwarded from ship --auto mode
   ```

2. **Record step start** via state/ship.js.

3. **Dispatch Agent** with: skill name, args from `step.invocation`, and brief pipeline context (branch, previous step results needed for this step). Agent prompt template:
   ```
   You are executing the <skill-name> skill. Invoke `/<skill-name> <args>` using the Skill tool — this loads the SKILL.md automatically. Return a structured result:
   (1) status — success or failure
   (2) result summary — 2-3 lines
   (3) artifacts — commit hash, tag, PR URL, verdict, etc.
   (4) any warnings or issues encountered
   ```

4. **Receive agent result.** Print result to user:
   ```
     [done] Step 2 complete: a1b2c3d feat(auth): add OAuth2 PKCE flow
     State saved to .sdlc/execution/ship-<branch>-<timestamp>.json
   ```

5. **Record step completion/failure** via state/ship.js.

6. **Use result to determine next step** (e.g., review verdict → received-review decision). Print decision reasoning:
   ```
     Review verdict: APPROVED WITH NOTES (2 medium)
     Decision: CONTINUING — no critical/high issues found
   ```

Ship-sdlc retains full control of: pipeline table display, validation output, step progress headers, result formatting, state persistence messages, verdict-based flow decisions, and the final summary report. The agent only executes the sub-skill and returns structured data — it does not print pipeline-level output.

### Execution loop

**Execute step resume:** When the pipeline is resuming (`--resume` active) and the execute step's status in the ship state file is `in_progress`:
1. Check for `<main-worktree>/.sdlc/execution/execute-<branch>-*.json` (an execute-plan-sdlc state file for the current branch). Resolve `<main-worktree>` via `git worktree list --porcelain` (first `worktree` line).
2. If found, dispatch Agent with args: `"--preset <X> --resume"`
3. If not found, dispatch Agent normally with args: `"--preset <X>"` (execute restarts from scratch)

ship-sdlc does not manage execute-plan-sdlc's state file — execute-plan-sdlc handles its own creation, updates, and cleanup.

**Worktree re-entry on resume:** Check `context.worktree.inLinkedWorktree` from the skill/ship.js output. If true, already in the worktree — proceed normally.

If false (resuming from the main worktree but the pipeline originally ran in a worktree), find the worktree for the resume branch:
```bash
git worktree list --porcelain
```
Match the branch from the ship state file against worktree entries. If found and directory exists, `cd <path>` before continuing. If the worktree directory is gone, warn and fall back to running on the current branch.

Example dispatch sequence (use `step.invocation` for actual args):
- Agent: execute-plan-sdlc, args: `"--preset balanced"`
- Agent: commit-sdlc, args: `"--auto"`
- Agent: review-sdlc, args: `"--committed"`
- Agent: received-review-sdlc, args: `"--auto"` (when `flags.auto`; otherwise no args)
- Agent: version-sdlc, args: `"patch"`
- Agent: pr-sdlc, args: `"--auto --draft"`

### Between execute and commit

execute-plan-sdlc does not stage files. Run `git add -A -- ':!.sdlc/'` with verbose output:
```
Staging changes from execution:
  A  src/middleware/auth.ts
  A  src/middleware/auth.test.ts
  M  src/routes/index.ts
  Total: 14 files staged
  Reason: execute-plan-sdlc creates files but does not stage them. .sdlc/ excluded to prevent committing runtime state.
```

### Between review and received-review

Evaluate the verdict (see Step 2 conditional logic). Print the decision tree. If received-review-sdlc triggers and makes changes, check `git status`:
```
Review fixes applied: 3 files modified
  M  src/middleware/auth.ts
  M  src/routes/index.ts
  M  tests/auth.test.ts
  → Running commit step for review fixes
```
Then invoke commit-sdlc (step 5) for the fix commit.

### Between last commit and version — rebase on default branch

After all commits are done (feature commit + optional review-fix commit), rebase onto the latest default branch to ensure a clean merge:

```bash
git fetch origin <defaultBranch>
```

Check if rebase is needed:
```bash
git merge-base --is-ancestor origin/<defaultBranch> HEAD
```
If main is already an ancestor of HEAD, no rebase needed — print "Already up to date with `<defaultBranch>`" and skip.

Otherwise, attempt rebase:
```bash
git rebase origin/<defaultBranch>
```

**If rebase succeeds:** Print summary and continue.
```
Rebase: clean — <N> commits replayed on origin/<defaultBranch>
```

**If rebase fails (conflicts):** Abort and handle:
```bash
git rebase --abort
```
List conflicting files from the failed output. Then:

**Auto mode:** Stop pipeline, save state for `--resume`. Print:
```
Rebase: CONFLICTS detected with origin/<defaultBranch>
  Conflicting files:
    - src/foo.ts
    - src/bar.ts
  Pipeline paused. Resolve conflicts manually, then --resume.
```

**Interactive mode:** Use AskUserQuestion:
> Rebase onto `<defaultBranch>` has conflicts in <N> files:
> - `src/foo.ts`
> - `src/bar.ts`
>
> 1. **Pause pipeline** — resolve manually, then `--resume`
> 2. **Skip rebase** — create PR with conflicts (GitHub will show merge conflicts)
> 3. **Merge instead** — try `git merge origin/<defaultBranch>` (creates merge commit)

Option 3 fallback: run `git merge origin/<defaultBranch>`. If that also conflicts, abort and fall back to option 1.

Note: in a worktree, all of this is safe — main working tree is untouched.

### State persistence

After each step, update pipeline state via `state/ship.js`. Locate the script:
```bash
SCRIPT=$(find ~/.claude/plugins -name "ship.js" -path "*/sdlc*/scripts/state/ship.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/state/ship.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/state/ship.js"
```

At pipeline start (after Step 1 completes), initialize the state file:
```bash
node "$SCRIPT" init --branch <branch> --flags '<flags JSON>'
```

Before each step: `node "$SCRIPT" start --step <name>`
After each step: `node "$SCRIPT" complete --step <name> --result "<summary>"` (or `skip --step <name> --reason "<reason>"` or `fail --step <name> --error "<error>"`)
Record decisions: `node "$SCRIPT" decide --step <name> --text "<decision>"`
Defer findings: `node "$SCRIPT" defer --severity <s> --file <f> --title "<t>"`

On successful completion: `node "$SCRIPT" cleanup`
On failure: preserve the state file for `--resume`.

---

## Step 6 (REPORT): Pipeline Summary

```
Ship Pipeline Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step  Skill                 Result
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1     execute-plan-sdlc     [done] 8 tasks, 3 waves completed
2     commit-sdlc           [done] a1b2c3d feat(auth): add OAuth2 PKCE
3     review-sdlc           [done] APPROVED WITH NOTES (2 medium)
4     received-review-sdlc  — not triggered (no critical/high)
5     commit-sdlc (fixes)   — not triggered
6     version-sdlc          — skipped (config default)
7     pr-sdlc               [done] https://github.com/.../pull/42
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Decisions log:
  - Preset B selected (from config default)
  - Version step skipped (from config default, bump type: patch)
  - Review found 2 medium issues — below threshold, deferred
  - PR created as draft (from --draft flag)

Deferred review findings (2 medium):
  1. [medium] src/middleware/auth.ts:42 — Consider extracting token validation
  2. [medium] src/routes/index.ts:15 — Missing rate limit on new endpoint
  → Run /received-review-sdlc to address these

State file cleaned up: .sdlc/execution/ship-<branch>-<epoch>.json deleted
```

If OpenSpec was detected in Step 1f, append:
  `→ Run /opsx:verify to validate implementation completeness against the spec`
  `→ Run /opsx:archive to archive the OpenSpec change and sync delta specs`

### Worktree cleanup

Detect if running in a linked worktree:
```bash
main_wt=$(git worktree list --porcelain | head -1 | sed 's/worktree //')
current=$(git rev-parse --show-toplevel)
```
If `$main_wt != $current`, a worktree is active.

**Auto mode:** keep (default). Print path and action:
```
Worktree kept: <current path>
  Branch: <branch name>
  To remove later: cd <main_wt> && git worktree remove <current>
```

**Interactive mode:** Use AskUserQuestion — keep or remove.
If remove: `cd "$main_wt" && git worktree remove "$current"`

If `git worktree remove` fails, warn but don't fail the pipeline.

### Post-pipeline advisory (when version was auto-skipped)

If the version step status is `skipped` and the reason contains "worktree", print a next-step hint after the summary table:

```
Note: Version step was skipped (worktree mode — tags are repo-global).
After merging this PR, run on main:
  /version-sdlc <patch|minor|major>
This will tag the release and generate the changelog from all merged commits.
```

---

## Error Recovery

> **Flow**: detect → diagnose → auto-recover (retry once if transient) → escalate to user for persistent failures.

| Error | Recovery | Invoke error-report-sdlc? |
|-------|----------|---------------------------|
| Sub-skill fails (script crash) | Show error from sub-skill, stop pipeline, save state for `--resume` | Delegated — sub-skill handles its own error reporting |
| `gh auth status` fails | Stop at validation (Step 3). Tell user to run `gh auth login` | No — user setup |
| `git add -A -- ':!.sdlc/'` fails | Show error, stop pipeline | No — user action needed |
| Network error (gh API) | Auto-retry via `retryExec` (3 attempts with exponential backoff). If exhausted, record failure + print resume instruction (see below) | No — transient |
| State file write fails | Warn and continue — state persistence is best-effort | No |
| Resume state file corrupt | Warn, start fresh | No |
| Review verdict unparseable | Treat as APPROVED WITH NOTES, warn user, defer all findings | No |
| Sub-skill times out | Stop pipeline, save state, inform user to `--resume` | No — transient |

**Resume instruction format** (printed on step failure after retries exhausted or on any unrecoverable step error):
```
Step <N> (<name>) failed: <error summary>
State saved to: <state file path>
To resume: /ship-sdlc --resume
```

Each sub-skill has its own error recovery. ship-sdlc does not duplicate their recovery logic — it catches pipeline-level failures (sequencing, state, context) and delegates skill-level failures to the skill itself.

---

## DO NOT

- Invoke sub-skills via the Skill tool — all sub-skills are dispatched as Agents. Agent dispatch keeps sub-skill SKILL.md out of the ship pipeline's context.
- Skip the critique step (Step 3) even when all checks seem obvious
- Forward `--auto` to sub-skills that do not support it (see audit table)
- Automatically resolve review findings — received-review-sdlc is always interactive
- Run pipeline steps in parallel — the pipeline is strictly sequential
- Delete the state file on failure — it is needed for `--resume`
- Proceed past a failed sub-skill — stop, save state, inform user
- Skip pipeline steps that were marked "will run" in the pipeline plan. The pipeline plan is a contract with the user. If a step was planned to run and the user confirmed the pipeline, it MUST run. The LLM does not have authority to skip planned steps based on its own assessment of change complexity or risk. Only the skip set and auto-skip rules (computed by skill/ship.js) control which steps run.
- Copy example args from this document when dispatching sub-skill Agents — use the `invocation` field from the skill/ship.js output, which contains the exact computed args
- Add `--skip` flags not present in the user's original invocation or ship config. The skip set is user/config-controlled. If skill/ship.js output shows `skipSource` as unexpected (e.g., `flags.skip.length > 0` but `flagSources.skip === 'default'`), warn before proceeding.

---

## Gotchas

**Staging gap after execute.** execute-plan-sdlc creates and modifies files but does not stage them. ship-sdlc must run `git add -A -- ':!.sdlc/'` between execute and commit. Missing this produces an empty commit.

**Verdict detection is text-based.** Parse the conversation for a line matching `Verdict: <VERDICT>`. The review-sdlc orchestrator always emits this. If the conversation is compacted between review and verdict parsing, the verdict may be lost — treat missing verdict as APPROVED WITH NOTES and warn the user.

**received-review-sdlc supports `--auto`.** When `--auto` is forwarded, the consent prompt (Step 10) is skipped and only "will fix" items are auto-implemented. "Disagree" and "won't fix" items are displayed but not auto-actioned. Critique gates and verification still run. Without `--auto`, the pipeline pauses for human approval.

**Double commit is intentional.** Feature commit (step 2) and review fix commit (step 5) are separate. This keeps feature work and review fixes distinct in git history. Do not squash them.

**Version consent gate.** version-sdlc supports `--auto`. When forwarded, the release plan approval prompt is skipped but the plan is still displayed. Pre-condition checks (Steps 6–7) and critique gates (Steps 3–4) still run.

**Config file is optional.** The pipeline runs with built-in defaults when no ship config exists in `.sdlc/local.json`. Do not error on missing config.

**Skip set validation matters.** Unrecognized values in `--skip` (e.g., `--skip reviw`) should warn, not silently ignore. Typos in skip values cause steps to run when the user expected them skipped.

**.sdlc/ must be gitignored.** The `.sdlc/` directory contains developer-local config (`local.json`) and ephemeral pipeline state (`execution/`). `--init-config` creates `.sdlc/.gitignore` automatically via `ship-init.js`. If `.sdlc/` is not gitignored, the staging command (`git add -A -- ':!.sdlc/'`) provides a fallback exclusion, but the gitignore is the primary defense.

**Pipeline plan is binding.** The pipeline table displayed in Step 4 and confirmed by the user is a contract. Step statuses (`will_run`, `skipped`, `conditional`) are computed by `skill/ship.js` — the LLM follows them, it does not override them. Steps with `status: "will_run"` must be dispatched as Agents. This was added after an incident where the review step was skipped because the LLM judged the changes to be "just docs/config" (issue #68). The pipeline's value is precisely in catching cases where the developer thinks changes are low-risk but the review disagrees.

**State files are script-managed.** Use state/ship.js / state/execute.js for all state operations. Don't hand-write JSON to `.sdlc/execution/`.

**Worktree lifecycle uses git commands.** `git worktree add` to create (via util/worktree-create.js), `git worktree remove` to clean up. No EnterWorktree/ExitWorktree. No session-scoping issues.

**Worktree state is not persisted.** Git is the source of truth. Branch name + `git worktree list --porcelain` = worktree path. No worktree fields in state files.

**Resume re-enters via `cd`.** Match branch from state file against `git worktree list --porcelain`.

**Rebase happens after all commits, before version.** This ensures the tag is placed on a commit that can merge cleanly. If rebase conflicts, the pipeline pauses — the user resolves in the worktree (main tree untouched) and resumes.

**Rebase is skipped when main is already an ancestor.** `git merge-base --is-ancestor` is a fast check. No fetch + rebase overhead when the branch is already up to date.

**Version step is auto-skipped in worktree mode.** `computeSteps` in skill/ship.js skips the version step when `workspace === 'worktree'`. Tags are repo-global — creating them from an isolated worktree risks collisions with parallel pipelines. The pipeline prints a post-merge advisory: run `/version-sdlc` on main after the PR merges. This also handles changelog — `version-sdlc` generates changelog from `previousTag..HEAD`, capturing all commits from all merged branches regardless of their source worktree.

**Worktree PRs auto-label `skip-version-check`.** When `workspace === 'worktree'` causes the version step to be auto-skipped, `skill/ship.js` adds `--label skip-version-check` to the PR step args. The label is included in `gh pr create` from the start (not added post-creation), so `check-version-bump.yml` sees it on the `opened` event. Only fires for worktree auto-skip, not manual `--skip version`. Prerequisite: the label must exist in the repository (pr-sdlc creates it automatically if missing).

**Auto mode does not auto-resume without --resume.** When `--auto` is set but `--resume` is not, the pipeline starts fresh even if a state file exists for the current branch. This prevents accidental continuation from stale state. The state file is preserved (not deleted) so the user can explicitly `--resume` later.

**Sub-skill loading and agent isolation.** Each sub-skill's SKILL.md is 200–550 lines. Agent dispatch is the primary mitigation: each Agent loads SKILL.md in its own context and returns only a structured result (5–10 lines). The ship pipeline's context receives structured data, not sub-skill definitions. Without agent dispatch, the Skill tool would load all definitions into the pipeline's context (2000+ lines), degrading context quality in later steps (version, PR) and increasing the risk of hallucination or skipped logic.

**skipSource tracks provenance.** Each step's `skipSource` field records why a step was skipped: `"none"` (not skipped), `"cli"` (user `--skip` flag), `"config"` (from `.sdlc/local.json`), `"auto"` (auto-skipped by `computeSteps` logic), `"condition"` (conditional step not triggered), `"default"` (skip source unresolved — likely fabricated). If a step has `skipSource: "default"`, the fabrication guard in `runValidation` fires a warning. The per-step `skipSource` and the fabrication guard are complementary: `skipSource` makes the issue visible per step, the guard makes it visible at the pipeline level.

---

## Learning Capture

After completing the pipeline, append to `.claude/learnings/log.md`:

- Review verdicts that surprised (threshold too aggressive or too lenient)
- Sub-skills that failed in unexpected ways during chaining
- Config combinations that produced unintended pipeline shapes
- Projects where the default skip/preset behavior was wrong

Format:
```
## YYYY-MM-DD — ship-sdlc: <brief summary>
<what was learned>
```

---

## What's Next

After the pipeline completes, common follow-ups include:
- `/received-review-sdlc` — address deferred medium/low findings
- `/opsx:verify` — validate implementation against OpenSpec (if detected)
- `/opsx:archive` — archive the OpenSpec change and sync delta specs (if detected)

---

## See Also

- [`/execute-plan-sdlc`](../execute-plan-sdlc/SKILL.md) — plan execution with wave-based dispatch
- [`/commit-sdlc`](../commit-sdlc/SKILL.md) — smart commit with style detection
- [`/review-sdlc`](../review-sdlc/SKILL.md) — multi-dimension code review
- [`/received-review-sdlc`](../received-review-sdlc/SKILL.md) — process and fix review findings
- [`/version-sdlc`](../version-sdlc/SKILL.md) — semantic versioning and release tags
- [`/pr-sdlc`](../pr-sdlc/SKILL.md) — pull request creation
