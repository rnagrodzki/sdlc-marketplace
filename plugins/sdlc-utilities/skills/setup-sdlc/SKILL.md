---
name: setup-sdlc
description: "Use this skill when setting up the SDLC plugin for a project, initializing configuration, or when any skill reports missing config. Handles unified config creation (.claude/sdlc.json), local config (.sdlc/local.json), and orchestrates content setup (review dimensions, PR template, plan guardrails). Supports direct sub-flow entry via --dimensions, --pr-template, --guardrails. Arguments: [--migrate] [--skip <section>] [--force] [--dimensions] [--pr-template] [--guardrails] [--add] [--no-copilot]"
user-invocable: true
argument-hint: "[--migrate] [--skip <section>] [--force] [--dimensions] [--pr-template] [--guardrails] [--add] [--no-copilot]"
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
| `--skip <section>` | Skip a config section during setup. Valid values: `version`, `ship`, `jira`, `review`, `commit`, `pr`, `content` | none |
| `--force` | Reconfigure all sections even if already configured | off |
| `--dimensions` | Jump directly to review dimensions sub-flow (skip config builder) | off |
| `--pr-template` | Jump directly to PR template sub-flow (skip config builder) | off |
| `--guardrails` | Jump directly to plan guardrails sub-flow (skip config builder) | off |
| `--add` | Expansion mode (with --dimensions or --guardrails) | off |
| `--no-copilot` | Skip GitHub Copilot instructions (with --dimensions) | off |

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

PREPARE_OUTPUT_FILE=$(node "$SCRIPT" --output-file)
EXIT_CODE=$?
echo "PREPARE_OUTPUT_FILE=$PREPARE_OUTPUT_FILE"
echo "EXIT_CODE=$EXIT_CODE"
```

Parse the JSON output from `$PREPARE_OUTPUT_FILE`. If exit code != 0, display the error and stop.

**Flag routing (check after pre-flight succeeds):**

If `--dimensions` was passed:
1. Run the shared project scan phase (same scan defined in Step 4, scan phase).
2. Read and follow `@setup-dimensions.md`, passing the scan results as "Scan Input". Pass through `--add` and `--no-copilot` modifiers if present.
3. Jump to Step 5 (summary). Skip Steps 1–4.

If `--pr-template` was passed:
1. Run the shared project scan phase (same scan defined in Step 4, scan phase).
2. Read and follow `@setup-pr-template.md`, passing the scan results as "Scan Input". Pass through `--add` if present.
3. Jump to Step 5 (summary). Skip Steps 1–4.

If `--guardrails` was passed:
1. Read and follow `@setup-guardrails.md` (it runs its own guardrails-prepare.js script internally). Pass through `--add` if present.
2. Jump to Step 5 (summary). Skip Steps 1–4.

If none of `--dimensions`, `--pr-template`, or `--guardrails` was passed: continue with the full interactive flow (Steps 1–4) as normal.

The JSON contains these top-level keys:
- `projectConfig` -- `{ exists, sections, misplaced, path }`
- `localConfig` -- `{ exists, path }`
- `legacy` -- `{ version, ship, review, reviewLegacy, jira }` each with `{ exists, path }`
- `content` -- `{ reviewDimensions: { count, path }, prTemplate: { exists, path }, jiraTemplates: { count, path } }`
- `detected` -- `{ versionFile, fileType, tagPrefix, defaultBranch }`
- `needsMigration` -- boolean: `true` when any legacy file exists OR any misplaced section found in project config

---

### Step 1 -- Status Report

Display what is configured vs missing. Use this exact format:

```
SDLC Setup Status
---------------------------------------------------
Project config (.claude/sdlc.json):
  version:  [checkmark] configured / [x] not configured
  jira:     [checkmark] configured / [x] not configured (optional)
  commit:   [checkmark] configured / [x] not configured (optional)
  pr:       [checkmark] configured / [x] not configured (optional)

