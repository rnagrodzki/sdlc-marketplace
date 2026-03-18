---
name: version-sdlc
description: "Use this skill when bumping a project version, creating a git release tag, generating a changelog, or performing a full semantic release workflow, updating an existing changelog entry for the current version. Consumes pre-computed context from version-prepare.js and handles the complete release process. Arguments: [major|minor|patch] [--init] [--pre <label>] [--no-push] [--changelog] [--hotfix]. Triggers on: version bump, create release, bump version, tag release, generate changelog, semantic versioning, semver bump, pre-release, release candidate. Use --changelog without a bump type to update the changelog for the already-tagged current version."
user-invocable: true
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
- Updating a CHANGELOG entry for an already-tagged release (e.g., after a squash merge added commits not captured in the original entry)

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

**Error-to-GitHub issue proposal**:

For exit code 2 (script crash), locate the procedure: Glob for `**/error-report-sdlc/REFERENCE.md`
under `~/.claude/plugins`, then retry with cwd. If found, follow the procedure with:

- **Skill**: version-sdlc
- **Step**: Step 0 — version-prepare.js execution
- **Operation**: Running version-prepare.js to pre-compute release context
- **Error**: Exit code 2 — script crash (full error on stderr)
- **Suggested investigation**: Check Node.js version; inspect stderr for stack trace; verify version-prepare.js is accessible via the plugin path

If not found, skip — the capability is not installed.

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

**When `config.changelog === true`** (i.e., user chose `changelog` option, or changelog was already enabled):

3. Copy `plugins/sdlc-utilities/scripts/check-changelog.js` → `.github/scripts/check-changelog.js` (reuse the same `.github/scripts/` directory)
4. Copy `plugins/sdlc-utilities/templates/check-changelog.yml` → `.github/workflows/check-changelog.yml`

If either target file already exists, skip copying it (do not overwrite).

Display:

```
✓ .claude/version.json written.
✓ .github/workflows/retag-release.yml added (auto-fixes tags after squash merge to main).
✓ .github/scripts/retag-release.js added.
✓ .github/workflows/check-changelog.yml added (validates changelog entry exists after each push to main).
✓ .github/scripts/check-changelog.js added.
Run /version-sdlc patch to create your first release.
```

If a file was skipped because it already existed, show `(already exists — skipped)` instead of `added`.
The check-changelog lines are only shown when `config.changelog === true`.

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

**Changelog script version check** — after checking retag files, if `config.changelog === true`:

1. Read `.github/scripts/check-changelog.js` (if it exists) and look for `const CHECK_CHANGELOG_SCRIPT_VERSION = (\d+);`. If absent, treat as version 1.
2. Read `.github/workflows/check-changelog.yml` (if it exists) and look for `# check-changelog-version: (\d+)`. If absent, treat as version 1.
3. Read the plugin's current copies and extract their version numbers.
4. If either installed file's version is less than the plugin's current version, include them in the update prompt alongside outdated retag files.

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
| `config.ticketPrefix` | Optional Jira/project key prefix (e.g. `"PROJ"`). When set, ticket IDs matching this prefix are extracted from commits. |
| `commits[].ticketIds` | Array of extracted ticket IDs (e.g. `["PROJ-123"]`) found in the commit subject and body. Empty array if none. |
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

**Ticket ID references** — when `config.ticketPrefix` is set and a commit has non-empty `ticketIds`:
- Append the ticket IDs in parentheses at the end of the changelog entry: `- Added bulk operations endpoint (PROJ-456)`
- Multiple IDs for one commit: `(PROJ-456, PROJ-789)`
- Multiple commits contributing to one merged entry: include all unique ticket IDs from those commits
- Only include ticket IDs when `config.ticketPrefix` is set — otherwise skip them to avoid false positives from random uppercase patterns

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

### Step 7.5 (CHECK): Verify Installed CI Scripts Are Up To Date

Before executing, check whether the project's installed CI scripts need updating.
This ensures projects that ran `--init` in a prior session get notified about improvements.

1. Check retag scripts — same version check as described in Branch A Step 4 (retag script version check).
2. If `config.changelog === true`: check check-changelog scripts — same version check as described in Branch A Step 4 (changelog script version check).
3. If any scripts are outdated or missing (and `config.changelog === true` for the check-changelog check):
   - Show the update prompt with what changed
   - On `yes`: scaffold/overwrite the outdated files
   - On `no`: warn and continue with the release — this check is non-blocking

The release proceeds regardless of the user's answer. This is informational, not a gate.

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

**If any git command fails** (commit, tag, or push) with a non-auth error, show the error.

**Error-to-GitHub issue proposal**:

