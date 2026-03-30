---
name: setup-sdlc
description: "Use this skill when setting up the SDLC plugin for a project, initializing configuration, or when any skill reports missing config. Handles unified config creation (.claude/sdlc.json), local config (.sdlc/local.json), and orchestrates content setup (review dimensions, PR template). Arguments: [--migrate] [--skip <section>] [--force]"
user-invocable: true
argument-hint: "[--migrate] [--skip <section>] [--force]"
---

# SDLC Setup

Unified setup skill that replaces the fragmented first-use experience. Detects existing
configuration, migrates legacy files, walks the user through missing sections, and
delegates content creation to specialized skills.

**Announce at start:** "I'm using setup-sdlc (sdlc v{sdlc_version})." -- extract the version from the `sdlc:` line in the session-start system-reminder. If no version is in context, omit the parenthetical.

---

## Arguments

| Flag | Description | Default |
|------|-------------|---------|
| `--migrate` | Force migration of legacy config files even if no legacy files are auto-detected | off |
| `--skip <section>` | Skip a config section during setup. Valid values: `version`, `ship`, `jira`, `review`, `content` | none |
| `--force` | Reconfigure all sections even if already configured | off |

---

## Plan Mode Check

If the system context contains "Plan mode is active":

1. Announce: "This skill requires write operations. Exit plan mode first, then re-invoke `/setup-sdlc`."
2. Stop. Do not proceed to subsequent steps.

---

## Workflow

### Step 0 -- Pre-flight

Run `setup-prepare.js` via Bash to get current state:

> **VERBATIM** -- Run this bash block exactly as written. Do not modify, rephrase, or simplify the commands.

```bash
SCRIPT=$(find ~/.claude/plugins -name "setup-prepare.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/setup-prepare.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/setup-prepare.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate setup-prepare.js" >&2; exit 2; }

PREPARE_OUTPUT_FILE=$(mktemp)
node "$SCRIPT" > "$PREPARE_OUTPUT_FILE"
EXIT_CODE=$?
echo "PREPARE_OUTPUT_FILE=$PREPARE_OUTPUT_FILE"
echo "EXIT_CODE=$EXIT_CODE"
```

Parse the JSON output from `$PREPARE_OUTPUT_FILE`. If exit code != 0, display the error and stop.

The JSON contains these top-level keys:
- `projectConfig` -- `{ exists, sections, path }`
- `localConfig` -- `{ exists, path }`
- `legacy` -- `{ version, ship, review, reviewLegacy, jira }` each with `{ exists, path }`
- `content` -- `{ reviewDimensions: { count, path }, prTemplate: { exists, path }, jiraTemplates: { count, path } }`
- `detected` -- `{ versionFile, fileType, tagPrefix, defaultBranch }`

---

### Step 1 -- Status Report

Display what is configured vs missing. Use this exact format:

```
SDLC Setup Status
---------------------------------------------------
Project config (.claude/sdlc.json):
  version:  [checkmark] configured / [x] not configured
  ship:     [checkmark] configured / [x] not configured (defaults work)
  jira:     [checkmark] configured / [x] not configured (optional)

Local config (.sdlc/local.json):
  review:   [checkmark] configured / [x] not configured (defaults work)

Content:
  Review dimensions:  N installed [checkmark] / [x] not installed (required for /review-sdlc)
  PR template:        installed [checkmark] / [x] not installed (optional, fallback exists)
  Jira templates:     N installed [checkmark] / [x] not installed (optional)

Legacy files found:
  .claude/version.json -- will migrate
  .sdlc/ship-config.json -- will migrate
  ...
```

Determine configured status:
- `version`: configured if `projectConfig.sections` includes `"version"`
- `ship`: configured if `projectConfig.sections` includes `"ship"`
- `jira`: configured if `projectConfig.sections` includes `"jira"`
- `review`: configured if `localConfig.exists` is true
- Review dimensions: installed if `content.reviewDimensions.count > 0`
- PR template: installed if `content.prTemplate.exists` is true
- Jira templates: installed if `content.jiraTemplates.count > 0`

