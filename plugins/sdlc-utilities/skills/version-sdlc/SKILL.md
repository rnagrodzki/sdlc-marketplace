---
name: version-sdlc
description: "Use this skill when bumping a project version, creating a git release tag, generating a changelog, or performing a full semantic release workflow, updating an existing changelog entry for the current version. Consumes pre-computed context from skill/version.js and handles the complete release process. Use --changelog without a bump type to update the changelog for the already-tagged current version. Arguments: [major|minor|patch] [--init] [--pre <label>] [--no-push] [--changelog] [--hotfix] [--auto]. Triggers on: version bump, create release, bump version, tag release, generate changelog, semantic versioning, semver bump, pre-release, release candidate. Use --auto to skip interactive approval prompts (release plan is still displayed)."
user-invocable: true
argument-hint: "[major|minor|patch] [--pre <label>] [--changelog] [--hotfix] [--auto]"
---

# Versioning Releases Skill

Consume pre-computed version context from `skill/version.js` and execute either
the one-time init setup or a full semantic release: version bump, annotated git tag,
optional CHANGELOG entry, release commit, and push to origin.

**Announce at start:** "I'm using version-sdlc (sdlc v{sdlc_version})." — extract the version from the `sdlc:` line in the session-start system-reminder. If no version is in context, omit the parenthetical.

## When to Use This Skill

- Bumping the project version (patch, minor, major)
- Creating an annotated git release tag
- Generating a Keep a Changelog entry for a release
- Running a full semantic release workflow end-to-end
- Creating or incrementing pre-release versions (alpha, beta, rc)
- When the `/version` command delegates here after running `skill/version.js`
- Updating a CHANGELOG entry for an already-tagged release (e.g., after a squash merge added commits not captured in the original entry)

## Workflow

## Step 0 — Plan Mode Check

If the system context contains "Plan mode is active":

1. Announce: "This skill requires write operations (git tag, git push). Exit plan mode first, then re-invoke `/version-sdlc`."
2. Stop. Do not proceed to subsequent steps.

---

### Step 0: Resolve and Run skill/version.js

> **VERBATIM** — Run this bash block exactly as written. Do not modify, rephrase, or simplify the commands.

```bash
SCRIPT=$(find ~/.claude/plugins -name "version.js" -path "*/sdlc*/scripts/skill/version.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/skill/version.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/skill/version.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate skill/version.js. Is the sdlc plugin installed?" >&2; exit 2; }

VERSION_CONTEXT_FILE=$(node "$SCRIPT" --output-file $ARGUMENTS)
EXIT_CODE=$?
```

Read and parse `VERSION_CONTEXT_FILE` as `VERSION_CONTEXT_JSON`. Clean up after the release completes or is cancelled:

```bash
rm -f "$VERSION_CONTEXT_FILE"
```

**On non-zero `EXIT_CODE`:**

- Exit code 1: The JSON still contains an `errors` array. Show each error to the user and stop.
- Exit code 2: Show `Script error — see output above` and stop.

**On script crash (exit 2):** Invoke error-report-sdlc — Glob `**/error-report-sdlc/REFERENCE.md`, follow with skill=version-sdlc, step=Step 0 — skill/version.js execution, error=stderr.

**If `VERSION_CONTEXT_JSON.errors` is non-empty**, show each error message and stop.

**If `VERSION_CONTEXT_JSON.warnings` is non-empty**, show the warnings to the user before continuing.
For the warning `"You have uncommitted changes"`, use AskUserQuestion to ask:
> You have uncommitted changes that will NOT be included in this release.

Options:
- **proceed** — release without the uncommitted changes
- **commit first** — run /commit-sdlc to commit changes, then re-invoke /version-sdlc
- **cancel** — abort the release

On **commit first**: invoke `/commit-sdlc` via the Skill tool. After the commit completes, re-invoke `/version-sdlc` with the same original arguments.

---

The workflow then has two branches determined by `VERSION_CONTEXT_JSON.flow`.

