---
description: Triage .claude/learnings/log.md into GitHub issues
allowed-tools: [Bash, Read, AskUserQuestion]
argument-hint: "[--dry-run] [--since YYYY-MM-DD]"
---

# /harvest-learnings Command

Triage `.claude/learnings/log.md` entries into discrete GitHub issues for this
repository. Heuristic clustering + LLM-driven approve/skip/edit loop. Dedup
keys off the `Source: learnings/log.md (lines N–M, ...)` footer, with a fuzzy
title fallback for `possibly-tracked` candidates.

`$ARGUMENTS` is forwarded verbatim to the helper (`--dry-run`, `--since
YYYY-MM-DD` accepted).

## Usage

- `/harvest-learnings` — interactive triage of all clusters in the log.
- `/harvest-learnings --dry-run` — print drafts; create no issues, mutate no log.
- `/harvest-learnings --since 2026-04-01` — only consider clusters dated on or after.

## Workflow

1. **Run the helper in `--output-file` mode.** Resolve the helper path:
   prefer `${CLAUDE_PROJECT_DIR}/.claude/scripts/harvest-learnings.js` if
   `CLAUDE_PROJECT_DIR` is set, else fall back to
   `.claude/scripts/harvest-learnings.js` relative to the current working
   directory. Invoke:
   ```bash
   node <helper-path> --output-file $ARGUMENTS
   ```
   Capture stdout — it is the absolute path to the drafts JSON in `os.tmpdir()`.

2. **Read drafts JSON.** If `clusters.length === 0`, print
   `nothing to harvest` and stop. No `gh` calls, no log mutation.

3. **Filter clusters.** Silently set aside clusters with `status === 'tracked'`
   (count them and report at the end). For `status === 'possibly-tracked'`,
   surface to the user with `existingIssue` context (number, title, state) so
   they can confirm it's a duplicate or treat it as a fresh draft.

4. **Compose draft issues.** For every `status === 'draft'` cluster (and any
   `possibly-tracked` cluster the user marked as fresh):
   - **Title:** `<skill>: <summary>` (from the cluster header).
   - **Body:** the cluster `bodyLines`, followed by a blank line and the footer
     `Source: learnings/log.md (lines <sourceStartLine>–<sourceEndLine>, harvested <harvestDate>)`.

5. **Approval loop.** For each draft, present the title + body via
   `AskUserQuestion` with options `approve` / `skip` / `edit`. On `edit`, allow
   the user to revise the title and/or body (single-pass — no nested
   sub-prompts). Track approved cluster ids. Loop until every cluster is
   resolved.

6. **Dry-run short-circuit.** If `--dry-run` was passed (drafts JSON has
   `dryRun === true`), print the approved drafts and stop. **No `gh issue
   create`. No log mutation.**

7. **Create issues.** For each approved draft, run:
   ```bash
   gh issue create --title <T> --body <B>
   ```
   No `--repo` flag — `gh` resolves the target via the cwd's origin or
   `gh repo set-default`. Capture the issue numbers returned. If any
   `gh issue create` invocation fails, surface the failure (and any partial
   successes) to the user and **skip Step 8** so the user can re-run after
   resolving the failure.

8. **Commit log mutation.** After all approved issues are created
   successfully, write a temp file at `$(mktemp -t harvest-approved-XXXXXX).json`
   with shape:
   ```json
   { "approvedClusterIds": ["<id1>", "<id2>", ...] }
   ```
   Then run:
   ```bash
   node <helper-path> --commit <tmpfile>
   ```
   The helper atomically rewrites `log.md`, removing only the line ranges of
   the approved clusters.

9. **Summary.** Print:
   ```
   created N issues, skipped M tracked, skipped K rejected, X remain in log
   ```

## DO NOT

- Call `gh issue create` before the user explicitly approves a draft.
- Mutate `log.md` (run `--commit`) before every approved `gh issue create`
  has succeeded — partial-failure path skips Step 8 entirely.
- Pass `--repo` to `gh issue create` or `gh issue list`. The helper and
  command rely on `gh`'s cwd-resolution (`origin` / `gh repo set-default`).
