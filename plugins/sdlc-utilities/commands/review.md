---
description: Run multi-dimension code review on the current branch using project-defined review dimensions
allowed-tools: [Glob, Bash, Skill, Agent]
argument-hint: "[--base <branch>] [--committed] [--staged] [--working] [--dimensions <name,...>] [--dry-run]"
---

# /review Command

Create or run multi-dimension code review on the current branch using
project-defined review dimensions.

## Usage

- `/sdlc:review` — Review committed branch changes + staged changes (default)
- `/sdlc:review --committed` — Review only committed branch changes (excludes staged)
- `/sdlc:review --staged` — Review only staged changes vs HEAD
- `/sdlc:review --working` — Review all uncommitted changes vs HEAD (staged + unstaged)
- `/sdlc:review --base develop` — Diff against a specific base branch
- `/sdlc:review --dimensions security,performance` — Restrict to named dimensions only
- `/sdlc:review --dry-run` — Show the review plan without dispatching subagents

## Workflow

### Step 1: Run the Pre-processing Script

Locate and run the script:

```bash
# Resolve script: check installed plugin location first, then fall back to project tree
SCRIPT=$(find ~/.claude/plugins -name "review-prepare.js" -path "*/scripts/*" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && SCRIPT=$(find . -name "review-prepare.js" -path "*/scripts/*" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate review-prepare.js. Is the sdlc plugin installed?" >&2; exit 2; }

# Write to temp file — large manifests (100KB+) break shell pipes
MANIFEST_FILE=$(mktemp /tmp/review-manifest-XXXXXX.json)
node "$SCRIPT" $ARGUMENTS --json > "$MANIFEST_FILE"
EXIT_CODE=$?
```

Read and parse `MANIFEST_FILE` as `MANIFEST_JSON`. Clean up the file after the review completes or is cancelled:

```bash
rm -f "$MANIFEST_FILE"
```

**On non-zero `EXIT_CODE`:**

- Exit code 1: show the stderr message to the user and stop.
- Exit code 2: show `Script error — see output above` and stop.

### Step 2: Delegate to Skill

Invoke the `sdlc-reviewing-changes` skill, passing `MANIFEST_JSON` as the
pre-computed context. The skill handles everything from here: uncommitted
changes warning, dry-run display, orchestrator dispatch, and temp file cleanup.
