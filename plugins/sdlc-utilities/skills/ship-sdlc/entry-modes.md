# Ship Pipeline — Entry-Mode Handlers

On-demand companion for `ship-sdlc/SKILL.md` (implements R-progressive-disclosure). These handlers short-circuit the pipeline — they run instead of the normal `ship it` flow. Read this file only when the corresponding flag is passed; never preemptively.

## --init-config handler

If `--init-config` was passed:

**Redirect:** Suggest running `/setup-sdlc` instead for unified configuration. If user insists on `--init-config`, proceed with the existing walkthrough.

1. Read `./config-format.md` and run the interactive walkthrough to collect the user's answers (steps multi-select, bump type, auto, threshold, workspace isolation).
   After the `steps[]` selection, offer the optional `--quick` profile prompt (R-quick-7):
   > "Would you like to define a `--quick` profile? Select steps that form your shortened pipeline, or skip to omit."
   If the user selects steps, capture them. If the user skips, omit the `--quick` flag when calling `ship-init.js`.
2. Locate and call `ship-init.js` via Bash with the collected answers (append `--quick <csv>` only when the user made a quick-profile selection):
```bash
SCRIPT=$(find ~/.claude/plugins -name "ship-init.js" -path "*/sdlc*/scripts/util/ship-init.js" 2>/dev/null | sort -V | tail -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/util/ship-init.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/util/ship-init.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate util/ship-init.js. Is the sdlc plugin installed?" >&2; exit 2; }

INIT_OUTPUT_FILE=$(node "$SCRIPT" --output-file --steps execute,commit,review,archive-openspec,pr --bump patch --auto --threshold high --workspace prompt)
EXIT_CODE=$?
echo "INIT_OUTPUT_FILE=$INIT_OUTPUT_FILE"
echo "EXIT_CODE=$EXIT_CODE"
# Single canonical cleanup: trap fires unconditionally on EXIT/INT/TERM.
trap 'rm -f "$INIT_OUTPUT_FILE"' EXIT INT TERM
```
3. Parse the output JSON from `$INIT_OUTPUT_FILE`:
   - If `errors` is non-empty, display them and stop.
   - Otherwise display the `created` files list and `config` JSON for user confirmation.
4. Stop. No pipeline execution.

## --gc handler (R39, issue #223)

If `--gc` (with optional `--ttl-days <N>`) was passed, run `skill/ship.js --gc` and stop — no pipeline composition. The prepare script short-circuits: it scans `<main-worktree>/.sdlc/execution/` for stale ship- and execute- state files (older than TTL AND whose branch is no longer in `git branch --list`), removes them, and emits a JSON report.

```bash
SCRIPT=$(find ~/.claude/plugins -name "ship.js" -path "*/sdlc*/scripts/skill/ship.js" 2>/dev/null | sort -V | tail -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/skill/ship.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/skill/ship.js"
PREPARE_OUTPUT_FILE=$(node "$SCRIPT" --output-file --gc)  # add --ttl-days <N> when provided
trap 'rm -f "$PREPARE_OUTPUT_FILE"' EXIT INT TERM
```

Read the prepare output. The top-level `action` field will be `"gc"`; the `report` field contains `{ttlDays, ship: {deleted, kept}, execute: {deleted, kept}}`.

Print one line per file:
```
[deleted] ship-deletedbranch-20240101T000000Z.json — stale+branch-gone
[kept]    ship-main-20260505T120000Z.json — ttl-fresh
```

Then stop. Do not proceed to step 1b. The pipeline does not run.

## Dry-run mode

If `--dry-run`, display the full pipeline table and stop:
```
Ship Pipeline (dry run)
────────────────────────────────────────────────────────────────
Step  Skill                 Status       Args              Pause?
────────────────────────────────────────────────────────────────
1     execute-plan-sdlc     will run     (none)             no
2     commit-sdlc           will run     --auto            no
3     review-sdlc           will run     --committed       no
4     received-review-sdlc  conditional  (if crit/high)    YES
5     commit-sdlc (fixes)   conditional  --auto            no
6     version-sdlc          skipped      —                 —
7     pr-sdlc               will run     --auto --draft    no
────────────────────────────────────────────────────────────────
Review threshold: critical or high findings trigger fix loop
Interactive pauses: received-review (if triggered)
```
