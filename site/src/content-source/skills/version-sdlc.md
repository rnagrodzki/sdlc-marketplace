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
| `major` / `minor` / `patch` | Bump type (positional). If omitted, auto-detected from conventional commits. | auto |
| `--init` | Run the setup wizard and write `.claude/version.json`. Safe to re-run. | — |
| `--pre <label>` | Create a pre-release version (e.g. `beta`, `rc`). Auto-increments the counter on repeated runs. | — |
| `--no-push` | Commit and tag locally, skip `git push`. | — |
| `--changelog` | With a bump type: generate a CHANGELOG entry as part of the release. Without a bump type: update the changelog for the already-tagged current version (no new tag created). | off |
| `--hotfix` | Mark this release as a hotfix for DORA metrics tracking. Annotates the commit message with `[hotfix]` and the tag message body with `Type: hotfix`. | off |

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

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| `.claude/version.json` | Per-project config (created by `--init`) |
| `package.json` / version file | Version field bumped in-place |
| git tag | Annotated tag (e.g. `v1.3.0`) pushed to origin. With `--hotfix`, tag body includes `Type: hotfix`. |
| `CHANGELOG.md` | New entry prepended (only with `--changelog`) |

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

The automated changelog is a **draft**, not a source of truth. Squash merges, parallel branches, and post-tag commits mean the changelog generated at release time may be incomplete. See the [Changelog Accuracy and Limitations](../skills/version-sdlc/SKILL.md) section in the SKILL.md for the full limitations table and the 4-layer mitigation strategy.

**Recommended post-merge workflow** when using squash merges:
1. Merge to main
2. `git checkout main && git pull`
3. Run `/version-sdlc --changelog` to reconcile the changelog with the actual tag-to-tag commits
4. The CI `check-changelog.js` (scaffolded during `--init` when changelog is enabled) validates that an entry exists on every push to main

## Related Skills

- [`/pr-sdlc`](pr-sdlc.md) — open the PR before or after tagging a release
