---
name: validate-plugin-consistency
description: "Use after modifying any file under plugins/sdlc-utilities/ (commands/*.md, skills/*/SKILL.md, scripts/*.js). Runs the consistency validation script to catch structural issues before they reach users: wrong script resolution order, skills running scripts they shouldn't, missing frontmatter fields, missing docs, missing temp-file safety."
user-invocable: true
---

# Validate Plugin Consistency

After modifying the `sdlc-utilities` plugin, run this validation to catch structural
issues that would cause failures in users' repositories.

## When to Use

Invoke this skill when you have modified any of:

- `plugins/sdlc-utilities/commands/*.md`
- `plugins/sdlc-utilities/skills/*/SKILL.md`
- `plugins/sdlc-utilities/scripts/*.js`

## Step 1 — Run the Validation Script

```bash
node .claude/skills/validate-plugin-consistency/check-consistency.js
```

If the script exits 0: all checks pass — proceed.

If the script exits 1: fix each issue before finishing the task (see Step 2).

If the script exits 2: run from the repository root or pass `--project-root <path>`.

## Step 2 — Fix Issues Found

For each finding, apply the appropriate fix:

### `script-resolution-order` (error)

The `find` pattern searches CWD (`.`) before `~/.claude/plugins`. Reverse the order:

```bash
# Correct (plugins-first)
SCRIPT=$(find ~/.claude/plugins -name "<script>.js" -path "*/scripts/*" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && SCRIPT=$(find . -name "<script>.js" -path "*/scripts/*" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate <script>.js. Is the sdlc plugin installed?" >&2; exit 2; }
```

### `command-runs-script` (error)

A command has a matching `*-prepare.js` but doesn't run it — it delegates that
responsibility to the skill. Move the find+mktemp+node block into the command and
have the skill consume pre-computed JSON instead. Follow the pattern in `pr.md`:

1. Command: find script → mktemp → `node "$SCRIPT" $ARGUMENTS --json > "$FILE"` → read → delegate to skill with parsed JSON
2. Skill: receive pre-computed context in Step 1, no bash execution

### `skill-receives-context` (error)

A skill is executing a prepare script that its paired command should run instead.
Remove the find+node block from the skill and add a "Consume Pre-computed Context"
step explaining the command has already run the script.

### `argument-passthrough` (warning)

A command runs a prepare script but doesn't use `$ARGUMENTS`. Change the node
invocation to: `node "$SCRIPT" $ARGUMENTS --json > "$MANIFEST_FILE"`

### `frontmatter-field-names` (error)

A skill uses the deprecated `user-invokable` field. Replace with `user-invocable`.

### `command-docs-exist` (warning)

Create `docs/commands/<name>.md` using `docs/command-template.md` as the starting point.

### `temp-file-pattern` (error)

A command pipes node output directly instead of using a temp file. Replace with:

```bash
MANIFEST_FILE=$(mktemp /tmp/<name>-XXXXXX.json)
node "$SCRIPT" $ARGUMENTS --json > "$MANIFEST_FILE"
EXIT_CODE=$?
```

### `exit-code-handling` (error)

A command runs a script but doesn't capture `EXIT_CODE`. Add after the node call:

```bash
EXIT_CODE=$?
# ...then check:
# Exit code 1: show the stderr message to the user and stop.
# Exit code 2: show `Script error — see output above` and stop.
```

## Step 3 — Re-run Validation

After fixing all issues:

```bash
node .claude/skills/validate-plugin-consistency/check-consistency.js
```

Confirm exit 0 before marking work complete.

## Reference: The Correct Command Pattern

Every command that has a matching `*-prepare.js` script must follow this exact pattern:

```bash
# Step 1: Resolve the script
SCRIPT=$(find ~/.claude/plugins -name "<name>-prepare.js" -path "*/scripts/*" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && SCRIPT=$(find . -name "<name>-prepare.js" -path "*/scripts/*" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate <name>-prepare.js. Is the sdlc plugin installed?" >&2; exit 2; }

# Step 2: Run to temp file (large output breaks pipes)
CONTEXT_FILE=$(mktemp /tmp/<name>-context-XXXXXX.json)
node "$SCRIPT" $ARGUMENTS --json > "$CONTEXT_FILE"
EXIT_CODE=$?
# Cleanup: rm -f "$CONTEXT_FILE" after use

# Step 3: Handle errors
# Exit code 1: show stderr, stop
# Exit code 2: show "Script error — see output above", stop

# Step 4: Delegate to skill with parsed JSON
# Invoke sdlc-<doing>-<noun> skill, passing CONTEXT_JSON
```
