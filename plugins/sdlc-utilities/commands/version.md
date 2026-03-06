---
description: Bump the project version, create a git tag, optionally generate a CHANGELOG entry, and push the release
allowed-tools: [Read, Edit, Write, Bash, Skill]
argument-hint: "[major|minor|patch] [--init] [--pre <label>] [--no-push] [--changelog]"
---

# /version Command

Manages semantic versioning for the current project. Bumps the version in
the configured version file (or uses git tags as source of truth), creates
an annotated git tag, optionally generates a Keep a Changelog entry, and
pushes the release to origin.

Run `/sdlc:version --init` once to configure versioning for the project.
Subsequent runs read `.claude/version.json` and skip auto-detection.

## Usage

- `/sdlc:version --init` — Set up versioning for this project (run once)
- `/sdlc:version` — Bump version (type auto-detected from conventional commits)
- `/sdlc:version patch` — Bump patch version (1.2.3 → 1.2.4)
- `/sdlc:version minor` — Bump minor version (1.2.3 → 1.3.0)
- `/sdlc:version major` — Bump major version (1.2.3 → 2.0.0)
- `/sdlc:version minor --pre beta` — Create pre-release (1.2.3 → 1.3.0-beta.1)
- `/sdlc:version --pre rc` — Increment existing pre-release (1.0.0-rc.1 → 1.0.0-rc.2)
- `/sdlc:version patch --changelog` — Bump and generate CHANGELOG entry
- `/sdlc:version minor --no-push` — Bump and tag locally, skip push

## Workflow

Invoke the `sdlc-versioning-releases` skill, passing `$ARGUMENTS` as the CLI flags.
The skill handles everything: script resolution, version detection, init setup or
release execution, version bump, changelog generation, user confirmation, and git operations.