Local config (.sdlc/local.json):
  review:   [checkmark] configured / [x] not configured (defaults work)
  ship:     [checkmark] configured / [x] not configured (defaults work)

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
- `jira`: configured if `projectConfig.sections` includes `"jira"`
- `commit`: configured if `projectConfig.sections` includes `"commit"`
- `pr`: configured if `projectConfig.sections` includes `"pr"`
- `review`: configured if `localConfig.exists` is true
- `ship`: configured if `localConfig.exists` is true and local config includes a `"ship"` section
- Review dimensions: installed if `content.reviewDimensions.count > 0`
- PR template: installed if `content.prTemplate.exists` is true
- Jira templates: installed if `content.jiraTemplates.count > 0`

Legacy files: list each legacy entry where `exists` is true. If none, omit the "Legacy files found" section.

Misplaced sections: if `projectConfig.misplaced` is non-empty, display a warning:
```
Misplaced sections in project config:
  ship — should be in .sdlc/local.json (will migrate)
```

**Early exit:** If everything is configured (all project config sections present, local config exists, review dimensions count > 0) AND `needsMigration` is `false` AND `--force` was NOT passed, print:

```
All configured. Use --force to reconfigure.
```

And stop.

---

### Step 2 -- Migration

**Skip this step if:** `needsMigration` is `false` AND `--migrate` was NOT passed.

If legacy files exist or `projectConfig.misplaced` is non-empty, use AskUserQuestion:

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

Use AskUserQuestion for each setting. Note to the user: "Ship config is stored in `.sdlc/local.json` (developer-local, gitignored). Each developer has their own ship preferences."

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

#### 3e. Commit message patterns

Use AskUserQuestion:

> Do you enforce commit message patterns in this project?

Options:
- **conventional** -- Conventional commits: `type(scope): description`
- **ticket-prefix** -- Ticket prefix: `PROJ-123: description`
- **custom** -- Enter your own regex pattern
- **skip** -- Don't configure commit patterns

On **conventional**: Use AskUserQuestion for sequential refinement:

1. "Require scope?" -- yes / no → Determines `subjectPattern`:
   - yes: `^(feat|fix|refactor|chore|docs|test|ci)(\\(.*\\)): .+$`
   - no: `^(feat|fix|refactor|chore|docs|test|ci)(\\(.*\\))?: .+$`

2. "Allowed types?" -- multi-select (feat, fix, refactor, chore, docs, test, ci; all selected by default) → Updates regex `(type1|type2|...)`

3. "Allowed scopes?" -- free text comma-separated or skip → Adds scope constraint if provided:
   - If scopes provided: `^(types)(\\((scope1|scope2)\\)): .+$`
   - If skip: use pattern without scope constraint

4. "Require body for which types?" -- multi-select (feat, fix, or skip) → Sets `requiresBody` array

5. "Required trailers?" -- free text comma-separated (e.g., `Ticket`, `Reviewed-By`) or skip → Sets `trailers` array

Assemble the `commit` section object with the following fields:
```json
{
  "commit": {
    "subjectPattern": "regex-here",
    "subjectPatternError": "Commit subject must follow Conventional Commits format",
    "allowedTypes": ["feat", "fix", ...],
    "allowedScopes": ["scope1", "scope2"],
    "requiresBody": ["feat", "fix"],
    "trailers": ["Ticket", "Reviewed-By"]
  }
}
```

Only include optional fields if the user provided values. Omit empty arrays.

On **ticket-prefix**: Use AskUserQuestion for sequential refinement:

1. "Ticket pattern?" -- free text regex (default: `[A-Z]{2,10}-\\d+` for `PROJ-123`) → Sets `ticketPattern`

2. "Combine with conventional type?" -- yes / no:
   - yes: `subjectPattern` becomes `^PROJ-\\d+ (feat|fix|...)(\\(.*\\))?: .+$`
   - no: `subjectPattern` becomes `^PROJ-\\d+: .+$`