---

### Branch A: Init Workflow (`flow === "init"`)

> If the user invoked with `--init`, read `./init-workflow.md` now for the complete init workflow steps.

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
| `flags` | `{ preLabel, noPush, changelog, hotfix, auto }` — parsed CLI flags |
| `flags.hotfix` | Whether this release is a hotfix (for DORA metrics tracking) |
| `flags.auto` | Whether `--auto` was passed — skip interactive approval prompts |
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

**Auto mode:** When `flags.auto` is true, skip the AskUserQuestion prompt entirely. Still display the full release plan for visibility, then proceed directly to Step 6 (pre-condition verification). Treat the response as an implicit `yes`. All critique gates (Steps 3–4) still run — only the interactive approval prompt is skipped. Breaking change warnings are still displayed.

Show the full release plan to the user. **Do not execute any git commands before receiving explicit user approval via AskUserQuestion.**

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

Use AskUserQuestion to ask:
> Execute this release?

Options:
- **yes** — execute all steps
- **edit** — describe what to change
- **cancel** — abort
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
   - Show what changed and which files would be updated
   - Use AskUserQuestion to ask: "Update CI scripts? (yes / no) — this does not block the release."
   - **Auto mode:** When `flags.auto` is true, skip the AskUserQuestion and treat the response as `yes` — update outdated CI scripts automatically.
   - On `yes`: scaffold/overwrite the outdated files
   - On `no`: warn and continue with the release

The release proceeds regardless of the user's answer. This is informational, not a gate.

### Step 8 (EXECUTE): Execute the Release

**Only execute after explicit `yes` from Step 5, or when `flags.auto` is true (implicit approval).**

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

**On script crash (exit 2):** Invoke error-report-sdlc — Glob `**/error-report-sdlc/REFERENCE.md`, follow with skill=version-sdlc, step=Step 8 — Release execution, error=git command failure message.

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

> If the user invoked with `--changelog` (without a bump type), read `./changelog-workflow.md` now for the complete changelog-update workflow steps.

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

- Execute any git commands without explicit user approval (`yes`) or auto-mode implicit approval (`flags.auto === true`)
- Fabricate commit descriptions or changelog entries not backed by real commits
- Skip the CRITIQUE step even if the plan looks obviously correct
- Push to remote without checking `flags.noPush`
- Modify the version file if `config.mode === "tag"` — in tag mode, the version lives in git only
- Omit the pre-condition verification in Step 6 before executing

## Error Recovery

> **Flow**: detect → diagnose → auto-recover (retry once if transient) → invoke `error-report-sdlc` for persistent actionable failures.

| Error | Recovery | Invoke error-report-sdlc? |
|-------|----------|---------------------------|
| `skill/version.js` exit 1 | Show `errors[]`, stop | No — user input error |
| `skill/version.js` exit 2 (crash) | Show stderr, stop | Yes |
| Tag already exists (`conflictsWithNext` true) | Suggest next patch/minor/major; let user choose | No — user decision |
| `git commit` fails | Show error; check for uncommitted changes or hook failure | Yes if non-hook failure |
| `git tag` fails | Show error; check for duplicate tag or missing git identity | Yes if non-duplicate failure |
| `git push --tags` fails | Show error; check remote connectivity and branch protection rules | Yes if non-auth failure |

When invoking `error-report-sdlc`, provide:
- **Skill**: version-sdlc
- **Step**: Step 0 (script crash) or Step 8 (git command failure)
- **Operation**: `skill/version.js` execution or `git commit`/`git tag`/`git push`
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

## What's Next

After completing the release, common follow-ups include:
- `/jira-sdlc` — update Jira ticket status

## See Also

- [`/commit-sdlc`](../commit-sdlc/SKILL.md) — commit changes before tagging a release
- [`/jira-sdlc`](../jira-sdlc/SKILL.md) — update Jira ticket status after release
- [`/pr-sdlc`](../pr-sdlc/SKILL.md) — the PR that triggered this release
