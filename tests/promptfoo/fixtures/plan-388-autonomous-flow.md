# Plan Autonomous Flow (Fixes #388)

## Requirements (user supplied)

Add a `--dry-run` flag to the data export CLI:
- When set, the CLI prints the destination path and row count but does not write the output file.
- When unset (default), behavior is unchanged.
- Update help text and the user-facing reference doc.

Touches at minimum 4 files (CLI entry, the exporter module, help-text constant, reference doc),
so this is a full-pipeline plan-sdlc invocation, NOT lightweight.

## Pre-existing draft plan file

The designated plan file `~/.claude/plans/2026-05-16-data-export-dry-run.md` already exists with
content from a prior interrupted invocation:

```markdown
# Data Export Dry-Run Implementation Plan

**Goal:** Add --dry-run flag
**Architecture:** [TBD]
**Source:** conversation context
**Verification:** [TBD]

---

(stale partial — 2 task stubs followed)
```

Under the new R23 default (Fixes #388), Step 0 MUST silently overwrite this file and begin fresh
WITHOUT prompting the user to choose between "resume from critique" and "restart".

## Guardrails (loaded from .sdlc/config.json)

None configured for this fixture — `activeGuardrails` is an empty array.

## Expected non-interactive flow (Fixes #388, R22 + R23)

1. Step 0 detects the existing draft, overwrites it, and proceeds — no AskUserQuestion.
2. Steps 1–3 run normally (requirements, decomposition, self-critique).
3. Step 4 IMPROVE runs autonomously — applies fixes from Step 3, writes the Guardrail Compliance
   section if needed, and proceeds DIRECTLY to Step 5 — no AskUserQuestion asking the user to
   approve the plan.
4. Step 5 reviewer loop converges (assume one round in this fixture).
5. Step 6.5 link verification passes (no URLs in the plan).
6. Step 7 Handoff — the ONE user touchpoint — presents the workflow continuation menu:
   `ship` / `execute` / `done`.
