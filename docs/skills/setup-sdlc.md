# `/setup-sdlc` — Unified Project Setup

## Overview

Configures the SDLC plugin for a project in one interactive flow. Creates `.claude/sdlc.json` (project-level config) and `.sdlc/local.json` (user-local preferences), and orchestrates content setup (review dimensions, PR template). Replaces the fragmented first-use experience of running multiple init commands separately.

---

## Usage

```text
/setup-sdlc
```

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--migrate` | Migrate legacy config files (`.claude/version.json`, `.sdlc/ship-config.json`, etc.) into unified config | — |
| `--skip <section>` | Skip a config section during setup (version, ship, jira, review, commit, pr) | — |
| `--force` | Reconfigure already-configured sections | — |

---

## Examples

### First-time setup

```text
/setup-sdlc
```

Detects missing config, walks through version/ship/jira/review/commit/pr setup, then offers to create review dimensions and PR template.

### Migrate from legacy config files

```text
/setup-sdlc --migrate
```

Reads `.claude/version.json`, `.sdlc/ship-config.json`, `.sdlc/review.json`, and `.sdlc/jira-config.json`, merges them into `.claude/sdlc.json` and `.sdlc/local.json`, and optionally deletes the legacy files.

### Skip specific sections

```text
/setup-sdlc --skip jira --skip commit --skip pr
```

Configures version, ship, and review sections, skipping Jira, commit, and PR title setup.

### Configure commit and PR patterns

```text
/setup-sdlc --skip version --skip jira --skip ship
```

Focuses on review, commit, and PR pattern setup for code style enforcement.

---

## Prerequisites

- Must be inside a git repository
- Node.js >= 16 (for `setup-prepare.js`)

---

## Setup Flow

### Step 3: Configuration Sections

After version, ship, and Jira setup, `/setup-sdlc` guides you through code style enforcement for commits and pull requests:

#### Step 3e: Commit Message Patterns

Choose a commit message convention:

- **conventional** — Enforce type(scope): description format (e.g., `feat(auth): add OAuth2`)
  - Prompts for allowed types and scopes (or accepts defaults)
  - Writes `commit.allowedTypes`, `commit.allowedScopes`, `commit.subjectPattern`, `commit.subjectPatternError` to `.claude/sdlc.json`

- **ticket-prefix** — Enforce ticket ID prefix (e.g., `PROJ-123: description`)
  - Prompts for ticket prefix pattern
  - Writes `commit.subjectPattern` and `commit.subjectPatternError`

- **custom** — Provide your own regex pattern
  - Prompts for `subjectPattern` and `subjectPatternError`
  - Writes custom pattern to `.claude/sdlc.json`

- **skip** — No commit pattern validation
  - Skips this step; subsequent `/commit-sdlc` calls use auto-detected style

#### Step 3f: PR Title Patterns

Choose whether PR titles should match a specific pattern:

- **conventional** — Enforce type[(scope)]: description format for PR titles
  - Accepts same allowed types and scopes as commit setup (or different ones if preferred)
  - Writes `pr.allowedTypes`, `pr.allowedScopes`, `pr.titlePattern`, `pr.titlePatternError`

- **ticket-prefix** — Enforce ticket ID prefix in PR titles
  - Prompts for ticket prefix pattern
  - Writes `pr.titlePattern` and `pr.titlePatternError`

- **custom** — Provide your own regex pattern
  - Prompts for `titlePattern` and `titlePatternError`
  - Writes custom pattern to `.claude/sdlc.json`

- **same-as-commit** — Use the same pattern as commit setup
  - Copies commit pattern fields to `pr` section if commit setup was not skipped
  - Available only if commit step was completed (not skipped)

- **skip** — No PR title pattern validation
  - Skips this step; subsequent `/pr-sdlc` calls generate titles without pattern enforcement

After selection, the skill writes the configuration to `.claude/sdlc.json` and stores local preferences in `.sdlc/local.json`.

---

## What It Creates or Modifies

| File | Purpose |
|------|---------|
| `.claude/sdlc.json` | Unified project config with `version`, `jira`, `commit`, and `pr` sections |
| `.sdlc/local.json` | User-local config with `review` scope preferences and `ship` settings |

Content files (delegated to other skills):

| File | Created By |
|------|------------|
| `.claude/review-dimensions/*.yaml` | `/review-init-sdlc` |
| `.claude/pr-template.md` | `/pr-customize-sdlc` |

---

## Related Skills

- [`/review-init-sdlc`](review-init-sdlc.md) — create review dimensions (delegated by setup-sdlc)
- [`/pr-customize-sdlc`](pr-customize-sdlc.md) — create PR template (delegated by setup-sdlc)
- [`/version-sdlc`](version-sdlc.md) — version management (reads config from `.claude/sdlc.json`)
- [`/ship-sdlc`](ship-sdlc.md) — shipping pipeline (reads config from `.sdlc/local.json`)
- [`/jira-sdlc`](jira-sdlc.md) — Jira integration (reads config from `.claude/sdlc.json`)
