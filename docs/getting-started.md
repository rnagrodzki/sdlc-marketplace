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

> **Note:** Skills are invoked directly by name with no prefix. The `pr-sdlc` skill is invoked as `/pr-sdlc`. See [Architecture](architecture.md#name-resolution) for details.

## Updating

### Via the plugin UI

Open `/plugin`, go to **Marketplaces**, and toggle auto-update for `sdlc-marketplace`.

### Via update commands

```text
/plugin marketplace update sdlc-marketplace
/plugin update sdlc@sdlc-marketplace
```

## First Use

### Code review setup

The plugin provides a project-customizable multi-dimension code review system.

**Step 1 — Create review dimensions** (one-time per project):

```text
/review-init-sdlc
```

Scans your tech stack and proposes tailored dimension files (security, API contracts, test coverage, etc.) in `.claude/review-dimensions/`. Run with `--add` to expand an existing set.

**Step 2 — Run reviews** (on any feature branch):

```text
/review-sdlc
```

Matches dimensions to your changed files, dispatches parallel review subagents, deduplicates findings, and posts a consolidated comment to the PR.

### Creating a pull request

```text
/pr-sdlc
```

Generates a structured PR description from your commits and diffs, then opens the PR via `gh`.

## What Gets Created

| File / Directory | Purpose |
| --- | --- |
| `.claude/review-dimensions/` | Per-project code review dimension files (created by `/review-init-sdlc`) |
| `.claude/pr-template.md` | Project PR template (created by `/pr-customize-sdlc`) |
| `.claude/version.json` | Release configuration (created by `/version-sdlc --init`) |

## Next Steps

- Read [Architecture](architecture.md) to understand how the plugin works
- Read [Adding Skills](adding-skills.md) to create project-specific skills
- Read [Adding Commands](adding-commands.md) to create custom slash commands (legacy — prefer skills)
- Read [Adding Hooks](adding-hooks.md) to set up automated actions