Legacy files: list each legacy entry where `exists` is true. If none, omit the "Legacy files found" section.

**Early exit:** If everything is configured (all project config sections present, local config exists, review dimensions count > 0) and `--force` was NOT passed, print:

```
All configured. Use --force to reconfigure.
```

And stop.

---

### Step 2 -- Migration

**Skip this step if:** no legacy files were detected AND `--migrate` was NOT passed.

If legacy files exist, use AskUserQuestion:

> Legacy config files detected. Migrate to unified config before proceeding?

Options:
- **yes** -- migrate now (recommended)
- **no** -- configure from scratch

On **yes**: Run migration via inline Node.js that calls `migrateConfig()` from `lib/config.js`:

```bash
SCRIPT_DIR=$(find ~/.claude/plugins -name "config.js" -path "*/lib/config.js" 2>/dev/null | head -1 | xargs dirname 2>/dev/null)
[ -z "$SCRIPT_DIR" ] && [ -f "plugins/sdlc-utilities/scripts/lib/config.js" ] && SCRIPT_DIR="plugins/sdlc-utilities/scripts/lib"
[ -z "$SCRIPT_DIR" ] && { echo "ERROR: Could not locate lib/config.js" >&2; exit 2; }

node -e "
const { migrateConfig } = require('$SCRIPT_DIR/config.js');
const result = migrateConfig(process.cwd());
console.log(JSON.stringify(result, null, 2));
"
```

Parse the output. Report what was migrated:
- List each file from `migrated` array
- List each file from `conflicts` array with explanation: "Conflict: unified config already has this section -- legacy file was NOT merged"

Then use AskUserQuestion:

> Delete legacy config files?

Options:
- **yes** -- delete migrated files (keeps backup in git history)
- **no** -- keep legacy files alongside unified config

On **yes**: delete each file listed in `migrated` using Bash `rm`. Do NOT delete files listed in `conflicts`.

After migration, re-run `setup-prepare.js` (same bash block as Step 0) to refresh the state before proceeding to Step 3.

On **no** (configure from scratch): proceed directly to Step 3 without migration.

---

### Step 3 -- Config Builder

For each missing section (skip any section passed via `--skip`), interactively configure it. When `--force` is passed, treat all sections as missing (reconfigure everything).

Write config files via inline Node.js that calls `writeProjectConfig` and `writeLocalConfig` from `lib/config.js`. Resolve the script directory using the same pattern as Step 2.

#### 3a. Version section

Use the `detected` values from setup-prepare.js output to pre-fill. Use AskUserQuestion:

> Version configuration detected:
>   Version file: {detected.versionFile} ({detected.fileType})
>   Tag prefix: {detected.tagPrefix} (from existing tags)
>
> Confirm version setup?

Options:
- **yes** -- use detected settings
- **customize** -- change settings
- **skip** -- don't configure versioning

On **yes**: write version section with detected values:
```json
{
  "version": {
    "mode": "file",
    "versionFile": "{detected.versionFile}",
    "fileType": "{detected.fileType}",
    "tagPrefix": "{detected.tagPrefix}",
    "changelog": false
  }
}
```

If `detected.versionFile` is null (no version file detected), set `mode` to `"tag"` and omit `versionFile` and `fileType`.

On **customize**: ask about each field individually using AskUserQuestion:
1. **mode** -- `file` (version tracked in a file) or `tag` (version from git tags only). Required.
2. **versionFile** -- path to version file (only if mode is `file`)
3. **fileType** -- format: package.json, cargo.toml, pyproject.toml, pubspec.yaml, plugin.json, version-file (only if mode is `file`)
4. **tagPrefix** -- prefix for git tags (default: `v`)
5. **changelog** -- generate changelog on release? yes/no (default: no)
6. **changelogFile** -- path to changelog file (only if changelog is yes, default: `CHANGELOG.md`)

On **skip**: do not write a version section.

#### 3b. Ship section

Use AskUserQuestion for each setting. Note to the user: "Ship config is committed to `.claude/sdlc.json` (shared with the team). Previously it lived in gitignored `.sdlc/ship-config.json`."

