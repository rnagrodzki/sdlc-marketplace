---
name: reviewing-changes
description: "Use this skill when reviewing code changes across project-defined dimensions (security, performance, docs, concurrency, etc.). Runs review-prepare.js to pre-compute all git data, then delegates to the review-orchestrator agent. Triggers on: review changes, code review, review PR, multi-dimension review, run review."
user-invokable: false
---

# Reviewing Changes

Pre-compute review data with a script, then delegate all orchestration to the
`review-orchestrator` agent. The agent dispatches dimension subagents, deduplicates
findings, and posts the consolidated PR comment.

---

## Step 1 — Run Preparation Script

Locate and run the script:

```bash
# Resolve script: check installed plugin location first, then fall back to project tree
SCRIPT=$(find ~/.claude/plugins -name "review-prepare.js" -path "*/scripts/*" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && SCRIPT=$(find . -name "review-prepare.js" -path "*/scripts/*" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate review-prepare.js. Is the sdlc plugin installed?" >&2; exit 2; }

# Write to temp file — large manifests (100KB+) break shell pipes
MANIFEST_FILE=$(mktemp /tmp/review-manifest-XXXXXX.json)
node "$SCRIPT" \
  --project-root . \
  [--base <branch>]        # include if --base was provided
  [--dimensions <names>]   # include if --dimensions was provided
  --json > "$MANIFEST_FILE"
EXIT_CODE=$?
```

Read and parse `MANIFEST_FILE` as `MANIFEST_JSON`. The manifest also contains `diff_dir` — a temp directory with per-dimension `.diff` files written by the script. Clean both up in Step 4.

**On non-zero `EXIT_CODE`:**

- Exit code 1: show the stderr message to the user and stop.
- Exit code 2: show `Script error — see output above` and stop.

**Uncommitted changes warning:**

If `manifest.uncommitted_changes` is `true`, warn the user:

```
Warning: you have uncommitted changes ({dirty_files.length} files). They are NOT
included in this review diff. Commit or stash them first if you want them reviewed.
Continue? (yes/no)
```

Wait for confirmation before proceeding.

---

## Step 2 — Dry Run Check

If `--dry-run` was passed:

Format and display the review plan from the manifest:

```
Review Plan (dry run — no subagents dispatched)

  Base branch:    {manifest.base_branch}
  Changed files:  {manifest.git.changed_files.length}
  Dimensions:     {manifest.summary.active_dimensions} active, {manifest.summary.skipped_dimensions} skipped

| Dimension | Files | Severity | Status |
|-----------|-------|----------|--------|
...

Plan critique:
  - Uncovered files: {manifest.plan_critique.uncovered_files.join(', ') or "none"}
  - Over-broad:      {manifest.plan_critique.over_broad_dimensions.join(', ') or "none"}
```

Stop here.

---

## Step 3 — Spawn Orchestrator Agent

Locate the orchestrator agent definition using Glob with `path: ~/.claude` and pattern
`**/agents/review-orchestrator.md`. If not found, retry Glob with the default path (cwd).

Locate the reference templates using Glob with `path: ~/.claude` and pattern
`**/reviewing-changes/REFERENCE.md`. If not found, retry Glob with the default path (cwd).
Store the resolved absolute path as `REFERENCE_MD_PATH`.

Spawn a single Agent (subagent_type: general-purpose) with the orchestrator agent's
instructions and this context embedded in the prompt:

```
MANIFEST_JSON: {the full JSON manifest from Step 1}
REFERENCE_MD_PATH: {resolved absolute path to REFERENCE.md from above}
```

Wait for the orchestrator to complete and return results.

---

## Step 4 — Report and Cleanup

Display the orchestrator's summary to the user.

Clean up the temp diff directory:

```bash
rm -rf {manifest.diff_dir}
```

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
- `sdlc:initializing-review-dimensions` — creates tailored dimensions for a project
