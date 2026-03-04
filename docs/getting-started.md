# Getting Started

## Installation

### Step 1 — Add the marketplace

```text
/plugin marketplace add rnagrodzki/sdlc-marketplace
```

This registers the marketplace catalog with Claude Code. No plugins are installed yet.

### Step 2 — Install the plugin

```text
/plugin install sdlc@sdlc-marketplace
```

Or browse interactively: run `/plugin`, go to the **Discover** tab, and select the plugin to install.

### Verifying Installation

After installation, start a new Claude Code session. You should see a message from the plugin:

```text
[sdlc-utilities] Plugin loaded. Use /sdlc:pr to create a pull request, /sdlc:review to run a code review, /sdlc:review-init to set up review dimensions.
```

> **Note:** Commands and skills are namespaced with the plugin name. The `/pr` command
> becomes `/sdlc:pr`. See [Architecture](architecture.md#name-resolution) for details.

## Updating the Plugin

### Refresh the marketplace catalog

```text
/plugin marketplace update sdlc-marketplace
```

### Update the plugin

```text
/plugin update sdlc@sdlc-marketplace
```

### Enable auto-update

Open `/plugin`, go to the **Marketplaces** tab, and toggle auto-update for `sdlc-marketplace`.

## First Use

### Code Review Setup

The plugin provides a project-customizable multi-dimension code review system.

**Step 1 — Create review dimensions** (one-time per project):

```text
/sdlc:review-init
```

Scans your tech stack and proposes tailored dimension files (security, API contracts,
test coverage, etc.) in `.claude/review-dimensions/`. Run with `--add` to expand an
existing set.

**Step 2 — Run reviews** (on any feature branch):

```text
/sdlc:review
```

Matches dimensions to your changed files, dispatches parallel review subagents,
deduplicates findings, and posts a consolidated comment to the PR.

### Creating a Pull Request

```text
/sdlc:pr
```

Generates a structured PR description from your commits and diffs, then opens the PR via `gh`.

## What Gets Created

| File/Directory               | Purpose                                                                   |
|------------------------------|---------------------------------------------------------------------------|
| `.claude/review-dimensions/` | Per-project code review dimension files (created by `/sdlc:review-init`) |

## Next Steps

- Read [Architecture](architecture.md) to understand how the plugin works
- Read [Adding Skills](adding-skills.md) to create project-specific skills
- Read [Adding Commands](adding-commands.md) to create custom slash commands
- Read [Adding Hooks](adding-hooks.md) to set up automated actions
