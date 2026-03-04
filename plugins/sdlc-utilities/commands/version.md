---
description: Bump the project version, create a git tag, optionally generate a CHANGELOG entry, and push the release
allowed-tools: [Read, Edit, Write, Glob, Grep, Bash, Skill]
argument-hint: "[major|minor|patch] [--init] [--pre <label>] [--no-push] [--changelog]"
---

# /version Command

Manages semantic versioning for the current project. Bumps the version in
the configured version file (or uses git tags as source of truth), creates
an annotated git tag, optionally generates a Keep a Changelog entry, and
pushes the release to origin.

Run `/sdlc:version --init` once to configure versioning for the project.
Subsequent runs read `.claude/version.json` and skip auto-detection.

## Usage

- `/sdlc:version --init` — Set up versioning for this project (run once)
- `/sdlc:version` — Bump version (type auto-detected from conventional commits)
- `/sdlc:version patch` — Bump patch version (1.2.3 → 1.2.4)
- `/sdlc:version minor` — Bump minor version (1.2.3 → 1.3.0)
- `/sdlc:version major` — Bump major version (1.2.3 → 2.0.0)
- `/sdlc:version minor --pre beta` — Create pre-release (1.2.3 → 1.3.0-beta.1)
- `/sdlc:version --pre rc` — Increment existing pre-release (1.0.0-rc.1 → 1.0.0-rc.2)
- `/sdlc:version patch --changelog` — Bump and generate CHANGELOG entry
- `/sdlc:version minor --no-push` — Bump and tag locally, skip push

## Workflow

### Step 1: Run the Pre-processing Script

Locate and run the script:

```bash
# Resolve script: check installed plugin location first, then fall back to project tree
SCRIPT=$(find ~/.claude/plugins -name "version-prepare.js" -path "*/scripts/*" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && SCRIPT=$(find . -name "version-prepare.js" -path "*/scripts/*" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate version-prepare.js. Is the sdlc plugin installed?" >&2; exit 2; }

# Write to temp file to handle large output safely
VERSION_CONTEXT_FILE=$(mktemp /tmp/version-context-XXXXXX.json)
node "$SCRIPT" $ARGUMENTS > "$VERSION_CONTEXT_FILE"
EXIT_CODE=$?
```

Read and parse `VERSION_CONTEXT_FILE` as `VERSION_CONTEXT_JSON`. Clean up the temp file after the release completes or is cancelled:

```bash
rm -f "$VERSION_CONTEXT_FILE"
```

**On non-zero `EXIT_CODE`:**

- Exit code 1: The JSON still contains an `errors` array. Show each error to the user and stop.
- Exit code 2: Show `Script error — see output above` and stop.

**If `VERSION_CONTEXT_JSON.errors` is non-empty**, show each error message and stop.

**If `VERSION_CONTEXT_JSON.warnings` is non-empty**, show the warnings to the user before continuing.
For the warning `"You have uncommitted changes"`, ask the user to confirm they want to proceed.

### Step 2: Delegate to Skill

Invoke the `sdlc-versioning-releases` skill, passing `VERSION_CONTEXT_JSON` as the
pre-computed context. The skill handles everything from here: init setup or release
execution, version bump, changelog generation, user confirmation, and git operations.
