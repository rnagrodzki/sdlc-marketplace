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
│       ├── skills/               # Skill definitions (user-invocable skills appear in the / menu)
│       │   └── <skill-name>/
│       │       ├── SKILL.md      # Skill entry point (YAML frontmatter + instructions)
│       │       └── *.md          # Optional supporting files
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

When a plugin is loaded from a marketplace, Claude Code installs skills so that
user-invocable skills are callable directly by their directory name — with **no prefix**.

**Skills** — a skill named `pr-sdlc` in `skills/pr-sdlc/` is invoked as `/pr-sdlc`:

| Directory             | Invocation        |
|-----------------------|-------------------|
| `skills/pr-sdlc/`     | `/pr-sdlc`        |
| `skills/review-sdlc/` | `/review-sdlc`    |
| `skills/version-sdlc/`| `/version-sdlc`   |

The `-sdlc` suffix on each skill name provides disambiguation: action word first,
`-sdlc` suffix ensures the skill is identifiable in a user's combined skill namespace
(project skills + plugin skills). Use the pattern `<action>-sdlc` for all skills in
this plugin.

The `name` field in `plugin.json` is a plugin identifier used for marketplace/update
operations — **not** the prefix for skill invocations. Keep it stable.

### Skills

Skills are directories under `plugins/<plugin>/skills/`. Each skill directory must
contain a `SKILL.md` file with YAML frontmatter:

```yaml
---
name: skill-name
description: "When Claude should invoke this skill (max 1024 characters)"
user-invocable: true
---
```

The `description` field is critical — Claude uses it to decide when to activate the
skill. Write it as a trigger condition, not a summary.

Set `user-invocable: true` to make the skill appear in the `/` menu so users can invoke
it directly (e.g., `/pr-sdlc`). Set it to `false` for internal skills that should only
be invoked by Claude automatically or by other skills — not by users directly.

Supporting files (`.md` templates, checklists, scripts) live alongside `SKILL.md` in
the same directory. Reference them with relative paths like `./supporting-file.md`.

### Commands (legacy)

Commands are `.md` files under `plugins/<plugin>/commands/`. The filename (without `.md`)
becomes the slash command name, prefixed with the plugin name. Each file has YAML
frontmatter:

```yaml
---
description: "Short description shown in command list"
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---
```

**The skills-primary model is preferred.** New functionality should be added as skills
with `user-invocable: true` rather than as commands. Commands remain supported for
backwards compatibility but are no longer the recommended entry point.

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

3. Follow the same structure: `skills/`, `hooks/` (and optionally `scripts/`, `commands/`)
