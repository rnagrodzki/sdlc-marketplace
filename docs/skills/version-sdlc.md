# `/version-sdlc` — Semantic Versioning & Release Management

## Overview

Manages the full semantic release workflow: detects the version source, bumps the version, creates an annotated git tag, optionally generates a CHANGELOG entry, and pushes the release. Supports file-based versioning (package.json, Cargo.toml, etc.) and tag-only projects. Run `--init` once per project to save configuration.

---

## Usage

```text
/version-sdlc [major|minor|patch] [flags]
```

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `major` / `minor` / `patch` / `<label>` | Bump type (positional). If omitted, auto-detected from conventional commits. The `<label>` form (e.g. `version-sdlc rc`) is sugar for `--bump patch --pre <label>` and accepts any pre-release label matching `^[a-z][a-z0-9]*$`. | auto |
| `--init` | Run the setup wizard and write `.claude/version.json`. Safe to re-run. | — |
| `--pre <label>` | Create a pre-release version (e.g. `beta`, `rc`). Label must match `^[a-z][a-z0-9]*$`. Auto-increments the counter on repeated runs. | — |
| `--no-push` | Commit and tag locally, skip `git push`. | — |
| `--changelog` | With a bump type: generate a CHANGELOG entry as part of the release. Without a bump type: update the changelog for the already-tagged current version (no new tag created). Can also be enabled permanently by setting `"changelog": true` in `.claude/version.json` — the CLI flag and config value are OR'd together as `flags.changelog`. | off |
| `--hotfix` | Mark this release as a hotfix for DORA metrics tracking. Annotates the commit message with `[hotfix]` and the tag message body with `Type: hotfix`. | off |
| `--auto` | Skip interactive approval prompts. Release plan is still displayed for visibility; critique gates and pre-condition checks still run. | off |

> **Auto-upstream:** When releasing from a branch with no remote upstream configured, the push step automatically uses `git push --set-upstream origin <branch>` instead of bare `git push`. This avoids first-push failures on fresh feature branches. The subsequent `git push --tags` is unaffected.

---

## Examples

### First-time setup (run once per project)

```text
/version-sdlc --init
```

```text
Detected setup:
  Mode:         file
  Version file: package.json
  Version:      1.2.3
  Tag prefix:   v
  Changelog:    no

Suggested config:
  .claude/version.json — will be written

Does this look right? (yes / tag-only / changelog / cancel)
```

### Bump the version

```text
/version-sdlc patch          # 1.2.3 → 1.2.4
/version-sdlc minor          # 1.2.3 → 1.3.0
/version-sdlc major          # 1.2.3 → 2.0.0
/version-sdlc                # auto-detect bump type from conventional commits
```

### Release with a CHANGELOG entry

```text
/version-sdlc minor --changelog
```

### Update changelog for already-tagged version

Run on the main branch after a squash-merge to reconcile the changelog with the actual commits:

```text
/version-sdlc --changelog
```

```text
Existing changelog entry for [1.3.0]:
──────────────────────────────────────────────
### Added
- Dark mode support for the dashboard

Updated changelog entry:
──────────────────────────────────────────────
### Added
- Dark mode support for the dashboard

### Fixed
- Dark mode toggle state now persists across page reloads

What changed: added 1 fix entry missing from original
Proceed with update? (yes / edit / cancel)
```

### Tag locally without pushing

```text
/version-sdlc patch --no-push
```

### Hotfix release (DORA metrics tracking)

```text
/version-sdlc patch --hotfix
```

```text
Release Plan
────────────────────────────────────────────
Version:    1.4.2 → 1.4.3
Tag:        v1.4.3 (annotated)
File:       package.json
Push:       yes (to origin/main)
Changelog:  no
Hotfix:     yes
────────────────────────────────────────────

Proceed? (yes / edit / cancel)
> yes

✓ Release v1.4.3 complete (hotfix).
  Commit: d4e5f6a — chore(release): v1.4.3 [hotfix]
  Tag:    v1.4.3  (annotated with Type: hotfix)
  Pushed: yes → origin/main
```

### Pre-release workflow

```text
/version-sdlc minor --pre beta    # 1.2.3 → 1.3.0-beta.1
/version-sdlc --pre beta          # 1.3.0-beta.1 → 1.3.0-beta.2
/version-sdlc --pre rc            # 1.3.0-beta.2 → 1.3.0-rc.1  (label change resets counter)
/version-sdlc minor               # 1.3.0-rc.1 → 1.3.0         (graduate to release)
```