Locate the procedure: Glob for `**/error-report-sdlc/REFERENCE.md` under `~/.claude/plugins`,
then retry with cwd. If found, follow the procedure with:

- **Skill**: version-sdlc
- **Step**: Step 8 — Release execution
- **Operation**: Git commit, tag, or push during release
- **Error**: Git command failure (full error from above)
- **Suggested investigation**: Check remote connectivity, verify tag does not already exist, confirm git identity is configured

If not found, skip — the capability is not installed.

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

### Branch C: Changelog-Update Workflow (`flow === "changelog-update"`)

This branch activates when `/version-sdlc --changelog` is run without a bump type.
It updates the CHANGELOG entry for the **already-tagged current version** — useful after
squash merges add commits that weren't captured when the release was originally tagged.

### Step 1 (CONSUME): Read the Context

Read `VERSION_CONTEXT_JSON`. Extract:

| Field | Description |
| ----- | ----------- |
| `currentVersion` | The current version string (e.g. `1.2.3`) |
| `currentTag` | The git tag for the current version (e.g. `v1.2.3`) |
| `previousTag` | The tag immediately before the current one (e.g. `v1.2.2`), or `null` for the first release |
| `commits` | Commits between `previousTag` and `currentTag` — the actual commits that make up this release |
| `commits[].ticketIds` | Ticket IDs extracted from each commit |
| `changelog.exists` | Whether `CHANGELOG.md` exists |
| `changelog.filePath` | Path to the changelog file |
| `changelog.currentContent` | Current content of the changelog (truncated to 5000 chars) |
| `config.ticketPrefix` | Optional ticket prefix for filtering ticket IDs |
| `flags.noPush` | Whether to skip pushing |

### Step 2 (CHECK): Validate Preconditions

- If `commits.length === 0`: inform the user `"No commits found between ${previousTag} and ${currentTag}. The changelog may already be up to date."` and stop.
- If `changelog.exists === false`: inform the user that no CHANGELOG.md was found and offer to create one: `"CHANGELOG.md does not exist. Run /version-sdlc patch --changelog to create it as part of a release, or confirm to create it now with just the current version entry."` Ask yes/no.

### Step 3 (PLAN): Draft Updated Changelog Entry

Draft an updated `## [currentVersion]` changelog entry from the commits between `previousTag` and `currentTag`:

- Use the same commit-type mapping as Branch B Step 2 (`feat` → **Added**, `fix` → **Fixed**, etc.)
- Apply the same ticket ID rules as Branch B Step 2 (append when `config.ticketPrefix` is set)
- If an existing `## [currentVersion]` section is present in `changelog.currentContent`:
  - Compare the existing entries against the commits
  - Keep entries that are still accurate
  - Add entries for commits not yet represented
  - Remove entries that cannot be traced to any commit in the `commits` array (they may be fabricated or from squashed commits that are no longer visible)
  - **Preserve user-edited entries** — if an entry looks hand-written (not matching a commit description directly), keep it with a note
- If no existing entry: draft fresh from the commits

### Step 4 (CRITIQUE): Self-review

Apply the same quality gates as Branch B: no fabricated entries, all user-facing commits represented, changelog completeness.

### Step 5 (IMPROVE): Revise Based on Critique

Fix any issues found in Step 4.

### Step 6 (PRESENT): Show the User

Display side-by-side (or sequentially with clear labels):

```
Existing changelog entry for [currentVersion]:
──────────────────────────────────────────────
[show existing ## [currentVersion] section, or "(none)" if no existing entry]

Updated changelog entry:
──────────────────────────────────────────────
[show the new draft entry]

What changed: [brief summary of additions/removals]
```

Ask: `Proceed with update? (yes / edit / cancel)`

If `edit`: ask what to change, revise, present again.

### Step 7 (EXECUTE): Apply the Update

On `yes`:

1. If `changelog.exists === false`: create CHANGELOG.md with a standard header + the new entry.
2. If the `## [currentVersion]` section exists in the changelog: use the Edit tool to replace it with the updated entry.
3. If the `## [currentVersion]` section does not exist yet: prepend the entry after the `## [Unreleased]` section (if present) or after the file header.
4. Stage: `git add <changelog.filePath>`
5. Commit: `git commit -m "docs: update changelog for ${currentTag}"`
6. Push (unless `flags.noPush === true`): `git push`

**Do NOT create a new tag.** This workflow only updates the changelog.

