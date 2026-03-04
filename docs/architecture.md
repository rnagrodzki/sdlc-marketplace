# Architecture

## Overview

This repository serves two roles:

1. **Marketplace** — The root `.claude-plugin/marketplace.json` makes the repo installable
   as a Claude Code marketplace
2. **Plugin** — One plugin lives under `plugins/sdlc-utilities/` with its own skills, commands, hooks,
   scripts, and agents

## Directory Structure

```text
sdlc-marketplace/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace manifest (entry point)
├── plugins/
│   └── sdlc-utilities/           # Plugin: SDLC automation
│       ├── .claude-plugin/
│       │   └── plugin.json       # Plugin manifest (name: "sdlc")
│       ├── agents/               # Agent definitions (orchestrators spawned by skills)
│       ├── skills/               # Skill definitions
│       │   └── <skill-name>/
│       │       ├── SKILL.md      # Skill entry point (YAML frontmatter + instructions)
│       │       └── *.md          # Optional supporting files
│       ├── commands/             # Slash command definitions
│       │   └── <command>.md      # Command file (YAML frontmatter + instructions)
│       ├── hooks/
│       │   └── hooks.json        # Hook configuration
│       └── scripts/
│           ├── pr-prepare.js          # Pre-computes git data for PR descriptions
│           ├── review-prepare.js      # Pre-computes git data for code reviews
│           ├── validate-dimensions.js # Validates .claude/review-dimensions/ files
│           └── lib/                   # Shared modules (git, dimensions)
└── docs/                         # Documentation
```

## How It Works

### Marketplace Layer

The root `marketplace.json` tells Claude Code: "This repository contains plugins. Here
is where to find them." It lists each plugin with a name and a relative source path.

When a user runs `/plugin marketplace add rnagrodzki/sdlc-marketplace` in Claude Code:

1. Clones or references this repository
2. Reads `.claude-plugin/marketplace.json`
3. Discovers the listed plugins and makes them available to browse

No plugins are installed yet at this point. The user must then run `/plugin install sdlc@sdlc-marketplace` (or use the interactive **Discover** tab in `/plugin`) to install the plugin.

**Important:** The `name` in each `marketplace.json` plugin entry must match the `name` in the corresponding `plugin.json`. A mismatch causes "plugin not found" errors when users try to update via the `/plugin` UI, because Claude Code looks up the installed plugin identity (from `plugin.json`) in the marketplace catalog.

### Plugin Layer

Each plugin has its own `.claude-plugin/plugin.json` that declares:

- **name** and **description** — Identification
- **version** — Semantic version for tracking updates
- **author** — Who maintains this plugin

### Name Resolution

When a plugin is loaded from a marketplace, Claude Code prefixes all commands and skills
with the plugin's `name` (from `plugin.json`), using the format `<plugin-name>:<item-name>`.

**Commands** — invoked as `/<plugin-name>:<command-name>`:

| File                | `plugin.json` `name` | Resolved command    |
|---------------------|----------------------|---------------------|
| `commands/pr.md`    | `sdlc`               | `/sdlc:pr`          |
| `commands/review.md`| `sdlc`               | `/sdlc:review`      |

**Skills** — referenced as `<plugin-name>:<skill-name>`:

| Directory                          | `plugin.json` `name` | Resolved name                       |
|------------------------------------|----------------------|-------------------------------------|
| `skills/creating-pull-requests/`   | `sdlc`               | `sdlc:creating-pull-requests`       |
| `skills/reviewing-changes/`        | `sdlc`               | `sdlc:reviewing-changes`            |

The `name` field in `plugin.json` is the namespace prefix — **not** the directory name. Keep it
stable — renaming it changes every command and skill name for all installed users.

### Skills

Skills are directories under `plugins/<plugin>/skills/`. Each skill directory must
contain a `SKILL.md` file with YAML frontmatter:

```yaml
---
name: skill-name
description: "When Claude should invoke this skill (max 1024 characters)"
---
```

The `description` field is critical — Claude uses it to decide when to activate the
skill. Write it as a trigger condition, not a summary.

Supporting files (`.md` templates, checklists, scripts) live alongside `SKILL.md` in
the same directory. Reference them with relative paths like `./supporting-file.md`.

### Commands

Commands are `.md` files under `plugins/<plugin>/commands/`. The filename (without `.md`)
becomes the slash command name. Each file has YAML frontmatter:

```yaml
---
description: "Short description shown in command list"
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---
```

For example, `commands/pr.md` creates the `/pr` command (resolved to `/sdlc:pr`).

### Hooks

Hooks are defined in `plugins/<plugin>/hooks/hooks.json`. Available hook points:

| Hook          | When It Fires                                                         |
|---------------|-----------------------------------------------------------------------|
| `SessionStart`| When a Claude Code session begins                                     |
| `PreToolUse`  | Before a tool is invoked (use `matcher` to filter by tool name)       |
| `PostToolUse` | After a tool completes                                                |

See [adding-hooks.md](adding-hooks.md) for the complete list of hook events.

## Adding a New Plugin

To add another plugin to this marketplace:

1. Create `plugins/<new-plugin-name>/` with its own `.claude-plugin/plugin.json`
2. Add an entry to the root `marketplace.json`:

   ```json
   {
     "name": "new-plugin-name",
     "source": "./plugins/new-plugin-name"
   }
   ```

3. Follow the same structure: `skills/`, `commands/`, `hooks/` (and optionally `scripts/`)
