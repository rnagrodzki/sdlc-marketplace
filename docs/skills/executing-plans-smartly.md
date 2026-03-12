# `/executing-plans-smartly` — Plan Execution Orchestrator

## Overview

Orchestrates implementation plan execution with adaptive task classification, wave-based parallel dispatch, PCIDCI critique loops, and automatic error recovery. Classifies each task by complexity and risk, builds dependency-aware execution waves, dispatches agents in parallel, verifies results after each wave, and recovers from failures without stopping. Self-contained — no external sub-skills required. Unlike other skills in this plugin, this skill is not SDLC-specific and omits the `-sdlc` suffix.

---

## Usage

```text
/executing-plans-smartly
```

Provide the plan in one of two ways:
- Discuss, write, or paste the plan in the conversation before invoking — Claude reuses it from context without re-reading from file
- Have a plan file accessible — Claude reads it on invocation

The plan must contain at least 2 tasks with clear deliverables (files to create or modify, behavior to implement).

---

## Flags

No flags. The skill adapts behavior based on the plan content and task classification.

---

## Examples

### Execute a plan from conversation context

After writing or discussing a plan in the current session:

```text
/executing-plans-smartly
```

Claude presents the classified wave structure and waits for confirmation before executing:

```
Execution Plan
────────────────────────────────────────────
Pre-wave (inline):  2 trivial tasks
Wave 1:             3 tasks (parallel)
Wave 2:             2 tasks (parallel)
Wave 3:             1 task — contains HIGH RISK tasks (will pause for approval)
────────────────────────────────────────────
Total: 8 tasks across 3 waves + pre-wave

Proceed? (yes / edit / cancel)
```

### Execute a plan from a file

```text
/executing-plans-smartly

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

- **`bypassPermissions` mode** — must be active before invoking. Agents inherit the session's permission model; if an agent hits a permission prompt mid-execution, it silently hangs with no recovery path. Switch to `bypassPermissions` mode before running this skill.
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
