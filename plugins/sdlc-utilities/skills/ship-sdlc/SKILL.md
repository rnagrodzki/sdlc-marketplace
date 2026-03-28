---
name: ship-sdlc
description: "Use this skill when shipping a feature end-to-end after plan acceptance: executing, committing, reviewing, fixing critical issues, versioning, and opening a PR in one flow. Chains execute-plan-sdlc, commit-sdlc, review-sdlc, received-review-sdlc, version-sdlc, and pr-sdlc with conditional review-fix loop. Arguments: [--auto] [--skip <steps>] [--preset A|B|C] [--bump patch|minor|major] [--draft] [--dry-run] [--resume] [--init-config]. Triggers on: ship it, ship this, full pipeline, execute to PR, ship feature, run the whole thing."
user-invocable: true
argument-hint: "[--auto] [--skip <steps>] [--preset A|B|C] [--draft] [--dry-run]"
---

# Ship Pipeline

End-to-end feature shipping: execute plan, commit, review, fix critical issues, version, and open a PR. Chains six sub-skills sequentially with a conditional review-fix loop.

**Announce at start:** "I'm using the ship-sdlc skill."

## Step 0 — Plan Mode Check

If the system context contains "Plan mode is active":

1. Announce: "This skill requires write operations (git commit, gh pr create, git tag). Exit plan mode first, then re-invoke `/ship-sdlc`."
2. Stop. Do not proceed to subsequent steps.

---

## Step 1 (CONSUME): Load Config, Parse Flags, Detect Context

### 1a. --init-config handler

If `--init-config` was passed, Read `./config-format.md` and run interactive config creation, then stop. No pipeline execution.

### 1b. Load ship config

Check for `.sdlc/ship-config.json`. If it exists, read and merge. Print loaded config verbosely:
```
Ship config loaded from .sdlc/ship-config.json
  preset: B, skip: [version], draft: false, bump: patch
  reviewThreshold: high
```
If not found: `No ship config found — using built-in defaults. Run --init-config to create one.`

### 1c. Parse flags

Parse: `--auto`, `--skip <csv>`, `--preset A|B|C`, `--bump patch|minor|major`, `--draft`, `--dry-run`, `--resume`. CLI flags override config values. Print the merge result:
```
Flag resolution (CLI overrides config):
  auto:    true  (from CLI --auto)
  preset:  C     (from CLI --preset C, overrides config B)
  skip:    [version]  (from config)
  bump:    patch (from config default)
  draft:   false (from built-in default)
```

### 1d. Resume check

If `--resume`, look for state file in `.sdlc/execution/`. Print what was found and resume point. If not found, warn and start fresh.

Read `./state-format.md` when resuming from a state file.

### 1e. Context detection

Print every check:
```
Context detection:
  Plan in context:     yes (from conversation)
  Uncommitted changes: 14 files modified
  Current branch:      feat/ship-sdlc
  Default branch:      main
  gh CLI:              authenticated as <user>
  OpenSpec:            not detected
```

Run these checks via Bash: `git status --porcelain`, `git branch --show-current`, `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'`, `gh auth status`.

### 1f. Auto-skip logic

Print each decision with reasoning:
```
Auto-skip decisions:
  execute: WILL RUN — plan detected in context
  commit:  WILL RUN — uncommitted changes detected
  review:  WILL RUN — not in skip set
  version: SKIPPED — in skip set (from config)
  pr:      WILL RUN — not in skip set
```

Rules:
- **execute**: skip if no plan in context or conversation, or if `--skip execute`
- **commit**: skip if no uncommitted changes after execute, or if `--skip commit`
- **review**: skip only if `--skip review`
- **received-review**: always conditional on review verdict (never in skip set)
- **version**: skip if `--skip version`
- **pr**: skip only if `--skip pr`

---

## Step 2 (PLAN): Build Pipeline Plan

