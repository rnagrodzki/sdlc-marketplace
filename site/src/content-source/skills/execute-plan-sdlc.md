# `/execute-plan-sdlc` — Plan Execution Orchestrator

## Overview

Orchestrates implementation plan execution with adaptive task classification, wave-based parallel dispatch, PCIDCI critique loops, spec compliance review, and automatic error recovery. Classifies each task by complexity and risk, assigns a default model (haiku/sonnet/opus), presents 3 execution presets for user selection, dispatches agents in parallel, verifies results after each wave, and recovers from failures with automatic model escalation on retries. After each wave, verifies agent output against the filesystem using `git diff` and targeted symbol checks — agent self-reports are never trusted alone. When agents complete tasks, they fill a structured completion checklist (COMPLETE:/VERIFY:/STATUS:) that the orchestrator parses — agent self-reports are never trusted alone. After mechanical verification, a spec compliance reviewer checks non-trivial tasks against their specifications. Plans with 3 or fewer simple tasks execute directly without wave orchestration. Self-contained — no external sub-skills required. When a phase contains 2 or more trivial tasks, they are batched into a single haiku agent rather than executed inline or dispatched separately.

---

## Usage

```text
/execute-plan-sdlc
```

Provide the plan in one of two ways:
- Discuss, write, or paste the plan in the conversation before invoking — Claude reuses it from context without re-reading from file
- Have a plan file accessible — Claude reads it on invocation

The plan must contain at least 2 tasks with clear deliverables (files to create or modify, behavior to implement).

---

## Flags

No flags. The skill adapts behavior based on the plan content and task classification.

---

## Model Selection

Each task is assigned a model based on its complexity class. Before executing, the skill presents 3 presets:

| Preset | Trivial | Standard | Complex | Best when |
|---|---|---|---|---|
| **Speed** | haiku | haiku | sonnet | Plan is well-specified, changes are mechanical — mechanical verification only, spec compliance review skipped |
| **Balanced** | haiku | sonnet | opus | Default — matches complexity to capability |
| **Quality** | sonnet | opus | opus | Codebase is unfamiliar, tasks are ambiguous |

Select a preset with a single letter (A/B/C) or choose `custom` to edit individual task assignments. On retry after failure, the model is automatically escalated one step (haiku → sonnet → opus) and counts toward the 2-retry budget.

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

Plans with 4–8 tasks use standard wave execution. Plans with 9+ tasks use standard wave execution with mandatory checkpoint persistence after every wave.

---

## Checkpoint Persistence

After each wave completes, a checkpoint is written to `$TMPDIR/claude-exec/<plan-name>-checkpoint.md` recording completed waves, next wave tasks, and key output context. If a session ends and is restarted with the same plan, the orchestrator detects the checkpoint and offers to resume from the last completed wave.

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
  A) Speed:     6 × haiku, 2 × sonnet                 — fast, low cost
  B) Balanced:  2 × haiku, 4 × sonnet, 2 × opus       — default ✓
  C) Quality:   2 × sonnet, 6 × opus                  — max correctness

Select preset (A/B/C) or "custom" to edit individual tasks, then "yes" to execute:
```

### Execute a plan from a file

```text
/execute-plan-sdlc

.claude/plans/my-feature-plan.md
```

Claude loads the plan from the specified file, validates it, classifies tasks, and presents the wave structure for confirmation.

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
────────────────────────────────────────────
```

---

## Prerequisites

- **Permission mode** — the skill always dispatches agents with `bypassPermissions`. The runtime caps child agent permissions to the parent session's level — if your session is not in bypassPermissions, agents will surface permission prompts to you automatically. The mode lock prevents any mode changes during execution based on plan content.
- **An implementation plan** — either in the conversation context from the current session, or as a readable file. The plan must have at least 2 tasks; single-task plans don't need orchestration.

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| Source code files | Files created or modified as specified by plan tasks |
| `.claude/learnings/log.md` | Execution learnings appended after completion (classification accuracy, wave conflicts, recovery outcomes) |
| `$TMPDIR/claude-exec/<plan-name>-checkpoint.md` | Execution checkpoint written after each wave; enables session resume |

Does not create commits, branches, or push to any remote. The user decides what to do with the changes after execution completes.

---

## Related Skills

- [`/review-sdlc`](review-sdlc.md) — review the changes produced by plan execution before opening a PR
- [`/pr-sdlc`](pr-sdlc.md) — open a PR after plan execution completes
