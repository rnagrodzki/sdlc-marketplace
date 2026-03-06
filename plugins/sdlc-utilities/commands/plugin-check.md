---
description: Validate the plugin discovery chain — marketplace manifest, plugin manifests, commands, skills, scripts, hooks, and agents
allowed-tools: [Read, Glob, Grep, Bash, Skill]
argument-hint: "[--markdown]"
---

# /plugin-check Command

Validates that the plugin is correctly wired for post-installation discovery.
Checks every manifest, cross-reference, and file path that Claude Code needs to
load commands, invoke skills, run scripts, fire hooks, and delegate to agents.

## Usage

```text
/sdlc:plugin-check
/sdlc:plugin-check --markdown
```

## Workflow

### Step 1: Run the Validation Script

Locate and run `validate-discovery.js`:

```bash
# Resolve script: check installed plugin location first, then fall back to project tree
SCRIPT=$(find ~/.claude/plugins -name "validate-discovery.js" -path "*/scripts/*" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && SCRIPT=$(find . -name "validate-discovery.js" -path "*/scripts/*" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate validate-discovery.js. Is the sdlc plugin installed?" >&2; exit 2; }

# Write to temp file — output can be large
REPORT_FILE=$(mktemp /tmp/discovery-report-XXXXXX.json)
node "$SCRIPT" --project-root . $ARGUMENTS --json > "$REPORT_FILE"
EXIT_CODE=$?
```

Read and parse `REPORT_FILE` as `REPORT_JSON`. Clean up after:

```bash
rm -f "$REPORT_FILE"
```

**On `EXIT_CODE`:**

- Exit code 1: Issues were found — `REPORT_JSON` is valid and contains `checks` with
  `status: "fail"` entries. **Continue to Step 2** (the skill displays and fixes them).
- Exit code 2: Script error — show `Script error — see output above` and stop.

### Step 2: Delegate to Skill

Invoke the `sdlc-validating-plugin-discovery` skill, passing `REPORT_JSON` as the
pre-computed validation report. The skill handles display, remediation guidance,
and re-validation.
