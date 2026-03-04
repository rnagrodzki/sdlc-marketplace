---
description: Create or update a pull request with an auto-generated description from commits and diffs
allowed-tools: [Read, Glob, Grep, Bash, Skill]
argument-hint: "[--draft] [--update] [--base <branch>]"
---

# /pr Command

Create or update a pull request on the current branch with a description
auto-generated from commit history and diffs. Uses the Conventional PR format.

Auto-detects whether a PR already exists: if one does, updates it; otherwise
creates a new one.

## Usage

- `/pr` — Auto-detect: create a new PR or update the existing one
- `/pr --draft` — Create a draft PR (new PRs only)
- `/pr --update` — Force update mode (error if no PR exists for this branch)
- `/pr --base develop` — Target a specific base branch

## Workflow

### Step 1: Run the Pre-processing Script

Locate the script:

```text
**/sdlc-utilities/scripts/pr-prepare.js
```

Build the command from the arguments passed to this command:

```bash
# Write to temp file — large diffs (100KB+) break shell pipes
PR_CONTEXT_FILE=$(mktemp /tmp/pr-context-XXXXXX.json)
node <script-path>/pr-prepare.js $ARGUMENTS > "$PR_CONTEXT_FILE"
EXIT_CODE=$?
```

Read and parse `PR_CONTEXT_FILE` as `PR_CONTEXT_JSON`. Clean up the file after the PR is created or cancelled:

```bash
rm -f "$PR_CONTEXT_FILE"
```

**On non-zero `EXIT_CODE`:**

- Exit code 1: The JSON still contains an `errors` array. Show each error to the user and stop.
- Exit code 2: Show `Script error — see output above` and stop.

**If `PR_CONTEXT_JSON.errors` is non-empty**, show each error message and stop.

**If `PR_CONTEXT_JSON.warnings` is non-empty**, show the warnings to the user before continuing.
Ask them to confirm if they want to proceed (particularly for uncommitted changes).

### Step 2: Delegate to Skill

Invoke the `creating-pull-requests` skill, passing `PR_CONTEXT_JSON` as the
pre-computed context. The skill handles everything from here: description
generation, self-critique, user review, and PR creation or update.