3. If combined with types, ask the same type/scope/body/trailer refinement questions as **conventional**.

Assemble the `commit` section with `ticketPattern` and `subjectPattern`.

On **custom**: Use AskUserQuestion:

1. "Enter your regex pattern for commit subject:" → free text → `subjectPattern`
2. "Enter error message if pattern doesn't match:" → free text → `subjectPatternError`

On **skip**: Do not write a commit section.

Store the assembled `commit` config for use in the "Writing config files" step.

#### 3f. PR title patterns

Use AskUserQuestion:

> Do you enforce PR title patterns?

Options:
- **same-as-commit** -- Use the same pattern as commit messages (only if Step 3e produced a config)
- **conventional** -- Conventional format for PR titles
- **ticket-prefix** -- Ticket prefix format
- **custom** -- Enter your own regex
- **skip** -- Don't configure PR title patterns

On **same-as-commit** (if available): Copy the commit config fields to PR config with renamed fields:
- `subjectPattern` → `titlePattern`
- `subjectPatternError` → `titlePatternError`
- Keep `allowedTypes`, `allowedScopes`, `requiresBody`, `trailers` as-is

Assemble the `pr` section:
```json
{
  "pr": {
    "titlePattern": "regex-from-commit",
    "titlePatternError": "PR title must follow Conventional Commits format"
  }
}
```

On **conventional**: Use sequential AskUserQuestion:

1. "Allowed types?" -- multi-select (feat, fix, refactor, chore, docs, test, ci; all selected by default)
2. "Require scope?" -- yes / no
3. "Allowed scopes?" -- free text comma-separated or skip
4. "Required trailers?" -- free text comma-separated or skip

Assemble the `pr` section with `titlePattern`, `titlePatternError`, `allowedTypes`, `allowedScopes`, `trailers`.

On **ticket-prefix**: Ask same questions as commit (ticket pattern, combine with types, etc.). Assemble `pr` section with `titlePattern`.

On **custom**: Ask:
1. "Enter your regex pattern for PR title:" → free text → `titlePattern`
2. "Enter error message if pattern doesn't match:" → free text → `titlePatternError`

On **skip**: Do not write a pr section.

Store the assembled `pr` config for use in the "Writing config files" step.

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
// ... add version, jira, commit, pr sections as collected ...

if (Object.keys(projectConfig).length > 0) {
  writeProjectConfig(projectRoot, projectConfig);
  console.log('Wrote .claude/sdlc.json');
}

const localConfig = { review: { scope: 'committed' } }; // use actual collected value
// ... add ship section to localConfig as collected ...
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

#### Scan Phase

Before presenting the content menu, collect all project signals needed by the sub-flows. Run the following in a single Bash block (or parallel where noted):

