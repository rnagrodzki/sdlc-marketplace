# Getting Started

## Requirements

| Requirement | Version | Notes |
| --- | --- | --- |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | — | This is a Claude Code plugin marketplace |
| Node.js | >= 16 | For helper scripts. Uses built-in modules, no `npm install` needed |
| git | — | Required for diff and commit analysis |
| gh (GitHub CLI) | — | Required for `/pr-sdlc`. Falls back to showing the description if unavailable |

## Installation

### Via the plugin UI (recommended)

1. Open Claude Code and run `/plugin`
2. Go to **Marketplaces** → **Add marketplace** → enter `rnagrodzki/sdlc-marketplace`
3. Go to **Discover** → select `sdlc` → **Install**

### Via CLI commands

```text
/plugin marketplace add rnagrodzki/sdlc-marketplace
/plugin install sdlc@sdlc-marketplace
```

> **Note:** Skills are invoked directly by name with no prefix. The `pr-sdlc` skill is invoked as `/pr-sdlc`.

## Updating

### Via the plugin UI

Open `/plugin`, go to **Marketplaces**, and toggle auto-update for `sdlc-marketplace`.

### Via update commands

```text
/plugin marketplace update sdlc-marketplace
/plugin update sdlc@sdlc-marketplace
```

## First Use

Run the unified setup skill to configure the plugin for your project:

```text
/setup-sdlc
```

This walks you through:
- **Version config** — version source, tag prefix, changelog
- **Ship config** — pipeline preset, bump type, review threshold
- **Review dimensions** — project-tailored code review criteria
- **PR template** — customized PR descriptions

Individual skills can also be configured independently:
- `/review-init-sdlc` — create review dimensions
- `/pr-customize-sdlc` — create PR template
- `/version-sdlc --init` — configure versioning

## What Gets Created

| File / Directory | Purpose |
| --- | --- |
| `.claude/sdlc.json` | Unified project config — version, ship, jira settings (created by `/setup-sdlc`) |
| `.sdlc/local.json` | User-local config — review scope preferences (created by `/setup-sdlc`) |
| `.claude/review-dimensions/` | Per-project code review dimension files (created by `/review-init-sdlc`) |
| `.claude/pr-template.md` | Project PR template (created by `/pr-customize-sdlc`) |