| Step | Skill | Condition | Args forwarded |
|------|-------|-----------|----------------|
| 1 | execute-plan-sdlc | Plan in context AND not skipped | `--preset <X> [--resume on pipeline resume if execute was in_progress]` |
| 2 | commit-sdlc | Not skipped AND changes exist | `--auto` (when auto) |
| 3 | review-sdlc | Not skipped | `--committed` |
| 4 | received-review-sdlc | Verdict has critical OR high findings | (always interactive) |
| 5 | commit-sdlc (fixes) | received-review made changes | `--auto` (when auto) |
| 6 | version-sdlc | Not skipped | `<bump-type>` (default: patch) |
| 7 | pr-sdlc | Always (unless skipped) | `--auto` (when auto), `--draft` (when draft) |

### --auto Mode Audit

Not all sub-skills support `--auto`. This table is the source of truth:

| Sub-skill | --auto support | Behavior when ship runs with --auto |
|-----------|---------------|--------------------------------------|
| execute-plan-sdlc | No | Forwards `--preset` only. Preset selection prompt is skipped when preset is provided. |
| commit-sdlc | Yes | `--auto` forwarded. Skips commit approval prompt. |
| review-sdlc | No | No interactive prompts to skip — runs fully automatically already. |
| received-review-sdlc | No | Always interactive. Pipeline pauses for human fix approval. Deliberate — automated code changes need sign-off. |
| version-sdlc | No | Always shows release plan for approval. Pipeline pauses. Even with bump type pre-answered, consent gate still fires. |
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
  [warn] Version step will pause for release approval (no --auto support in version-sdlc)
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
1     execute-plan-sdlc     will run     --preset B        no
2     commit-sdlc           will run     --auto            no
3     review-sdlc           will run     --committed       no
4     received-review-sdlc  conditional  (if crit/high)    YES
5     commit-sdlc (fixes)   conditional  --auto            no
6     version-sdlc          skipped      —                 —
7     pr-sdlc               will run     --auto --draft    no
────────────────────────────────────────────────────────────────
Review threshold: critical or high findings trigger fix loop
Interactive pauses: received-review (if triggered), version (if not skipped)
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

### Execution loop

For each step that will run, print verbose progress:
```
━━━ Ship Pipeline — Step 2/7: Commit ━━━
  Invoking: /commit-sdlc --auto
  Reason: --auto forwarded from ship --auto mode
  Expectation: stage all changes, generate commit message, commit without approval prompt
```

Invoke each sub-skill using the Skill tool:
- `skill: "execute-plan-sdlc", args: "--preset B"` (example)

**Execute step resume:** When the pipeline is resuming (`--resume` active) and the execute step's status in the ship state file is `in_progress`:
1. Check for `<main-worktree>/.sdlc/execution/execute-<branch>-*.json` (an execute-plan-sdlc state file for the current branch). Resolve `<main-worktree>` via `git worktree list --porcelain` (first `worktree` line).
2. If found, invoke: `skill: "execute-plan-sdlc", args: "--preset <X> --resume"`
3. If not found, invoke normally: `skill: "execute-plan-sdlc", args: "--preset <X>"` (execute restarts from scratch)

ship-sdlc does not manage execute-plan-sdlc's state file — execute-plan-sdlc handles its own creation, updates, and cleanup.

- `skill: "commit-sdlc", args: "--auto"` (example)
- `skill: "review-sdlc", args: "--committed"` (example)
- `skill: "received-review-sdlc"` (no args — always interactive)
- `skill: "version-sdlc", args: "patch"` (example)
- `skill: "pr-sdlc", args: "--auto --draft"` (example)

After each step, print the result and save state:
```
  [done] Step 2 complete: a1b2c3d feat(auth): add OAuth2 PKCE flow
  State saved to .sdlc/execution/ship-<branch>-<timestamp>.json
```

### Between execute and commit