Display result:
```
✓ Changelog updated for ${currentTag}.
  Commit: abc1234 — docs: update changelog for v1.2.3
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

## Error Recovery

> **Flow**: detect → diagnose → auto-recover (retry once if transient) → invoke `error-report-sdlc` for persistent actionable failures.

| Error | Recovery | Invoke error-report-sdlc? |
|-------|----------|---------------------------|
| `version-prepare.js` exit 1 | Show `errors[]`, stop | No — user input error |
| `version-prepare.js` exit 2 (crash) | Show stderr, stop | Yes |
| Tag already exists (`conflictsWithNext` true) | Suggest next patch/minor/major; let user choose | No — user decision |
| `git commit` fails | Show error; check for uncommitted changes or hook failure | Yes if non-hook failure |
| `git tag` fails | Show error; check for duplicate tag or missing git identity | Yes if non-duplicate failure |
| `git push --tags` fails | Show error; check remote connectivity and branch protection rules | Yes if non-auth failure |

When invoking `error-report-sdlc`, provide:
- **Skill**: version-sdlc
- **Step**: Step 0 (script crash) or Step 8 (git command failure)
- **Operation**: `version-prepare.js` execution or `git commit`/`git tag`/`git push`
- **Error**: exit code 2 + stderr, or git error output
- **Suggested investigation**: Check installed plugin version; verify git identity is configured; confirm remote is accessible

---

## Gotchas

- **Squash merge orphans tags**: When using GitHub's "squash and merge" strategy, the annotated tag created on the feature branch points to the pre-merge commit, which becomes unreachable from main after merge. The `retag-release.yml` workflow (scaffolded during init) automatically moves the tag to the squash commit on main whenever a push lands on main. Without this workflow, tags are orphaned and `git describe` / `git log --decorate` on main will not show them.
- `bumpOptions.preRelease` is pre-computed in the JSON only when `--pre` was passed at script time. If the user requests a different pre-label during `edit`, re-run the script — the `preRelease` field reflects the label passed at script invocation, not a label added mid-session.
- For TOML/YAML version files, use the Edit tool with targeted string replacement (old version string → new version string), not full file rewrites, to avoid corrupting file structure.
- `git push && git push --tags` are two separate pushes. `git push --tags` alone does NOT push the release commit — both commands are required.
- If the working tree has uncommitted changes at execution time, the release commit will include only the staged version file and changelog changes. Warn the user so they are not surprised by files missing from the commit.
- `conventionalSummary.suggestedBump` is derived from commit types. If there are no conventional commits since the last tag, the suggested bump may default to `patch` — confirm with the user if this seems wrong.

## Changelog Accuracy and Limitations

The automated changelog is a **draft, not a source of truth**. Correctness is the developer's responsibility. The tooling makes changelog maintenance fast, but cannot guarantee accuracy in all workflows.

### Known Limitations

| Limitation | Why it happens | Impact |
|---|---|---|
| **Squash merge loses commit granularity** | Squash-merge collapses N commits into 1. After retag, `previousTag..currentTag` on main sees only the squash commit. | Changelog drafted on the feature branch reflects individual commits; after squash, that detail no longer exists in main's git history. |
| **Post-tag commits not in changelog** | Commits added after tagging but before merge (e.g. code review fixes). | These changes are released but not documented in the original changelog entry. |
| **Parallel branches / merge order** | Multiple feature branches tag releases concurrently. Merge order determines which squash commit each tag lands on after retag. | Tag may end up on a different commit than intended; changelog was written against a different commit range. |
| **Conventional commit compliance** | Changelog quality depends on developers writing `feat:`, `fix:`, etc. Non-conforming commits show as "other" and may be skipped. | Incomplete or inaccurate changelog entries. |
| **LLM-drafted content** | The changelog entry is generated by an LLM from commit data and may misinterpret scope or miss nuances. | Entries require human review before they are authoritative. |

### Mitigation: 4-Layer Defense

1. **CI validates presence** — `check-changelog.js` (scaffolded during init when changelog is enabled) fails on push to main if no `## [version]` heading exists. Ensures at least a placeholder entry.
2. **`/version-sdlc --changelog` on main** — After merge, switch to main and run this command. It re-derives the changelog from the actual `previousTag..currentTag` range (not the feature branch), shows a diff against the existing entry, and lets you approve or edit the update without creating a new tag.
3. **Retag script advisory** — After retagging, `retag-release.js` prints a warning if `changelog: true` and no entry exists for the tag. Reminds developers to verify.
4. **Manual review** — Before release communications, treat the CHANGELOG as a draft to review, not a finished document.

## Learning Capture

After completing a release or encountering unexpected behavior, append to `.claude/learnings/log.md`:

```
## YYYY-MM-DD — version-sdlc: <brief summary>
<what happened, what was learned>
```

Record entries for: project-specific version file locations, non-standard tag conventions,
monorepo versioning patterns, CI requirements that gate tag pushes, or any edge cases
encountered during release execution.