Ask about each field:
1. **preset** -- Pipeline variant: A (full), B (skip version), C (minimal: execute + commit + PR). Default: A
2. **skip** -- Additional steps to skip (comma-separated). Valid: execute, commit, review, received-review, commit-fixes, version, pr. Default: none
3. **bump** -- Default version bump level: patch, minor, major. Default: patch
4. **draft** -- Open PRs as drafts? yes/no. Default: no
5. **auto** -- Run pipeline non-interactively? yes/no. Default: no
6. **workspace** -- Working environment: branch (current branch), worktree (isolated git worktree), prompt (ask each time). Default: branch
7. **rebase** -- Rebase before shipping? yes/no/prompt. Default: prompt
8. **reviewThreshold** -- Minimum severity that blocks pipeline: critical, high, medium. Default: high

Use AskUserQuestion with all options for each field. Collect answers and write the ship section.

#### 3c. Jira section

Use AskUserQuestion:

> Do you use Jira for this project?

Options:
- **yes** -- configure Jira integration
- **no** -- skip Jira setup

On **yes**: ask for the default project key (2-10 uppercase letters, e.g., PROJ). Write the jira section:
```json
{
  "jira": {
    "defaultProject": "PROJ"
  }
}
```

On **no**: do not write a jira section.

#### 3d. Review section (local config)

Use AskUserQuestion:

> Default review scope for /review-sdlc?

Options:
- **all** -- review all changes (staged + unstaged + untracked)
- **committed** -- only committed changes vs base branch
- **staged** -- only staged changes
- **working** -- staged + unstaged (no untracked)
- **worktree** -- all changes in the worktree

Default: committed

Write `.sdlc/local.json` with the review section:
```json
{
  "review": {
    "scope": "committed"
  }
}
```

#### Writing config files

After collecting all answers, write project config and local config in a single Bash call:

```bash
SCRIPT_DIR=$(find ~/.claude/plugins -name "config.js" -path "*/lib/config.js" 2>/dev/null | head -1 | xargs dirname 2>/dev/null)
[ -z "$SCRIPT_DIR" ] && [ -f "plugins/sdlc-utilities/scripts/lib/config.js" ] && SCRIPT_DIR="plugins/sdlc-utilities/scripts/lib"
[ -z "$SCRIPT_DIR" ] && { echo "ERROR: Could not locate lib/config.js" >&2; exit 2; }

node -e "
const { writeProjectConfig, writeLocalConfig } = require('$SCRIPT_DIR/config.js');
const projectRoot = process.cwd();

// Only include sections that were configured (not skipped)
const projectConfig = {};
// ... add version, ship, jira sections as collected ...

if (Object.keys(projectConfig).length > 0) {
  writeProjectConfig(projectRoot, projectConfig);
  console.log('Wrote .claude/sdlc.json');
}

const localConfig = { review: { scope: 'committed' } }; // use actual collected value
writeLocalConfig(projectRoot, localConfig);
console.log('Wrote .sdlc/local.json');
"
```

Replace the placeholder values with the actual collected answers. The `writeProjectConfig` and `writeLocalConfig` functions handle read-merge-write, so existing sections are preserved.

### Step 3b -- Validate Written Config

Re-run `setup-prepare.js` to verify the config files were written correctly:

```bash
node "$SCRIPT" > "$PREPARE_OUTPUT_FILE"
```

Parse the output and confirm:
- `projectConfig.exists` is `true` and `projectConfig.sections` includes the sections just written
- `localConfig.exists` is `true` (if review scope was configured)

If validation fails (sections missing or file unreadable), warn the user and offer to retry the config write. Do not proceed to content setup with invalid config.

---

### Step 4 -- Content Setup

Use AskUserQuestion with multiSelect:

> Content setup (optional):
>   1. Review dimensions -- required for /review-sdlc
>   2. PR template -- customized PR descriptions
>   3. Skip content setup

Options:
- **review-dimensions** -- install review dimensions (delegates to /review-init-sdlc)
- **pr-template** -- create PR template (delegates to /pr-customize-sdlc)
- **skip** -- skip content setup