### Pre-release shorthand: `--bump <label>`

The positional `<label>` form is sugar for `--bump patch --pre <label>`. Useful for short, repeated RC iteration:

```text
/version-sdlc rc                  # 1.2.3        → 1.2.4-rc.1   (fresh patch + label)
/version-sdlc rc                  # 1.2.4-rc.1   → 1.2.4-rc.2   (same-label increment)
/version-sdlc rc                  # 1.2.4-beta.3 → 1.2.4-rc.1   (label change, counter reset)
/version-sdlc mycorp              # 1.0.0        → 1.0.1-mycorp.1  (any custom label matching ^[a-z][a-z0-9]*$)
```

Label-form bumps skip the breaking-change suggestion (R3): pre-release trains do not nag on every iteration.

### Default pre-release label via config

Set `version.preRelease` in `.sdlc/config.json` to apply a default label whenever the user runs `version-sdlc` without an explicit `major|minor|patch` and without `--pre`:

```json
{
  "version": {
    "mode": "file",
    "versionFile": "package.json",
    "tagPrefix": "v",
    "preRelease": "rc"
  }
}
```

With this config:

```text
/version-sdlc                     # 1.2.3      → 1.2.4-rc.1   (config default applied)
/version-sdlc                     # 1.2.4-rc.1 → 1.2.4-rc.2   (same as `version-sdlc rc`)
/version-sdlc major               # 1.2.4-rc.1 → 2.0.0        (explicit base bump graduates)
```

Configure interactively via `/setup-sdlc` (Step 3a customize path).

### Example release session

```text
/version-sdlc minor
```

```text
Release Plan
────────────────────────────────────────────
Version:    1.2.3 → 1.3.0
Tag:        v1.3.0 (annotated)
File:       package.json
Push:       yes (to origin/main)
Changelog:  no
────────────────────────────────────────────

Proceed? (yes / edit / cancel)
> yes

✓ Release v1.3.0 complete.
  Commit: a1b2c3d — chore(release): v1.3.0
  Tag:    v1.3.0
  Pushed: yes → origin/main
```

---

## CHANGELOG Generation