execute-plan-sdlc does not stage files. Run `git add -A` with verbose output:
```
Staging changes from execution:
  A  src/middleware/auth.ts
  A  src/middleware/auth.test.ts
  M  src/routes/index.ts
  Total: 14 files staged
  Reason: execute-plan-sdlc creates files but does not stage them
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

### State persistence

After each step, write state to `.sdlc/execution/ship-<branch>-<epoch>.json`. Create the directory if needed:
```bash
mkdir -p .sdlc/execution
```

On pipeline completion (success), delete the state file.

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

If OpenSpec was detected in Step 1e, append: `→ Run /opsx:verify to validate implementation completeness against the spec`

---

## Error Recovery

> **Flow**: detect → diagnose → auto-recover (retry once if transient) → escalate to user for persistent failures.

| Error | Recovery | Invoke error-report-sdlc? |
|-------|----------|---------------------------|
| Sub-skill fails (script crash) | Show error from sub-skill, stop pipeline, save state for `--resume` | Delegated — sub-skill handles its own error reporting |
| `gh auth status` fails | Stop at validation (Step 3). Tell user to run `gh auth login` | No — user setup |
| `git add -A` fails | Show error, stop pipeline | No — user action needed |
| State file write fails | Warn and continue — state persistence is best-effort | No |
| Resume state file corrupt | Warn, start fresh | No |
| Review verdict unparseable | Treat as APPROVED WITH NOTES, warn user, defer all findings | No |
| Sub-skill times out | Stop pipeline, save state, inform user to `--resume` | No — transient |

Each sub-skill has its own error recovery. ship-sdlc does not duplicate their recovery logic — it catches pipeline-level failures (sequencing, state, context) and delegates skill-level failures to the skill itself.

---

## DO NOT

- Invoke sub-skills via the Agent tool — use the Skill tool exclusively
- Skip the critique step (Step 3) even when all checks seem obvious
- Forward `--auto` to sub-skills that do not support it (see audit table)
- Automatically resolve review findings — received-review-sdlc is always interactive
- Run pipeline steps in parallel — the pipeline is strictly sequential
- Delete the state file on failure — it is needed for `--resume`
- Proceed past a failed sub-skill — stop, save state, inform user

---

## Gotchas

**Staging gap after execute.** execute-plan-sdlc creates and modifies files but does not stage them. ship-sdlc must run `git add -A` between execute and commit. Missing this produces an empty commit.

**Verdict detection is text-based.** Parse the conversation for a line matching `Verdict: <VERDICT>`. The review-sdlc orchestrator always emits this. If the conversation is compacted between review and verdict parsing, the verdict may be lost — treat missing verdict as APPROVED WITH NOTES and warn the user.

**received-review-sdlc always pauses.** No `--auto` flag exists for it. This is deliberate — automated code changes to fix review findings need human sign-off. The pipeline will pause here even in full `--auto` mode.

**Double commit is intentional.** Feature commit (step 2) and review fix commit (step 5) are separate. This keeps feature work and review fixes distinct in git history. Do not squash them.

**Version consent gate.** version-sdlc has no `--auto` support. Even with `--bump patch` pre-answered, it still shows the release plan for approval. The pipeline pauses here.

**Config file is optional.** The pipeline runs with built-in defaults when no `.sdlc/ship-config.json` exists. Do not error on missing config.

**Skip set validation matters.** Unrecognized values in `--skip` (e.g., `--skip reviw`) should warn, not silently ignore. Typos in skip values cause steps to run when the user expected them skipped.

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

---

## See Also

- [`/execute-plan-sdlc`](../execute-plan-sdlc/SKILL.md) — plan execution with wave-based dispatch
- [`/commit-sdlc`](../commit-sdlc/SKILL.md) — smart commit with style detection
- [`/review-sdlc`](../review-sdlc/SKILL.md) — multi-dimension code review
- [`/received-review-sdlc`](../received-review-sdlc/SKILL.md) — process and fix review findings
- [`/version-sdlc`](../version-sdlc/SKILL.md) — semantic versioning and release tags
- [`/pr-sdlc`](../pr-sdlc/SKILL.md) — pull request creation