- **Dependency manifests:** Read `package.json`, `requirements.txt`, `Pipfile`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle` if present.
- **Framework config:** Check for `.eslintrc*`, `tsconfig.json`, `openapi.yaml`/`openapi.json`, `.prettierrc*`, `jest.config.*`, `vitest.config.*`.
- **Directory structure:** List top-level dirs and check for `src/`, `lib/`, `controllers/`, `services/`, `middleware/`, `models/`, `routes/`, `api/`, `pkg/`, `cmd/`, `internal/`.
- **CI/CD config:** Check for `.github/workflows/`, `Jenkinsfile`, `.circleci/`, `.gitlab-ci.yml`.
- **Database presence:** Check for ORM config files (`prisma/`, `migrations/`, `alembic.ini`, `db/migrate/`, `sequelize`, `typeorm`, `sqlalchemy`).
- **Test structure:** Check for `test/`, `tests/`, `spec/`, `__tests__/`, `cypress/`, `playwright.config.*`.
- **Existing review dimensions:** List files in `.claude/review-dimensions/` (count and names).
- **Existing guardrails:** Read `sdlc.json` → `plan.guardrails` array if present.
- **GitHub hosting detection:** Check `git remote -v` for `github.com`, check if `gh` CLI is available, check for `.github/` directory.
- **CLAUDE.md / AGENTS.md:** Read if present at project root or `.claude/`.
- **GitHub PR template:** Check for `.github/PULL_REQUEST_TEMPLATE.md` or `.github/pull_request_template.md`.
- **Recent PRs:** Run `gh pr list --limit 5 --json title,body` if `gh` CLI is available.
- **Existing PR template:** Check for `.claude/pr-template.md`.
- **JIRA evidence:** Check current branch name and recent commit subjects for ticket patterns (e.g., `[A-Z]{2,10}-\d+`).

Collect all signals into a "Scan Input" object to pass to sub-flows.

#### Content Menu

Use AskUserQuestion with multiSelect:

> Content setup (optional):
>   1. Review dimensions -- required for /review-sdlc
>   2. PR template -- customized PR descriptions
>   3. Plan guardrails -- custom rules for /plan-sdlc critique phases
>   4. All (dimensions → guardrails → PR template)
>   5. Skip content setup

Options:
- **review-dimensions** -- install review dimensions
- **pr-template** -- create PR template
- **plan-guardrails** -- configure plan guardrails
- **all** -- run all three sequentially
- **skip** -- skip content setup

On **review-dimensions**: Read and follow `@setup-dimensions.md`, passing the scan results as "Scan Input".

On **pr-template**: Read and follow `@setup-pr-template.md`, passing the scan results as "Scan Input".

On **plan-guardrails**: Read and follow `@setup-guardrails.md` (it runs guardrails-prepare.js internally).

On **all**: Run sequentially in this order: read and follow `@setup-dimensions.md` (passing scan results), then `@setup-guardrails.md`, then `@setup-pr-template.md` (passing scan results).

On **skip**: proceed to Step 5.

---

### Step 5 -- Summary

Show what was created or updated:

```
Setup complete
---------------------------------------------------
Created/updated:
  .claude/sdlc.json      -- project config (version, jira)
  .sdlc/local.json        -- local config (review, ship)

Content:
  Review dimensions       -- [installed via dimensions sub-flow | skipped]
  PR template             -- [installed via PR template sub-flow | skipped]
  Plan guardrails         -- [N configured via guardrails sub-flow | skipped]

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
- Invoke removed skills (`/review-init-sdlc`, `/pr-customize-sdlc`, `/guardrails-init-sdlc`) -- they no longer exist as standalone skills; use the sub-flows (`@setup-dimensions.md`, `@setup-pr-template.md`, `@setup-guardrails.md`) instead
- Modify Jira templates directly -- delegate to `/jira-sdlc` via the Skill tool
- Write config files using the Write or Edit tools directly -- always go through `lib/config.js` functions (`writeProjectConfig`, `writeLocalConfig`) via inline Node.js in Bash
- Invoke sub-skills via the Agent tool -- use the Skill tool exclusively
- Skip AskUserQuestion for any user interaction -- do not print questions and wait for freeform input
- Assume `mode` for the version section -- it is a required field, always ask or detect

---

## Gotchas

**setup-prepare.js must run from the project root.** It uses `process.cwd()` to locate config files. If the working directory is wrong, detection will silently return empty results.

**The version section requires `mode` as a required field.** The JSON schema enforces this. When `detected.versionFile` is present, default to `mode: "file"`. When null, default to `mode: "tag"`. Always include `mode` in the written config.

**Ship config is developer-local.** Ship preferences live in `.sdlc/local.json` (gitignored), not in `.claude/sdlc.json`. Each developer has their own ship preferences.

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
- [`/review-sdlc`](../review-sdlc/SKILL.md) -- multi-dimension code review
- [`/jira-sdlc`](../jira-sdlc/SKILL.md) -- Jira integration
