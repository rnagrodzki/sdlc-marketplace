---
name: review-sdlc
description: "Use this skill when reviewing code changes across project-defined dimensions (security, performance, docs, concurrency, etc.). Runs review-prepare.js to pre-compute all git data, then delegates to the review-orchestrator agent. Arguments: [--base <branch>] [--committed] [--staged] [--working] [--worktree] [--set-default] [--dimensions <name,...>] [--dry-run]. Triggers on: review changes, code review, review PR, multi-dimension review, run review."
user-invocable: true
---

# Reviewing Changes

Pre-compute review data with a script, then delegate all orchestration to the
`review-orchestrator` agent. The agent dispatches dimension subagents, deduplicates
findings, and posts the consolidated PR comment.

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
```

Read and parse `MANIFEST_FILE` as `MANIFEST_JSON`. Clean up after the review completes or is cancelled:

```bash
rm -f "$MANIFEST_FILE"
```

**On non-zero `EXIT_CODE`:**

- Exit code 1: show the stderr message to the user and stop.
- Exit code 2: show `Script error — see output above` and stop.

**Error-to-GitHub issue proposal**:

For exit code 2 (script crash), locate the procedure: Glob for `**/error-report-sdlc/REFERENCE.md`
under `~/.claude/plugins`, then retry with cwd. If found, follow the procedure with:

- **Skill**: review-sdlc
- **Step**: Step 0 — review-prepare.js execution
- **Operation**: Running review-prepare.js to pre-compute review manifest
- **Error**: Exit code 2 — script crash (full error on stderr)
- **Suggested investigation**: Check Node.js version; inspect stderr for stack trace; verify review-prepare.js is accessible via the plugin path

If not found, skip — the capability is not installed.

## Step 1 — Consume Pre-computed Context

Read `MANIFEST_JSON` now.

Key fields available:

| Field | Description |
| ----- | ----------- |
| `scope` | Review scope: `all` (default), `committed`, `staged`, `working`, or `worktree` |
| `base_branch` | The base branch used for the diff (`null` for `staged`/`working`) |
| `git.changed_files` | Array of changed file paths |
| `uncommitted_changes` | `true` if there are dirty working tree files |
| `dirty_files` | Array of uncommitted file paths |
| `summary.active_dimensions` | Number of dimensions with matching files |
| `summary.skipped_dimensions` | Number of dimensions with no matching files |
| `diff_dir` | Temp directory path containing per-dimension `.diff` files |
| `plan_critique.uncovered_files` | Files not matched by any dimension |
| `plan_critique.uncovered_suggestions` | Array of `{ dimension, files, reason }` — suggested new dimensions for uncovered files |
| `plan_critique.still_uncovered` | Files that could not be mapped to any known dimension type |
| `plan_critique.over_broad_dimensions` | Dimensions matching >80% of changed files |
| `summary.suggested_dimensions` | Count of suggested new dimensions |

The manifest also contains `diff_dir` — a temp directory with per-dimension `.diff`
files written by the script. Clean both up in Step 3.

**Uncommitted changes warning:**

Apply based on `manifest.scope`:

- **`all`** (default): The review includes committed + staged changes. If `manifest.uncommitted_changes` is `true`, warn that **unstaged** files are not included:
  ```
  Note: you have unstaged or untracked files not included in this review.
  Only staged and committed changes are reviewed in the default scope.
  Use --working to include unstaged changes. Continue? (yes/no)
  ```
  Wait for confirmation before proceeding.

- **`committed`**: If `manifest.uncommitted_changes` is `true`, warn the user:
  ```
  Warning: you have uncommitted changes ({dirty_files.length} files). They are NOT
  included in this review. Use the default scope (no flags) or --working to include them.
  Continue? (yes/no)
  ```
  Wait for confirmation before proceeding.

- **`staged`** or **`working`**: Do NOT warn — reviewing uncommitted changes is the purpose.

- **`worktree`**: Do NOT warn — the scope explicitly includes committed + staged + unstaged changes vs the base branch, so nothing is excluded.

---

## Step 2 — Dry Run Check

If `--dry-run` was passed:

Output **exactly** this format — do not summarize or abbreviate:

```
Review Plan (dry run — no subagents dispatched)

  Base branch:    {manifest.base_branch}
  Changed files:  {manifest.git.changed_files.length}
  Dimensions:     {manifest.summary.active_dimensions} active, {manifest.summary.skipped_dimensions} skipped

| Dimension | Files | Severity | Status |
|-----------|-------|----------|--------|
{one row per entry in manifest.dimensions, e.g.:}
| security-review      |   3 | high     | ACTIVE  |
| code-quality-review  |   7 | medium   | ACTIVE  |
| api-review           |   2 | high     | ACTIVE  |