When `--changelog` is passed (or `"changelog": true` in config), generates a [Keep a Changelog](https://keepachangelog.com) entry from commits since the last tag:

```markdown
## [1.3.0] - 2026-03-04

### Added
- User authentication with OAuth2 PKCE flow

### Fixed
- Date parsing in reports now handles timezone offsets correctly

### Changed
- Configuration format migrated from INI to YAML
```

Conventional commit mapping:

| Commit type | CHANGELOG section |
|-------------|-------------------|
| `feat` | Added |
| `fix` | Fixed |
| `refactor`, `perf` | Changed |
| Commits with `!` or `BREAKING CHANGE` | Noted with `(BREAKING)` in their section |
| `chore`, `docs`, `ci`, `test`, `build`, `style` | Omitted (unless user-facing) |

---

## DORA Metrics

The `--hotfix` flag enables DORA (DevOps Research and Assessment) metrics tracking by embedding hotfix metadata directly in git history.

**What gets annotated:**

- **Commit message**: `chore(release): v1.4.3 [hotfix]` — queryable via `git log`
- **Tag message body**: contains `Type: hotfix` — queryable via `git tag`

**Querying hotfix releases:**

```bash
# List all commits that are hotfixes
git log --oneline --grep='\[hotfix\]'

# Read the full annotation of a specific tag
git tag -l --format='%(refname:short)%09%(contents)' 'v1.4.3'

# List all tags and their metadata (filter by Type: hotfix in post-processing)
git tag -l --format='%(refname:short)%09%(contents:subject)%09%(contents:body)'
```

**DORA metrics this supports:**

| DORA Metric | How `--hotfix` helps |
|-------------|----------------------|
| Change Failure Rate | Count `[hotfix]` commits as failures relative to total deploys |
| Time to Restore Service | Diff timestamp between incident and hotfix tag |

---

## Prerequisites

- **git** — required for tagging and commit operations.
- **`.claude/version.json`** — must exist before a release run. Created by `--init`.
- No `gh` CLI required.

### Harness Configuration

| Field | Value |
|---|---|
| `argument-hint` | `[major\|minor\|patch\|<label>] [--pre <label>] [--changelog] [--hotfix]` |
| Plan mode | Graceful refusal (Step 0) |

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| `.claude/version.json` | Per-project config (created by `--init`) |
| `package.json` / version file | Version field bumped in-place |
| git tag | Annotated tag (e.g. `v1.3.0`) pushed to origin. With `--hotfix`, tag body includes `Type: hotfix`. |
| `CHANGELOG.md` | New entry prepended (only with `--changelog`) |

---

## Version-File Edit Hard Gate

After bumping the version string in the version file, the skill runs `git diff <versionFile>` and enforces that **exactly one line changed**. If more than one line differs, the release is aborted immediately: the file is restored with `git checkout -- <versionFile>` and the diff is surfaced verbatim to the user.

This gate applies to all supported file formats (JSON, TOML, YAML — `package.json`, `plugin.json`, `Cargo.toml`, `pyproject.toml`, etc.). The Edit tool is used with a single targeted string replacement; the Write tool is never used to rewrite the file, because LLMs can silently truncate or paraphrase fields like `description`.

---

## Configuration: `.claude/version.json`

Generated by `--init`. Edit manually or re-run `--init` to reconfigure.

### File-based mode

```json
{
  "mode": "file",
  "versionFile": "package.json",
  "fileType": "package.json",
  "tagPrefix": "v",
  "changelog": false,
  "changelogFile": "CHANGELOG.md"
}
```

### Tag-only mode

For projects with no version file (the git tag is the version):

```json
{
  "mode": "tag",
  "tagPrefix": "v",
  "changelog": false,
  "changelogFile": "CHANGELOG.md"
}
```

### Config fields

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `"file"` \| `"tag"` | Version source. |
| `versionFile` | string | Path to version file (relative to project root). `mode: "file"` only. |
| `fileType` | string | Version file format. Auto-detected by `--init`. |
| `tagPrefix` | string | Git tag prefix. Usually `"v"`. Set to `""` for no prefix. |
| `changelog` | boolean | Generate CHANGELOG by default. Defaults to `false`. |
| `changelogFile` | string | Path to the CHANGELOG file. Defaults to `"CHANGELOG.md"`. |
| `ticketPrefix` | string | Optional. Jira/project key prefix (e.g. `"PROJ"`). When set, ticket IDs matching this prefix are extracted from commit messages and appended to changelog entries: `- Added webhook support (PROJ-123)`. |

### Supported version files

Auto-detected in this priority order:

| Priority | File | Version field |
|----------|------|---------------|
| 1 | `package.json` | `.version` |
| 2 | `Cargo.toml` | `version = "x.y.z"` in `[package]` |
| 3 | `pyproject.toml` | `version = "x.y.z"` in `[project]` or `[tool.poetry]` |
| 4 | `pubspec.yaml` | `version: x.y.z` |
| 5 | `.claude-plugin/plugin.json` | `.version` |
| 6 | `VERSION` | Entire file content (trimmed) |
| 7 | `version.txt` | Entire file content (trimmed) |

---

## Changelog Accuracy

The automated changelog is a **draft**, not a source of truth. Squash merges, parallel branches, and post-tag commits mean the changelog generated at release time may be incomplete.

**Recommended post-merge workflow** when using squash merges:
1. Merge to main
2. `git checkout main && git pull`
3. Run `/version-sdlc --changelog` to reconcile the changelog with the actual tag-to-tag commits
4. The CI `check-changelog.cjs` (scaffolded during `--init` when changelog is enabled) validates that an entry exists on every push to main

## Link Verification (issue #198)

Before the release `git commit` (Step 8), the skill pipes the new CHANGELOG entry through `scripts/lib/links.js` as a hard gate. The validator auto-derives `expectedRepo` from `git remote origin` and `jiraSite` from `~/.sdlc-cache/jira/` — the skill never constructs the validator context. URL classes checked: GitHub issues/PRs (owner/repo identity + existence), Atlassian `*.atlassian.net/browse/<KEY>` (host match), and any other `http(s)://` URL (HEAD reachability, 5s timeout). Hosts in the built-in skip list (`linkedin.com`, `x.com`, `twitter.com`, `medium.com`) are reported as `skipped`, not violations. Set `SDLC_LINKS_OFFLINE=1` to skip generic reachability while keeping context-aware checks. On non-zero exit, neither `git commit` nor `git tag` is executed, and the violation list is surfaced verbatim. No flag toggles this gate — it is hard. (Skipped entirely when changelog is disabled and no release-notes body was generated.)

## Related Skills

- [`/commit-sdlc`](commit-sdlc.md) — commit changes before tagging a release
- [`/pr-sdlc`](pr-sdlc.md) — the PR that preceded this release
- [`/jira-sdlc`](jira-sdlc.md) — update Jira ticket status after the release

