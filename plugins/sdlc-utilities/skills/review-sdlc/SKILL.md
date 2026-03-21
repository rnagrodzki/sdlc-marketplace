---
name: review-sdlc
description: "Use this skill when reviewing code changes across project-defined dimensions (security, performance, docs, concurrency, etc.). Runs review-prepare.js to pre-compute all git data, then delegates to the review-orchestrator agent. Arguments: [--base <branch>] [--committed] [--staged] [--working] [--worktree] [--set-default] [--dimensions <name,...>] [--dry-run]. Triggers on: review changes, code review, review PR, multi-dimension review, run review."
user-invocable: true
argument-hint: "[--base <branch>] [--committed] [--staged] [--dimensions <name,...>]"
---

# Reviewing Changes

Thin dispatcher — runs the prepare script, then delegates everything to the
`review-orchestrator` agent (which spawns dimension subagents in parallel).

---

## Step 0 — Resolve and Run review-prepare.js

> **VERBATIM** — Run this bash block exactly as written. Do not modify, rephrase, or simplify the commands.

```bash
SCRIPT=$(find ~/.claude/plugins -name "review-prepare.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/review-prepare.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/review-prepare.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate review-prepare.js. Is the sdlc plugin installed?" >&2; exit 2; }

MANIFEST_FILE=$(mktemp /tmp/review-manifest-XXXXXX.json)
node "$SCRIPT" $ARGUMENTS --json > "$MANIFEST_FILE"
EXIT_CODE=$?
echo "MANIFEST_FILE=$MANIFEST_FILE"
echo "EXIT_CODE=$EXIT_CODE"
```

**On non-zero `EXIT_CODE`:**

- Exit code 1: show the stderr message to the user and stop.
- Exit code 2: show `Script error — see output above` and stop.

**On script crash (exit 2):** Invoke error-report-sdlc — Glob `**/error-report-sdlc/REFERENCE.md`, follow with skill=review-sdlc, step=Step 0 — review-prepare.js execution, error=stderr.

**Do NOT read the manifest file contents into the main context.** The orchestrator will read it.

---

## Step 1 — Dry Run Check

Only if `--dry-run` was passed in `$ARGUMENTS`:

Read `MANIFEST_FILE` and output **exactly** this format:

```
Review Plan (dry run — no subagents dispatched)

  Base branch:    {manifest.base_branch}
  Changed files:  {manifest.git.changed_files.length}
  Dimensions:     {manifest.summary.active_dimensions} active, {manifest.summary.skipped_dimensions} skipped

| Dimension | Files | Severity | Status |
|-----------|-------|----------|--------|
{one row per entry in manifest.dimensions}

Plan critique:
  - Uncovered files:       {manifest.plan_critique.uncovered_files.join(', ') or "none"}
  - Over-broad:            {manifest.plan_critique.over_broad_dimensions.join(', ') or "none"}
  - Suggested dimensions:  {manifest.plan_critique.uncovered_suggestions.map(s => s.dimension).join(', ') or "none"}

To execute the full review, run /review-sdlc (without --dry-run).
```

Clean up: `rm -f "$MANIFEST_FILE"`. Stop here.

---

## Step 2 — Spawn Orchestrator Agent

Locate the orchestrator agent definition using Glob: `path: ~/.claude`, pattern
`**/agents/review-orchestrator.md`. If not found, retry Glob with the default path (cwd).

Spawn a single Agent (subagent_type: `sdlc:review-orchestrator`) with the orchestrator
agent's full content as the prompt, plus this context appended:

```
MANIFEST_FILE: {the temp file path from Step 0}
PROJECT_ROOT: {current working directory}
```

The orchestrator will read the manifest, resolve REFERENCE.md, dispatch dimension
subagents, critique/deduplicate, format the comment, handle PR posting, and clean up.

Wait for the orchestrator to return its summary.

**On orchestrator failure:** Re-dispatch once with the same inputs. If the second
attempt also fails, invoke error-report-sdlc with skill=review-sdlc,
step=Step 2 — orchestrator dispatch, error=agent error output.

---

## Step 3 — Report and Cleanup

Display the orchestrator's summary to the user.

Clean up the manifest temp file:

```bash
rm -f "$MANIFEST_FILE"
```

---

## Step 4 — Offer Self-Fix

If the verdict is **CHANGES REQUESTED** or **APPROVED WITH NOTES**, offer to fix:

> The review found actionable items. Address them now?

- **fix** — invoke `received-review-sdlc` (findings are in conversation context)
- **no** — done

If verdict is **APPROVED**: skip — nothing to fix.

---

## DO NOT

- Do NOT read the manifest JSON into main context (the orchestrator reads it)
- Do NOT read REFERENCE.md in main context (the orchestrator resolves it)
- Do NOT read the orchestrator agent definition into main context — pass the file path or use the sdlc:review-orchestrator subagent_type
- Do NOT invoke error-report-sdlc for user errors — only for script crashes (exit 2)

## See Also

- `agents/review-orchestrator.md` — full orchestration logic
- `REFERENCE.md` — dimension format spec, subagent prompt template, comment template
- [`/review-init-sdlc`](../review-init-sdlc/SKILL.md) — creates review dimensions
- [`/received-review-sdlc`](../received-review-sdlc/SKILL.md) — responds to findings
- [`/commit-sdlc`](../commit-sdlc/SKILL.md) — commit after review approval
