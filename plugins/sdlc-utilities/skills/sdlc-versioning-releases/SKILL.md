---
name: sdlc-versioning-releases
description: "Use this skill when bumping a project version, creating a git release tag, generating a changelog, or performing a full semantic release workflow. Consumes pre-computed context from version-prepare.js and handles the complete release process. Triggers on: version bump, create release, bump version, tag release, generate changelog, semantic versioning, semver bump, pre-release, release candidate."
user-invocable: false
---

# Versioning Releases Skill

Consume pre-computed version context from `version-prepare.js` and execute either
the one-time init setup or a full semantic release: version bump, annotated git tag,
optional CHANGELOG entry, release commit, and push to origin.

## When to Use This Skill

- Bumping the project version (patch, minor, major)
- Creating an annotated git release tag
- Generating a Keep a Changelog entry for a release
- Running a full semantic release workflow end-to-end
- Creating or incrementing pre-release versions (alpha, beta, rc)
- When the `/version` command delegates here after running `version-prepare.js`

## Workflow

### Step 0: Resolve and Run version-prepare.js

> **VERBATIM** — Run this bash block exactly as written. Do not modify, rephrase, or simplify the commands.

```bash
SCRIPT=$(find ~/.claude/plugins -name "version-prepare.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/version-prepare.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/version-prepare.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate version-prepare.js. Is the sdlc plugin installed?" >&2; exit 2; }

VERSION_CONTEXT_FILE=$(mktemp /tmp/version-context-XXXXXX.json)
node "$SCRIPT" $ARGUMENTS > "$VERSION_CONTEXT_FILE"
EXIT_CODE=$?
```

Read and parse `VERSION_CONTEXT_FILE` as `VERSION_CONTEXT_JSON`. Clean up after the release completes or is cancelled:

```bash
rm -f "$VERSION_CONTEXT_FILE"
```

**On non-zero `EXIT_CODE`:**

- Exit code 1: The JSON still contains an `errors` array. Show each error to the user and stop.
- Exit code 2: Show `Script error — see output above` and stop.

**If `VERSION_CONTEXT_JSON.errors` is non-empty**, show each error message and stop.

**If `VERSION_CONTEXT_JSON.warnings` is non-empty**, show the warnings to the user before continuing.
For the warning `"You have uncommitted changes"`, ask the user to confirm they want to proceed.

---

The workflow then has two branches determined by `VERSION_CONTEXT_JSON.flow`.

---

### Branch A: Init Workflow (`flow === "init"`)

### Step 1 (CONSUME): Read the Context

Read `VERSION_CONTEXT_JSON`. Extract:

- `detectedVersionFile` — path to the detected version file (e.g. `package.json`)
- `currentVersion` — version string found in that file or from git tags
- `existingTags` — list of existing git release tags
- `tagConvention` — detected tag prefix (e.g. `v`, `release/`, or empty)
- `suggestedConfig` — the config object that will be written to `.claude/version.json`

### Step 2 (PRESENT): Show Detected Setup

Display the detected configuration in a clean summary table:

```
Detected setup:
  Mode:         file
  Version file: package.json
  Version:      1.2.3
  Tag prefix:   v
  Changelog:    no (use --changelog flag to enable per release)

Suggested config:
  .claude/version.json — will be written
```

### Step 3 (CONFIRM): Ask User to Confirm

Present options:

```
Does this look right? Options:
  yes          — write .claude/version.json as shown
  tag-only     — use git tags as version source (no version file)
  changelog    — same as yes, but enable changelog by default
  cancel       — abort setup
```

Wait for explicit user response before proceeding.

### Step 4 (WRITE): Write Config on Confirmation

On `yes` or `changelog`, write `.claude/version.json` using the Write tool with
the content from `suggestedConfig` (adjusted if `changelog` was chosen).

Then scaffold the retag workflow into the project:

1. Copy `plugins/sdlc-utilities/scripts/retag-release.js` → `.github/scripts/retag-release.js` (create `.github/scripts/` if it doesn't exist)
2. Copy `plugins/sdlc-utilities/templates/retag-release.yml` → `.github/workflows/retag-release.yml` (create `.github/workflows/` if it doesn't exist)

If either target file already exists, skip copying it (do not overwrite).

Display:

```
✓ .claude/version.json written.
✓ .github/workflows/retag-release.yml added (auto-fixes tags after squash merge to main).
✓ .github/scripts/retag-release.js added.
Run /sdlc:version patch to create your first release.
```

If a file was skipped because it already existed, show `(already exists — skipped)` instead of `added`.

**Retag script version check** — after scaffolding (whether files were added or skipped), check if the installed files are up to date:

1. Read the installed `.github/scripts/retag-release.js` (if it exists) and look for `const RETAG_SCRIPT_VERSION = (\d+);`. If absent, treat as version 1.
2. Read the installed `.github/workflows/retag-release.yml` (if it exists) and look for `# retag-release-version: (\d+)`. If absent, treat as version 1.
3. Read the plugin's current copies of those files (from the same paths used for scaffolding) and extract their version numbers the same way.
4. If either installed file's version is less than the plugin's current version, show an update prompt:

```
⚠  Outdated retag files detected:
   .github/scripts/retag-release.js   (installed: v1, current: v2)
   .github/workflows/retag-release.yml (installed: v1, current: v2)

Changes in v2:
- Retag now preserves original tag message metadata (required for --hotfix DORA annotations)

Update these files? (yes / no)
```

On `yes`, overwrite the outdated files with the plugin's current copies. On `no`, warn:
```
⚠  Skipped update. Note: hotfix tag metadata (Type: hotfix) will not survive retagging until you update these files.
```

On `tag-only`, update `suggestedConfig.mode` to `"tag"` before writing. Apply the same workflow scaffolding.

On `cancel`, stop immediately without writing any files.

---

### Branch B: Release Workflow (`flow === "release"`)

### Step 1 (CONSUME): Read the Context

Read `VERSION_CONTEXT_JSON`. Key fields to extract:

| Field | Description |
| ----- | ----------- |
| `versionSource.currentVersion` | Current version string |
| `config.mode` | `"file"` or `"tag"` |
| `config.changelog` | Whether changelog is enabled by default |
| `requestedBump` | `"major"`, `"minor"`, `"patch"`, or `null` |
| `conventionalSummary.suggestedBump` | Auto-detected bump type from commits |
| `conventionalSummary.hasBreakingChanges` | Whether any commit is a breaking change |
| `bumpOptions` | `{ major, minor, patch, preRelease }` — pre-computed next versions |
| `tags.latest` | Most recent tag |
| `commits` | Array of commits since last tag |
| `flags` | `{ preLabel, noPush, changelog, hotfix }` — parsed CLI flags |
| `flags.hotfix` | Whether this release is a hotfix (for DORA metrics tracking) |
| `conflictsWithNext` | `{ major, minor, patch }` — whether each tag already exists |

### Step 2 (PLAN): Determine Bump Type and Draft CHANGELOG

**Determine new version:**

- If `flags.preLabel` is set:
  - If `requestedBump` is also set: compute pre-release from the corresponding base version (e.g. `--minor --pre beta` on `1.2.3` → `1.3.0-beta.1`). Use `bumpOptions.preRelease`.
  - If only `--pre` with no bump type: use `bumpOptions.preRelease` directly (increments existing pre-release counter).
- If `requestedBump` is explicitly set (and no pre-label): use `bumpOptions[requestedBump]`.
- Otherwise: use `conventionalSummary.suggestedBump` automatically. Inform the user which bump type was auto-selected and why.
- If `conventionalSummary.hasBreakingChanges` is true and the chosen bump is not `major` (and is not a pre-release): warn the user that breaking changes were detected and suggest bumping to `major` instead.

**Draft CHANGELOG entry** (only if `flags.changelog === true` OR `config.changelog === true`):

- Use Keep a Changelog format with today's date: `## [x.y.z] - YYYY-MM-DD`
- Map commit types to sections:
  - `feat` → **Added**
  - `fix` → **Fixed**
  - `refactor`, `perf` → **Changed**
  - breaking commits → note `(BREAKING)` inline within their section
- Skip: `chore`, `docs`, `test`, `ci`, `build`, `style` — unless they are clearly user-facing from the description
- Rewrite unclear or implementation-focused commit messages into user-facing language
- Merge closely related commits into single entries where appropriate
- Never fabricate entries not backed by a real commit

### Step 3 (CRITIQUE): Self-review Against Quality Gates

Review the planned version and CHANGELOG draft against every quality gate in the table below. Note every failing gate before proceeding.

### Step 4 (IMPROVE): Revise Based on Critique

Fix each issue found in Step 3. Continue until all gates pass (max 2 iterations per gate).

### Step 5 (DO): Present Release Plan for Approval

Show the full release plan to the user. **Do not execute any git commands before receiving explicit user approval.**

```
Release Plan
────────────────────────────────────────────
Version:    1.2.3 → 1.3.0
Tag:        v1.3.0 (annotated)
File:       package.json
Push:       yes (to origin/main)
Changelog:  no
Hotfix:     yes             ← only shown when flags.hotfix === true
────────────────────────────────────────────

Proceed? (yes / edit / cancel)
  yes    — execute all steps
  edit   — describe what to change
  cancel — abort
```

If changelog is enabled, show the draft CHANGELOG entry between the release plan table and the prompt.

If the user chooses `edit`, ask what to change, revise, and present again. Loop until explicit `yes` or `cancel`.

### Step 6 (CRITIQUE post-execution plan): Verify Pre-conditions

Before executing, verify:

- The version file path exists (for `config.mode === "file"`)
- The new tag does not conflict with existing tags (`conflictsWithNext[bumpType]` is false)
- There are no uncommitted changes that would corrupt the release commit (run `git status --porcelain` and warn if non-empty)
- Remote state is known — warn if no upstream is configured, but do not block the release
- Git identity is configured: run `git config user.name` and `git config user.email`. If either is empty, stop and instruct the user to set them:
  ```
  git config user.name "Your Name"
  git config user.email "you@example.com"
  ```
  (The annotated tag created in Step 8 requires a committer identity.)

### Step 7 (IMPROVE): Fix Any Pre-condition Issues

Resolve any issues found in Step 6 before proceeding. If a blocking issue cannot be resolved, report it clearly and stop.

### Step 8 (EXECUTE): Execute the Release

**Only execute after explicit `yes` from Step 5.**

1. **Update version file** (only if `config.mode === "file"`): Use the Edit tool to replace the old version string with the new version in the version file. For TOML/YAML files, use targeted string replacement rather than a full file rewrite.
2. **Update CHANGELOG** (only if changelog is enabled): Use the Edit or Write tool to prepend the new entry after the `## [Unreleased]` section if present, or after the file header if not. Create `CHANGELOG.md` if it does not exist.
3. **Stage changed files**: `git add <versionFile> CHANGELOG.md` — include only files that were actually changed.
4. **Commit**:
   - If `flags.hotfix === true`: `git commit -m "chore(release): ${newTag} [hotfix]"`
   - Otherwise: `git commit -m "chore(release): ${newTag}"`
5. **Tag**:
   - If `flags.hotfix === true`:
     ```bash
     git tag -a ${newTag} -m "$(printf 'Release %s\n\nType: hotfix' ${newTag})"
     ```
   - Otherwise: `git tag -a ${newTag} -m "Release ${newTag}"`
6. **Push** (unless `flags.noPush === true`): `git push && git push --tags`

Display result:

```
✓ Release v1.3.0 complete.
  Commit: abc1234 — chore(release): v1.3.0
  Tag:    v1.3.0
  Pushed: yes → origin/main
```

If `flags.hotfix === true`, show instead:

```
✓ Release v1.3.0 complete (hotfix).
  Commit: abc1234 — chore(release): v1.3.0 [hotfix]
  Tag:    v1.3.0  (annotated with Type: hotfix)
  Pushed: yes → origin/main
```

---

## Quality Gates

| Gate | Check | Pass Criteria |
| ---- | ----- | ------------- |
| Semver correctness | New version is valid semver | `major.minor.patch[-pre]`, no leading zeros |
| Breaking change bump | If `hasBreakingChanges`, bump is major (or is a pre-release) | Warn if minor/patch chosen with breaking commits |
| Tag conflict | New tag does not already exist | `conflictsWithNext[bumpType]` is false |
| Changelog completeness | All user-facing commits are represented | No feat/fix commits silently omitted (if changelog enabled) |
| No fabricated entries | Every CHANGELOG entry traces to a real commit | (if changelog enabled) |
| Commit count | There are commits to release | `commits.length > 0` OR pre-release (allow empty pre-releases) |
| Version file writable | File type is supported | fileType is in the known list |

## Best Practices

1. Always show the full release plan before executing any git commands
2. Use `--pre beta` or `--pre rc` for pre-release versions; they auto-increment (e.g. `rc.1` → `rc.2`)
3. For pre-releases: running the full release without `--pre` "graduates" the pre-release to a stable version
4. Breaking changes require a major bump — suggest it even if the user requested a lower bump type
5. Changelog entries should be user-facing and outcome-focused, not implementation-focused

## DO NOT

- Execute any git commands without explicit user approval (`yes`)
- Fabricate commit descriptions or changelog entries not backed by real commits
- Skip the CRITIQUE step even if the plan looks obviously correct
- Push to remote without checking `flags.noPush`
- Modify the version file if `config.mode === "tag"` — in tag mode, the version lives in git only
- Omit the pre-condition verification in Step 6 before executing

## Gotchas

- **Squash merge orphans tags**: When using GitHub's "squash and merge" strategy, the annotated tag created on the feature branch points to the pre-merge commit, which becomes unreachable from main after merge. The `retag-release.yml` workflow (scaffolded during init) automatically moves the tag to the squash commit on main whenever a push lands on main. Without this workflow, tags are orphaned and `git describe` / `git log --decorate` on main will not show them.
- `bumpOptions.preRelease` is pre-computed in the JSON only when `--pre` was passed at script time. If the user requests a different pre-label during `edit`, re-run the script — the `preRelease` field reflects the label passed at script invocation, not a label added mid-session.
- For TOML/YAML version files, use the Edit tool with targeted string replacement (old version string → new version string), not full file rewrites, to avoid corrupting file structure.
- `git push && git push --tags` are two separate pushes. `git push --tags` alone does NOT push the release commit — both commands are required.
- If the working tree has uncommitted changes at execution time, the release commit will include only the staged version file and changelog changes. Warn the user so they are not surprised by files missing from the commit.
- `conventionalSummary.suggestedBump` is derived from commit types. If there are no conventional commits since the last tag, the suggested bump may default to `patch` — confirm with the user if this seems wrong.

## Learning Capture

After completing a release or encountering unexpected behavior, append to `.claude/learnings/log.md`:

```
## YYYY-MM-DD — sdlc-versioning-releases: <brief summary>
<what happened, what was learned>
```

Record entries for: project-specific version file locations, non-standard tag conventions,
monorepo versioning patterns, CI requirements that gate tag pushes, or any edge cases
encountered during release execution.
