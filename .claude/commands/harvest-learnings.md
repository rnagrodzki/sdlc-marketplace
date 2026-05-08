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
   ```bash
   HELPER_PATH="$(git rev-parse --show-toplevel)/.claude/scripts/harvest-learnings.js"
   [ -f "$HELPER_PATH" ] || { echo "ERROR: helper not found at $HELPER_PATH"; exit 2; }
   ```
   Invoke:
   ```bash
   node "$HELPER_PATH" --output-file $ARGUMENTS
   ```
   Capture stdout — it is the absolute path to the drafts JSON in `os.tmpdir()`.

2. **Read drafts JSON.** If `clusters.length === 0`, print
   `nothing to harvest` and stop. No `gh` calls, no log mutation.

3. **Filter clusters.** Silently set aside clusters with the following statuses
   (count each category separately):
   - `status === 'tracked'` — already has a GH issue with a matching source range.
   - `status === 'operational-note'` — emitted by `pr-sdlc`, `version-sdlc`, or
     `ship-sdlc`; these are release success notes, not actionable bugs.
   - `status === 'already-fixed'` — the cluster cites a fix reference (PR or SHA)
     that has been verified on `main`; the bug is resolved.

   For `status === 'possibly-tracked'`, surface to the user with `existingIssue`
   context (number, title, state) so they can confirm it's a duplicate or treat
   it as a fresh draft.

   Only `possibly-tracked` and `draft` clusters surface to the user in subsequent
   steps. The three silent-skip categories are reported in the Step 10 summary.

4. **Present classification plan and request approval.** Build a classification
   table from the parsed clusters JSON. One row per cluster (excluding
   `skippedTrivial`). Columns: `Date`, `Skill`, `Summary` (truncate to ~80
   chars), `Status`, `Disposition`. Disposition mapping:
   - `operational-note` → "skip (operational note), remove from log"
   - `already-fixed` → "skip (fix on main: `<fixRef.type> <fixRef.value>`), remove from log"
   - `tracked` → "skip (existing #`<existingIssue.number>`), remove from log"
   - `possibly-tracked` → "needs decision (matches #`<existingIssue.number>`)"
   - `draft` → "create new issue, remove from log"

   Render the table to the user. Then present `AskUserQuestion` with options:
   - **`approve all`** — proceed to Step 5 with classifications as-is.
   - **`modify`** — enter override loop: per-cluster `AskUserQuestion` to pick a
     cluster and re-set its status (`operational-note`, `already-fixed`, `tracked`,
     `possibly-tracked`, `draft`). Re-render table after each override and
     re-prompt. Continue until user selects `approve all` or `abort`.
   - **`abort`** — stop the pipeline; no `gh issue create`, no log mutation.

   On `approve all`: write the confirmed status set to
   `/tmp/harvest-approved-classifications-$$.json` for audit, then proceed to
   Step 5.

   `possibly-tracked` confirmation (the old per-cluster confirm prompt) is
   subsumed into the modify loop in this step.

5. **Compose draft issues.** For every `status === 'draft'` cluster (including
   any `possibly-tracked` clusters the user re-promoted to `draft` in Step 4):
   - **Title:** `<skill>: <summary>` (from the cluster header).
   - **Body:** the cluster `bodyLines`, followed by a blank line and the footer
     `Source: learnings/log.md (lines <sourceStartLine>–<sourceEndLine>, harvested <harvestDate>)`.

6. **Approval loop.** For each draft, present the title + body via
   `AskUserQuestion` with options `approve` / `skip` / `edit`. On `edit`, allow
   the user to revise the title and/or body (single-pass — no nested
   sub-prompts). Track approved and rejected cluster ids. Loop until every
   cluster is resolved.

7. **Dry-run short-circuit.** If `--dry-run` was passed (drafts JSON has
   `dryRun === true`), print the approved drafts and stop. **No `gh issue
   create`. No log mutation.**

8. **Create issues.** Before the create loop, ensure the `harvested` label
   exists with one idempotent call:
   ```bash
   gh label create harvested --color FFA500 \
     --description "Auto-created by /harvest-learnings" --force 2>/dev/null || true
   ```
   Then for each approved draft, run:
   ```bash
   gh issue create --title <T> --body <B> --label harvested
   ```
   No `--repo` flag — `gh` resolves the target via the cwd's origin or
   `gh repo set-default`. Capture the issue numbers returned. If any
   `gh issue create` invocation fails, surface the failure (and any partial
   successes) to the user and **skip Step 9** so the user can re-run after
   resolving the failure. Do NOT include the failed cluster's id in
   `processedClusterIds` (Step 9) — the draft must remain in the log
   for retry.

9. **Commit log mutation.** After all approved issues are created
   successfully, build the full processed-id list:
   ```
   processedClusterIds = [
     ...approvedDraftIds,        // issues created in Step 8
     ...rejectedDraftIds,        // user said "skip" in Step 6
     ...operationalNoteIds,      // silently filtered in Step 3
     ...alreadyFixedIds,         // silently filtered in Step 3
     ...trackedIds,              // silently filtered in Step 3
     ...possiblyTrackedDupeIds,  // user confirmed duplicate in Step 4
   ]
   ```
   Write a temp file at `/tmp/harvest-processed-$$.json`:
   ```json
   { "processedClusterIds": ["<id1>", "<id2>", ...] }
   ```
   Then run:
   ```bash
   node <helper-path> --commit <tmpfile>
   ```
   The helper atomically rewrites `log.md`, removing the line ranges of ALL
   processed clusters — not just approved drafts.

10. **Close stale harvested issues.**
    1. Run `node "$HELPER_PATH" --close-stale`. Capture stdout = tmpfile path.
       Read the closures JSON.
    2. If `closures.length === 0`, skip to Step 11.
    3. Present each closure (issue number, title, reason) via `AskUserQuestion`
       with options `approve all` / `approve individual` / `skip all`. On
       `approve individual`, loop per closure with `approve` / `skip`.
    4. For each approved closure:
       ```bash
       gh issue close <num> --comment "<reason>"
       ```
       Capture failures, surface to user, do not abort the pipeline.

11. **Summary.** Print:
    ```
    created N issues, skipped M tracked, skipped P operational-notes,
    skipped Q already-fixed, skipped K rejected, closed S stale, X remain in log
    ```

## DO NOT

- Call `gh issue create` before the user explicitly approves a draft (Step 6).
- Call `gh issue create` before the user has approved the full classification
  plan in Step 4.
- Run `gh issue close` before the user explicitly approves a closure entry
  in Step 10.
- Mutate `log.md` (run `--commit`) before every approved `gh issue create`
  has succeeded — partial-failure path skips Step 9 entirely.
- Pass `--repo` to `gh issue create` or `gh issue list`. The helper and
  command rely on `gh`'s cwd-resolution (`origin` / `gh repo set-default`).
- Silently re-classify any cluster; every status override must be explicit
  user input via the Step 4 modify loop.
