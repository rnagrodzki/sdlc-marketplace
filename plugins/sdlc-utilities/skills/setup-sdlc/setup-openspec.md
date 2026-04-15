# OpenSpec Enrichment Sub-Flow

Enriches `openspec/config.yaml` with a managed block pointing contributors to
`/plan-sdlc`, `/execute-plan-sdlc`, and `/ship-sdlc`. Idempotent: re-running
at the current plugin version is a no-op.

> **Permission context:** This sub-flow inherits the parent skill's permission mode.
> Do NOT call ExitPlanMode, change permission settings, or exit any mode during this sub-flow.

---

## Arguments

- `--remove` — remove the managed block instead of adding/updating it

---

## Workflow

### Step 1 — Run openspec-enrich.js

Locate and run the enrichment script:

```bash
SCRIPT=$(find ~/.claude/plugins -name "openspec-enrich.js" -path "*/sdlc*/scripts/util/openspec-enrich.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/util/openspec-enrich.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/util/openspec-enrich.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate util/openspec-enrich.js" >&2; exit 2; }

PREPARE_OUTPUT_FILE=$(node "$SCRIPT" --output-file {REMOVE_FLAG} --project-root .)
EXIT_CODE=$?
echo "PREPARE_OUTPUT_FILE=$PREPARE_OUTPUT_FILE"
echo "EXIT_CODE=$EXIT_CODE"
```

Replace `{REMOVE_FLAG}` with `--remove` if the parent passed `--remove-openspec`, otherwise omit it.

### Step 2 — Parse and report

Parse the JSON output from `$PREPARE_OUTPUT_FILE`. Report the result:

- `action: "append"` — "Managed block added to openspec/config.yaml."
- `action: "update"` — "Managed block updated to v{version} in openspec/config.yaml."
- `action: "unchanged"` — "openspec/config.yaml already at current version — no changes needed."
- `action: "removed"` — "Managed block removed from openspec/config.yaml."
- `action: "missing"` — "openspec/config.yaml not found. Initialize OpenSpec first (`openspec init`)."

If a `warning` field is present, display it.

Return to the parent skill (Step 5 summary).