Plan critique:
  - Uncovered files:       {manifest.plan_critique.uncovered_files.join(', ') or "none"}
  - Over-broad:            {manifest.plan_critique.over_broad_dimensions.join(', ') or "none"}
  - Suggested dimensions:  {manifest.plan_critique.uncovered_suggestions.map(s => s.dimension).join(', ') or "none"}

To execute the full review, run /review-sdlc (without --dry-run).
```

Use the actual dimension names, file counts, severity values, and statuses from
`manifest.dimensions`. Do not paraphrase. Do not collapse the table into prose.

Stop here.

---

## Step 3 — Spawn Orchestrator Agent

Locate the orchestrator agent definition using Glob with `path: ~/.claude` and pattern
`**/agents/review-orchestrator.md`. If not found, retry Glob with the default path (cwd).

Locate the reference templates using Glob with `path: ~/.claude` and pattern
`**/review-sdlc/REFERENCE.md`. If not found, retry Glob with the default path (cwd).
Store the resolved absolute path as `REFERENCE_MD_PATH`.

Spawn a single Agent (subagent_type: general-purpose) with the orchestrator agent's
instructions and this context embedded in the prompt:

```
MANIFEST_JSON: {the full JSON manifest from Step 1}
REFERENCE_MD_PATH: {resolved absolute path to REFERENCE.md from above}
```

Wait for the orchestrator to complete and return results.

**If the agent dispatch fails or returns an error** (not a review verdict — an actual agent error):

**Error-to-GitHub issue proposal**:

Locate the procedure: Glob for `**/error-report-sdlc/REFERENCE.md` under `~/.claude/plugins`,
then retry with cwd. If found, follow the procedure with:

- **Skill**: review-sdlc
- **Step**: Step 3 — Spawn Orchestrator Agent
- **Operation**: Dispatching review-orchestrator agent
- **Error**: Agent dispatch failure or error return (details from above)
- **Suggested investigation**: Check that the review-orchestrator.md agent file is resolvable; verify bypassPermissions mode is active

If not found, skip — the capability is not installed.

---

## Step 4 — Report and Cleanup

Display the orchestrator's summary to the user.

Clean up the temp diff directory:

```bash
rm -rf {manifest.diff_dir}
```

---

## Step 5 — Offer Self-Fix

If the orchestrator's return summary contains actionable findings — verdict is
**CHANGES REQUESTED** or **APPROVED WITH NOTES** — offer to process and fix them:

```text
Would you like to address these findings? (fix / no)
  fix — process findings and implement fixes using review-receive-sdlc
  no  — done
```

**Wait for explicit user response before proceeding.**

**On `fix`:** The review findings are already in the conversation context.
Invoke the `review-receive-sdlc` skill. It will read the findings from context
and walk through verification, evaluation, self-critique, and implementation.

**On `no`:** Stop. Done.

**If verdict is `APPROVED`** (zero actionable findings): skip this step entirely —
do not offer self-fix when there is nothing to fix.

---

## Error Recovery

> **Flow**: detect → diagnose → auto-recover (retry once if transient) → invoke `error-report-sdlc` for persistent actionable failures.

| Error | Recovery | Invoke error-report-sdlc? |
|-------|----------|---------------------------|
| `review-prepare.js` exit 1 (no dimensions or no changes) | Show stderr; suggest `review-init-sdlc` if no dimensions exist | No — user setup or empty scope |
| `review-prepare.js` exit 2 (crash) | Show stderr, stop | Yes |
| Orchestrator agent fails to return | Re-dispatch the orchestrator once with the same manifest | Yes if second attempt also fails |

When invoking `error-report-sdlc`, provide:
- **Skill**: review-sdlc
- **Step**: Step 0 (script crash) or Step 3 (orchestrator failure)
- **Operation**: `review-prepare.js` execution or orchestrator agent dispatch
- **Error**: exit code 2 + stderr, or agent error output
- **Suggested investigation**: Check installed plugin version; verify `.claude/review-dimensions/` contains valid dimension files

---

## Gotchas

- **Large manifest output**: `review-prepare.js` can produce a large JSON manifest on repos with
  many changed files. Always write to a temp file (`mktemp`) as prescribed in Step 1 — piping
  directly to a parser truncates the JSON silently (failure manifests as "Unterminated string in
  JSON at position N"). Clean up both `MANIFEST_FILE` and `manifest.diff_dir` in Step 4.

## Learning Capture

After completing a review, append discoveries to `.claude/learnings/log.md`. Record
entries for: dimension patterns that matched unintended files, file types not covered
by any dimension, subagent findings that were systematically miscalibrated, base
branch detection failures, or dimension trigger globs that needed adjustment for
this project's directory layout.

## See Also

- `agents/review-orchestrator.md` — full orchestration logic
- `REFERENCE.md` — dimension format spec, subagent prompt template, comment template
- `EXAMPLES.md` — 5 ready-to-use example dimension files
- `review-init-sdlc` — creates tailored dimensions for a project
