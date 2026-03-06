---
name: sdlc-validating-plugin-discovery
description: "Use this skill when validating the plugin discovery chain after the /sdlc:plugin-check command has run the validation script. Consumes pre-computed REPORT_JSON and displays results, guiding fixes for any broken cross-references, missing manifests, or undiscoverable commands, skills, scripts, hooks, or agents. Triggers on: validate plugin, check plugin discovery, plugin health check, plugin structure, marketplace manifest."
user-invocable: false
---

# Validating Plugin Discovery

Validates that the plugin's full discovery and cross-reference chain is intact — from
marketplace manifest through plugin manifests to every command, skill, script, hook,
and agent — so the plugin works correctly after installation.

## Inputs

The `/sdlc:plugin-check` command has already run `validate-discovery.js` and read the
JSON output into `REPORT_JSON`. Key fields:

```
REPORT_JSON.overall          — "pass" or "fail"
REPORT_JSON.summary          — { total, pass, fail, total_errors, total_warnings }
REPORT_JSON.checks           — array of check results (see below)
```

Each check in `REPORT_JSON.checks`:

```
{ id, check, status, severity, message, details }
  id       — "PD1" through "PD16"
  check    — machine-readable check name
  status   — "pass", "fail", or "skip"
  severity — "error" or "warning"
  message  — human-readable summary
  details  — array of specific issue strings (empty on pass)
```

## Step 1 — Display Summary

Show the overall status and summary counts:

```
Plugin discovery check: X error(s), Y warning(s)
pass: N/16  fail: M/16
```

If `overall` is `"pass"`, show a success message and stop — no further action needed.

## Step 2 — Report Failed Checks

For each check where `status === "fail"`, show:

- Check ID and name
- Severity (ERROR or WARNING)
- Message
- All entries in `details` (these are the specific file/line issues)

Group errors before warnings for priority.

## Step 3 — Fix Issues

For each failed check, apply the fix described below, then re-run validation (Step 4).

### PD1 — `marketplace-manifest-exists`

Create `.claude-plugin/marketplace.json` at the repository root:

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "<marketplace-name>",
  "description": "...",
  "owner": { "name": "<github-username>" },
  "plugins": [
    { "name": "<plugin-name>", "source": "./plugins/<plugin-dir>" }
  ]
}
```

### PD2 — `marketplace-schema-reference`

Add `"$schema": "https://anthropic.com/claude-code/marketplace.schema.json"` as the
first field in `.claude-plugin/marketplace.json`.

### PD3 — `marketplace-required-fields`

Ensure `.claude-plugin/marketplace.json` has both `"name"` (string) and `"plugins"`
(non-empty array) fields at the root level.

### PD4 — `plugin-source-paths-valid`

Each plugin entry's `source` must resolve to a directory containing
`.claude-plugin/plugin.json`. Either fix the `source` path in `marketplace.json`
or create the missing `plugin.json`.

### PD5 — `name-consistency`

The `name` in each `marketplace.json` plugin entry must exactly match the `name`
in the corresponding `plugin.json`. Mismatch causes "plugin not found" errors on
update. Fix the value in whichever file is wrong — but note that changing `plugin.json`
`name` renames all commands and skills for existing users.

### PD6 — `plugin-required-fields`

Add the missing field(s) to `plugin.json`:

```json
{
  "name": "<plugin-name>",
  "description": "...",
  "version": "0.1.0",
  "author": { "name": "..." }
}
```

### PD7 — `semver-format`

Fix the `version` field to use semantic versioning format: `MAJOR.MINOR.PATCH`
or `MAJOR.MINOR.PATCH-prerelease` (e.g., `1.0.0`, `0.6.3`, `2.0.0-rc.1`).

### PD8 — `commands-discoverable`

Every `.md` file in `commands/` must have YAML frontmatter with a `description`:

```yaml
---
description: "Short description shown in the /plugin command list"
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Skill]
---
```

### PD9 — `command-skill-refs-valid`

A command references a skill via `Invoke the \`<skill-name>\` skill` but the skill
directory `skills/<skill-name>/SKILL.md` does not exist. Either:

- Create the missing skill directory and `SKILL.md`, or
- Fix the skill name in the command to match an existing skill

### PD10 — `command-script-refs-valid`

A command uses `find -name "<script>.js"` but `scripts/<script>.js` does not exist.
Either create the missing script or fix the filename in the command.

### PD11 — `skills-discoverable`

Every skill directory must have a `SKILL.md` with `name` and `description` in
YAML frontmatter:

```yaml
---
name: skill-name
description: "When Claude should invoke this skill..."
---
```

### PD12 — `skill-supporting-files-exist`

A `SKILL.md` references a sibling supporting file by name (e.g., REFERENCE.md or EXAMPLES.md
in the See Also section) but the file does not exist in the skill directory.
Either create the missing file or remove the reference from the skill.

### PD13 — `skill-agent-refs-valid`

A skill references an agent (via `agents/<name>` path or `` `<name>` agent ``) but
`agents/<name>.md` does not exist. Either create the agent file or fix the reference.

### PD14 — `skill-script-refs-valid`

A skill's `SKILL.md` contains `find -name "<script>.js"` but the script does not
exist in `scripts/`. Create the missing script or fix the filename.

### PD15 — `hooks-valid-json`

`hooks/hooks.json` is missing or contains invalid JSON. Create it with valid JSON:

```json
{ "hooks": {} }
```

Or fix the JSON syntax error reported in the details.

### PD16 — `agents-discoverable`

Agent `.md` files must have frontmatter with `name`, `description`, and `tools`:

```yaml
---
name: agent-name
description: What this agent does and when to invoke it.
tools: Read, Glob, Grep, Bash, Agent
---
```

## Step 4 — Re-validate

After fixing all issues, re-run the check:

```bash
SCRIPT=$(find ~/.claude/plugins -name "validate-discovery.js" -path "*/scripts/*" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && SCRIPT=$(find . -name "validate-discovery.js" -path "*/scripts/*" 2>/dev/null | head -1)
node "$SCRIPT" --project-root . --markdown
```

Confirm all checks show `✓ pass` before marking work complete.

## DO NOT

- Do not change `plugin.json` `name` without understanding the impact on existing users —
  it renames every command and skill in the plugin
- Do not skip WARNING-severity checks — they indicate fragile cross-references that
  will likely break as the plugin evolves
- Do not mark work complete until Step 4 shows zero errors

## See Also

- `docs/plugin-installation.md` — explains how discovery works end-to-end
- `docs/architecture.md` — manifest field reference and name resolution details
- `.claude/skills/validate-plugin-consistency/` — complementary check for internal code conventions
