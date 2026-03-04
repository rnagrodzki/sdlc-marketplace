# SDLC Utilities — Claude Code Plugin Marketplace

This repository is a **Claude Code plugin marketplace** that ships the `sdlc-utilities` plugin for software development lifecycle (SDLC) automation. Installation requires two steps:

```text
/plugin marketplace add rnagrodzki/sdlc-marketplace
/plugin install sdlc@sdlc-marketplace
```

---

## Repository Layout

```text
.claude-plugin/marketplace.json   # Marketplace manifest (entry point)
plugins/
  sdlc-utilities/                 # Plugin: SDLC automation (PRs, code review)
docs/                             # Architecture, getting-started, skill/command/hook guides
README.md
```

Each plugin lives under `plugins/<name>/` and follows the structure:

```text
.claude-plugin/plugin.json   # Plugin manifest
commands/                    # Slash commands (*.md)
skills/                      # Skills (one subdirectory each)
hooks/hooks.json             # Session-start and other hooks
scripts/                     # Node.js helper scripts (optional; invoked via Bash)
```

---

## Plugin — `sdlc-utilities`

Automates common SDLC tasks.

### Commands

| Command | Purpose |
| --- | --- |
| `/sdlc:pr [--draft] [--update] [--base <branch>]` | Open or update a pull request with an auto-generated PR description |
| `/sdlc:review [--base <branch>] [--dimensions <name,...>] [--dry-run]` | Run multi-dimension code review on the current branch |
| `/sdlc:review-init [--add]` | Initialize or expand project review dimensions by scanning the tech stack |

---

## Architecture Principles

1. **Spec-driven development** — design before implementation
2. **Plan → Critique → Improve → Do → Critique → Improve** — mandatory dual critique gates in every pipeline (critique the plan, then critique the output)
3. **Parallel execution** — always run independent steps concurrently
4. **Specificity over generics** — every skill targets a concrete task

---

## Working in This Repository

- **Adding a skill:** Follow `docs/adding-skills.md`. Place the skill under `plugins/<plugin>/skills/<skill-name>/SKILL.md`.
- **Adding a command:** Follow `docs/adding-commands.md`. Place it under `plugins/<plugin>/commands/<command>.md`.
- **Adding a hook:** Follow `docs/adding-hooks.md`. Edit `plugins/<plugin>/hooks/hooks.json`.
- **Plugin manifest fields:** See `docs/architecture.md` for required fields in `plugin.json`.
