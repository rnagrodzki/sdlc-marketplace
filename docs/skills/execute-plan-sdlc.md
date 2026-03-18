# `/execute-plan-sdlc` — Plan Execution Orchestrator

## Overview

Orchestrates implementation plan execution with adaptive task classification, wave-based parallel dispatch, PCIDCI critique loops, and automatic error recovery. Classifies each task by complexity and risk, assigns a default model (haiku/sonnet/opus), presents 3 execution presets for user selection, dispatches agents in parallel, verifies results after each wave, and recovers from failures with automatic model escalation on retries. After each wave, verifies agent output against the filesystem using `git diff` and targeted symbol checks — agent self-reports are never trusted alone. Self-contained — no external sub-skills required. When a phase contains 2 or more trivial tasks, they are batched into a single haiku agent rather than executed inline or dispatched separately.

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
| **Speed** | haiku | haiku | sonnet | Plan is well-specified, changes are mechanical |
| **Balanced** | haiku | sonnet | opus | Default — matches complexity to capability |
| **Quality** | sonnet | opus | opus | Codebase is unfamiliar, tasks are ambiguous |

Select a preset with a single letter (A/B/C) or choose `custom` to edit individual task assignments. On retry after failure, the model is automatically escalated one step (haiku → sonnet → opus) and counts toward the 2-retry budget.

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

- **`bypassPermissions` mode** — must be active before invoking. The skill cannot switch modes itself — this is a host-level setting. If it is not active, the skill will stop at Step 0 and ask you to enable it. In Claude Code, Shift+Tab cycles through permission modes. Once confirmed active, the skill explicitly passes `mode: "bypassPermissions"` to every dispatched agent to prevent drift during execution.
- **An implementation plan** — either in the conversation context from the current session, or as a readable file. The plan must have at least 2 tasks; single-task plans don't need orchestration.

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| Source code files | Files created or modified as specified by plan tasks |
| `.claude/learnings/log.md` | Execution learnings appended after completion (classification accuracy, wave conflicts, recovery outcomes) |

Does not create commits, branches, or push to any remote. The user decides what to do with the changes after execution completes.

---

## Related Skills

- [`/review-sdlc`](review-sdlc.md) — review the changes produced by plan execution before opening a PR
- [`/pr-sdlc`](pr-sdlc.md) — open a PR after plan execution completes
