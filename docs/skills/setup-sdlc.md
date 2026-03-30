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
| `--skip <section>` | Skip a config section during setup (version, ship, jira, review) | — |
| `--force` | Reconfigure already-configured sections | — |

---

## Examples

### First-time setup

```text
/setup-sdlc
```

Detects missing config, walks through version/ship/jira/review setup, then offers to create review dimensions and PR template.

### Migrate from legacy config files

```text
/setup-sdlc --migrate
```

Reads `.claude/version.json`, `.sdlc/ship-config.json`, `.sdlc/review.json`, and `.sdlc/jira-config.json`, merges them into `.claude/sdlc.json` and `.sdlc/local.json`, and optionally deletes the legacy files.

### Skip specific sections

```text
/setup-sdlc --skip jira --skip ship
```

Configures only version and review sections, skipping Jira and ship setup.

---

## Prerequisites

- Must be inside a git repository
- Node.js >= 16 (for `setup-prepare.js`)

---

## What It Creates or Modifies

| File | Purpose |
|------|---------|
| `.claude/sdlc.json` | Unified project config with `version`, `ship`, and `jira` sections |
| `.sdlc/local.json` | User-local config with `review` scope preferences |

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
- [`/ship-sdlc`](ship-sdlc.md) — shipping pipeline (reads config from `.claude/sdlc.json`)
- [`/jira-sdlc`](jira-sdlc.md) — Jira integration (reads config from `.claude/sdlc.json`)