On **review-dimensions**: invoke `/review-init-sdlc` via the Skill tool.

On **pr-template**: invoke `/pr-customize-sdlc` via the Skill tool.

On **skip**: proceed to Step 5.

If both are selected, invoke them sequentially: first `/review-init-sdlc`, then `/pr-customize-sdlc`.

---

### Step 5 -- Summary

Show what was created or updated:

```
Setup complete
---------------------------------------------------
Created/updated:
  .claude/sdlc.json      -- project config (version, ship, jira)
  .sdlc/local.json        -- local config (review scope)

Content:
  Review dimensions       -- [installed via /review-init-sdlc | skipped]
  PR template             -- [installed via /pr-customize-sdlc | skipped]

Migrated:
  .claude/version.json    -- merged into .claude/sdlc.json [deleted | kept]
  ...
```

Only show sections that were actually created, updated, or migrated. Omit sections that were skipped or unchanged.

---

## Idempotency

This skill is safe to re-run. Already-configured sections are skipped unless `--force` is passed. The `writeProjectConfig` and `writeLocalConfig` functions use read-merge-write, so re-running does not clobber existing config written by other skills.

---

## DO NOT

- Run `promptfoo eval` automatically
- Delete legacy files without explicit user confirmation via AskUserQuestion
- Modify review dimensions, PR template, or Jira templates directly -- delegate to `/review-init-sdlc`, `/pr-customize-sdlc`, and `/jira-sdlc` respectively via the Skill tool
- Write config files using the Write or Edit tools directly -- always go through `lib/config.js` functions (`writeProjectConfig`, `writeLocalConfig`) via inline Node.js in Bash
- Invoke sub-skills via the Agent tool -- use the Skill tool exclusively
- Skip AskUserQuestion for any user interaction -- do not print questions and wait for freeform input
- Assume `mode` for the version section -- it is a required field, always ask or detect

---

## Gotchas

**setup-prepare.js must run from the project root.** It uses `process.cwd()` to locate config files. If the working directory is wrong, detection will silently return empty results.

**The version section requires `mode` as a required field.** The JSON schema enforces this. When `detected.versionFile` is present, default to `mode: "file"`. When null, default to `mode: "tag"`. Always include `mode` in the written config.

**Ship config moved from gitignored to committed.** Previously ship config lived in `.sdlc/ship-config.json` (gitignored). The unified config at `.claude/sdlc.json` is committed to the repo. Mention this to the user during ship section setup so they are aware the config becomes shared with the team.

**Migration may find conflicts.** If both unified config (`.claude/sdlc.json`) and legacy files exist for the same section, the unified config wins. The `migrateConfig()` function reports these as `conflicts` -- display them to the user and explain that the legacy values were NOT merged.

**`writeProjectConfig` and `writeLocalConfig` do read-merge-write.** They will not clobber sections written by other skills. Each call merges the provided config into the existing file content. This makes it safe to write one section at a time.

**Legacy review config has two possible locations.** `.sdlc/review.json` and `.claude/review.json` are both legacy paths. `migrateConfig()` prefers `.sdlc/review.json` when both exist.

---

## Learning Capture

After completing setup or encountering unexpected behavior, append to `.claude/learnings/log.md`:

```
## YYYY-MM-DD -- setup-sdlc: <brief summary>
<what happened, what was learned>
```

Record entries for: projects with unusual version file locations, migration edge cases, legacy file conflicts, or user preferences that differ from defaults.

---

## See Also

- [`/version-sdlc`](../version-sdlc/SKILL.md) -- version bumps and release tags
- [`/ship-sdlc`](../ship-sdlc/SKILL.md) -- end-to-end feature shipping pipeline
- [`/review-init-sdlc`](../review-init-sdlc/SKILL.md) -- initialize review dimensions
- [`/pr-customize-sdlc`](../pr-customize-sdlc/SKILL.md) -- create custom PR template
- [`/review-sdlc`](../review-sdlc/SKILL.md) -- multi-dimension code review
- [`/jira-sdlc`](../jira-sdlc/SKILL.md) -- Jira integration
