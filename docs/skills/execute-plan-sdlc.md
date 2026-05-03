# `/execute-plan-sdlc` — Plan Execution Orchestrator

## Overview

Orchestrates implementation plan execution with adaptive task classification, wave-based parallel dispatch, PCIDCI critique loops, spec compliance review, and automatic error recovery. Classifies each task by complexity and risk, assigns a default model (haiku/sonnet/opus), presents 3 execution presets for user selection, dispatches agents in parallel, verifies results after each wave, and recovers from failures with automatic model escalation on retries. After each wave, verifies agent output against the filesystem using `git diff` and targeted symbol checks — agent self-reports are never trusted alone. When agents complete tasks, they fill a structured completion checklist (COMPLETE:/VERIFY:/STATUS:) that the orchestrator parses — agent self-reports are never trusted alone. After mechanical verification, a spec compliance reviewer checks non-trivial tasks against their specifications. Plans with 3 or fewer simple tasks execute directly without wave orchestration. Self-contained — no external sub-skills required. When a phase contains 2 or more trivial tasks, they are batched into a single haiku agent rather than executed inline or dispatched separately.

---

## Usage

```text
/execute-plan-sdlc
/execute-plan-sdlc --quality balanced
/execute-plan-sdlc --resume
```

Provide the plan in one of two ways:
- Discuss, write, or paste the plan in the conversation before invoking — Claude reuses it from context without re-reading from file
- Have a plan file accessible — Claude reads it on invocation

**Auto-trigger after plan mode:** When `/plan-sdlc` completes in plan mode, it proposes execution before calling ExitPlanMode. If you accept the plan, `/execute-plan-sdlc` is invoked automatically — no manual invocation needed. You can still invoke it standalone for plans created outside plan mode.

The plan must contain at least 2 tasks with clear deliverables (files to create or modify, behavior to implement).

---

## Flags

| Flag | Description | Default |
|---|---|---|
| `--quality <full\|balanced\|minimal>` | Auto-select the model quality tier, skipping the interactive selection prompt. `full` = Speed, `balanced` = Balanced, `minimal` = Quality. Invalid values fall back to interactive selection. (Renamed from `--preset` in #190 to disambiguate from ship-sdlc's `--steps` step-selection flag.) When invoked from ship-sdlc, `--quality` is forwarded only when the user explicitly passed `--quality` to ship. | Interactive prompt |
| `--auto` | Suppress interactive prompts: auto-resume if state exists, auto-approve high-risk gates, use `--quality` value (required when `--auto` is set). | Off |
| `--resume` | Resume from the most recent execution state file for the current branch. Completed waves are skipped; in-progress waves are retried. If the plan has changed since execution started, you are prompted to resume or restart. | Off |
| `--workspace <branch\|worktree\|prompt>` | Workspace isolation mode when on the default branch. `branch` creates a feature branch, `worktree` creates a git worktree, `prompt` asks interactively. | `prompt` |
| `--rebase <auto\|skip\|prompt>` | Rebase onto the default branch before execution. `auto` rebases silently (aborts on conflict), `skip` skips, `prompt` asks. | Skip |

---

## Workspace Isolation

When you invoke `/execute-plan-sdlc` while on the repository's default branch (typically `main`), the skill detects this and prompts before executing:

```
You're on the default branch (main). Working directly on it is not recommended.

Suggested: feat/add-jwt-authentication

  1. Create branch feat/add-jwt-authentication (or provide a custom name)
  2. Create a worktree for isolated execution
  3. Continue on main anyway
```

**Branch name derivation:** The type prefix is determined from the plan's nature:

| Plan nature | Prefix |
|---|---|
| New feature / capability | `feat/` |
| Bug fix | `fix/` |
| Refactor, cleanup, tooling, config | `chore/` |
| Documentation | `docs/` |

The slug is derived from the plan title (lowercase, hyphenated, max 50 characters). You can override both the prefix and slug by providing a custom name.

**Option 1 — Create branch:** Runs `git checkout -b <name>` and continues execution on the new branch. Lightweight and familiar. When `--workspace branch` is passed, this option is selected automatically without prompting.

**Option 2 — Create worktree:** Creates an isolated copy of the repository using `worktree-create.js`. All execution happens in the worktree. After execution and any follow-up actions (commit, PR), clean up with `git worktree remove <path>` from the main worktree. When `--workspace worktree` is passed, this option is selected automatically without prompting.

**Option 3 — Continue:** Proceeds without changes. This is the user's decision — the check is a suggestion, not a block.

The check is skipped entirely when you are already on a non-default branch.

Pass `--workspace branch` or `--workspace worktree` to bypass the interactive prompt and have the skill act immediately. Pass `--workspace prompt` (the default) to always be asked.

**Note:** Branch detection always runs `git branch --show-current` at execution time. It does not use the session-level `gitStatus` snapshot, which may be stale if you switched branches after starting the conversation.

---

## Model Selection

Each task is assigned a model based on its complexity class. Before executing, the skill presents 3 presets:

| Preset | Trivial | Standard | Complex | Best when |
|---|---|---|---|---|
| **Speed** | haiku | haiku | sonnet | Plan is well-specified, changes are mechanical — mechanical verification only, spec compliance review skipped |
| **Balanced** | haiku | sonnet | opus | Default — matches complexity to capability |
| **Quality** | sonnet | opus | opus | Codebase is unfamiliar, tasks are ambiguous |

Select a preset by name (full/balanced/minimal) or choose `custom` to edit individual task assignments. On retry after failure, the model is automatically escalated one step (haiku → sonnet → opus) and counts toward the 2-retry budget.

---

## Agent Protocol

Each dispatched agent fills a structured completion checklist at the end of its output:

```
COMPLETE: files_created=[...] files_modified=[...] tests_added=[yes|no|n/a] tests_pass=[yes|no|n/a] build_pass=[yes|no|n/a]
VERIFY: <symbol_name> in <file_path>
STATUS: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
```

**Status handling:**
- **DONE** — task complete; proceed to verification
- **DONE_WITH_CONCERNS** — task complete but agent has doubts; orchestrator reads concerns before proceeding
- **NEEDS_CONTEXT** — agent needs additional information; orchestrator provides it and re-dispatches (counts as retry)
- **BLOCKED** — agent cannot complete the task; orchestrator assesses and responds (provide context, escalate model, break task smaller, or escalate to user)

The VERIFY token is grepped in the filesystem to confirm changes persisted. If the checklist is missing or malformed, the agent is re-dispatched once with a format reminder.

---

## Spec Compliance Review

After mechanical verification passes for each wave (git diff + canary checks), a spec compliance reviewer (sonnet) checks that each non-trivial task's implementation matches its specification. The reviewer reads actual code — it does not trust agent completion reports.

**Skipped when:** the wave contains only Trivial tasks, or the Speed preset was selected.

If the reviewer finds issues:
- 1–2 minor issues → fixed inline in the main context
- Major spec gaps → original agent re-dispatched with specific fix instructions (counts toward retry budget)

---

## Small-Plan Routing

Plans with **3 or fewer tasks** that are all Trivial or Standard complexity and have no high-risk tasks are executed directly in the main context — no agent dispatch, no wave orchestration. Verification still runs after each task.

Plans with 4 or more tasks use standard wave execution with state persistence after every wave.

---

## State Persistence and Resume

After each wave completes, execution state is written to `.sdlc/execution/execute-<branch>-<timestamp>.json` in the main working tree. This JSON file records completed waves, task status, file changes, and contextual information (interfaces created, decisions made) needed to resume in a fresh session. When execution runs in a worktree, state is written to the main repo root so it survives worktree cleanup.

**Resuming:** Pass `--resume` to pick up from the last completed wave. The state file contains enough context for a new session to continue without prior conversation history. If the plan file has changed since execution started (detected via content hash), you are prompted to resume with the old structure or restart.

**Automatic detection:** Even without `--resume`, if a state file exists for the current branch, the skill offers to resume in interactive mode. In `--auto` mode, it starts a fresh run instead (pass `--resume` explicitly to auto-resume).

**Cleanup:** The state file is deleted on successful completion and preserved on failure or interruption.

Plans with 3 or fewer simple tasks (small-plan direct execution) do not write state files.

---

## Examples

### Execute a plan from conversation context

After writing or discussing a plan in the current session:

```text
/execute-plan-sdlc
```

Claude presents the classified wave structure and waits for confirmation before executing:

```
Execution Plan
────────────────────────────────────────────
Pre-wave (1 batch agent, 2 trivial tasks):
  - Task 1: "add environment variable"     [Trivial → haiku]
  - Task 2: "update config key name"       [Trivial → haiku]
Wave 1 (3 tasks, parallel):
  - Task 3: "Create UserService module"    [Standard → sonnet]
  - Task 4: "Add API route handlers"       [Standard → sonnet]
  - Task 5: "Write unit tests for models"  [Standard → sonnet]
Wave 2 (2 tasks, parallel):
  - Task 6: "Integrate auth middleware"    [Complex  → opus]
  - Task 7: "Add E2E test coverage"        [Standard → sonnet]
Wave 3 (1 task — HIGH RISK, will pause):
  - Task 8: "Update database migration"    [Complex  → opus]
────────────────────────────────────────────
Total: 8 tasks across 3 waves + pre-wave

Model Presets:
  full) Speed:       6 × haiku, 2 × sonnet                 — fast, low cost
  balanced) Balanced:  2 × haiku, 4 × sonnet, 2 × opus    — default ✓
  minimal) Quality:    2 × sonnet, 6 × opus                — max correctness

Select preset (full/balanced/minimal), "custom" to edit individual tasks, or "cancel":
```

### Execute a plan from a file

```text
/execute-plan-sdlc

.claude/plans/my-feature-plan.md
```

Claude loads the plan from the specified file, validates it, classifies tasks, and presents the wave structure for confirmation.

### Skip quality-tier selection

```text
/execute-plan-sdlc --quality balanced
```

Claude applies the Balanced quality tier automatically and proceeds to execution after showing the wave structure — no interactive prompt.

### Resume after interruption

```text
/execute-plan-sdlc --resume
```

Claude finds the most recent state file for the current branch, loads the execution context, and resumes from the last completed wave:

```
Found execution state from 2026-03-27T14:30:00Z
  Completed: Wave 1 (3 tasks), Wave 2 (2 tasks)
  Resuming from: Wave 3 (1 task)
  Plan hash: verified (unchanged)

Proceeding to Wave 3...
```

### High-risk task gate

When a wave contains high-risk tasks (breaking changes, credential handling, irreversible operations), Claude pauses before executing:

```
Wave 3 contains high-risk task(s):
  - Task 7: "Update database schema migration" [HIGH RISK: database change]
Approve? (yes / skip / cancel)
```

### Completion summary

After all waves complete:

```
Plan Execution Complete
────────────────────────────────────────────
Tasks completed:  8/8
Waves executed:   3 + pre-wave
Retries needed:   1
Verification:     tests ✓  build ✓  lint ✓

Files changed:    12 files (4 added, 8 modified, 0 deleted)
Guardrails:       3/3 passed (1 warning, 0 overridden)
────────────────────────────────────────────
```

---

## Prerequisites

- **Permission mode** — the skill always dispatches agents with `bypassPermissions`. The runtime caps child agent permissions to the parent session's level — if your session is not in bypassPermissions, agents will surface permission prompts to you automatically. The mode lock prevents any mode changes during execution based on plan content.
- **An implementation plan** — either in the conversation context from the current session, or as a readable file. The plan must have at least 2 tasks; single-task plans don't need orchestration.

### Harness Configuration

| Field | Value |
|---|---|
| Plan mode | Graceful refusal (Plan Mode Check) |

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| Source code files | Files created or modified as specified by plan tasks |
| `.claude/learnings/log.md` | Execution learnings appended after completion (classification accuracy, wave conflicts, recovery outcomes) |
| `.sdlc/execution/execute-<branch>-<timestamp>.json` | Execution state file written after each wave; enables cross-session resume via --resume. Deleted on success, preserved on failure. |
| Step 1 context-heaviness advisory | When the latest transcript stats sidecar at `$TMPDIR/sdlc-context-stats.json` indicates `heavy: true` (transcript ≥60% of model budget), Step 1 emits a `/compact` advisory to stderr before guardrail loading. Sidecar is written by the `UserPromptSubmit` hook `hooks/context-stats.js`. Implementation: [`scripts/lib/context-advisory.js`](../../plugins/sdlc-utilities/scripts/lib/context-advisory.js). Distinct from R21 between-wave compaction. Pipeline state survives `/compact` (PreCompact + SessionStart hooks). |

Does not create commits, branches, or push to any remote. The user decides what to do with the changes after execution completes.

## OpenSpec Integration

When executing a plan whose `**Source:**` header points to an OpenSpec change path, this skill loads the delta specs for enhanced compliance checking.

- **Spec compliance reviewer** additionally checks implementations against OpenSpec delta spec requirements — not just task acceptance criteria
- **Inter-wave critique** checks for contradictions between implementations and delta spec requirements not captured in task descriptions
- **Post-pipeline archive suggestion** — after all waves complete, if the plan was OpenSpec-sourced and `openspec validate <name> --strict` passes, emits a suggestion to archive via `openspec archive <name> --yes` or `/ship-sdlc`. If validation fails, surfaces errors instead. If the CLI is not available, falls back to the existing advisory. The suggestion is never auto-executed.

See [OpenSpec Integration Guide](../openspec-integration.md) for the full workflow.

## Guardrail Enforcement

When execution guardrails are configured in `.claude/sdlc.json` under `execute.guardrails[]`, this skill enforces them at runtime to prevent drift between plan acceptance and execution. Execution guardrails are separate from plan guardrails (`plan.guardrails[]`) — they use the same item format (`id`, `description`, `severity`) but are configured independently and evaluated at different stages.

**Loading:** Guardrails are loaded in Step 1 using `readSection(root, 'execute')`. If no execution guardrails are configured, all guardrail checks are skipped — backward compatible with existing projects.

**Pre-wave check (Step 5a-pre):** Before each wave, error-severity guardrails are evaluated against the wave's task descriptions. Violations prompt the user to override or cancel. In `--auto` mode, error violations are blocking — the pipeline stops.

**Post-wave check (Step 5c-ter):** After each wave's verification and spec compliance review, all guardrails (error and warning) are evaluated against the actual `git diff` output. Error violations offer fix/override/cancel; warnings are reported but non-blocking.

**Small plans:** Plans with 3 or fewer tasks run a single guardrail evaluation after all tasks complete.

**Report:** The final summary includes a guardrail pass/warn/override breakdown when guardrails are configured.

Configure execution guardrails via `/setup-sdlc --execution-guardrails`. See [plan-sdlc](plan-sdlc.md) for how plan guardrails are evaluated during planning.

---

## Related Skills

- [`/plan-sdlc`](plan-sdlc.md) — writes the plans this skill executes
- [`/commit-sdlc`](commit-sdlc.md) — commit changes after plan execution
- [`/pr-sdlc`](pr-sdlc.md) — create a pull request after plan execution
- [`/review-sdlc`](review-sdlc.md) — review changes after plan execution
- [`/version-sdlc`](version-sdlc.md) — tag a release after plan execution
