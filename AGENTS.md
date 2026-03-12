# SDLC Utilities — Claude Code Plugin Marketplace

This repository is a **Claude Code plugin marketplace** that ships the `sdlc-utilities` plugin for software development lifecycle (SDLC) automation.

---

## Repository Layout

```text
.claude-plugin/marketplace.json   # Marketplace manifest (entry point)
plugins/
  sdlc-utilities/                 # Plugin: SDLC automation (PRs, code review, releases)
docs/                             # Architecture, getting-started, skill/command/hook guides
README.md
```

Each plugin lives under `plugins/<name>/` and follows the structure:

```text
.claude-plugin/plugin.json   # Plugin manifest
skills/                      # Skills (one subdirectory each; user-invocable skills appear in the / menu)
hooks/hooks.json             # Session-start and other hooks
scripts/                     # Node.js helper scripts (optional; invoked via Bash)
```

---

## Architecture Principles

1. **Spec-driven development** — design before implementation
2. **Plan → Critique → Improve → Do → Critique → Improve** — mandatory dual critique gates in every pipeline (critique the plan, then critique the output)
3. **Parallel execution** — always run independent steps concurrently
4. **Specificity over generics** — every skill targets a concrete task

---

## Constraints

- **Never run `promptfoo eval` automatically.** The LLM must never execute `promptfoo eval` (for all test cases or any subset) on its own. Evaluation runs must always be initiated manually by the user.

---

## Working in This Repository

- **Adding a skill:** Follow `docs/adding-skills.md`. Place the skill under `plugins/<plugin>/skills/<skill-name>/SKILL.md`.
- **Adding a command (legacy):** Follow `docs/adding-commands.md`. New functionality should be added as skills with `user-invocable: true` instead.
- **Adding a hook:** Follow `docs/adding-hooks.md`. Edit `plugins/<plugin>/hooks/hooks.json`.
- **Plugin manifest fields:** See `docs/architecture.md` for required fields in `plugin.json`.

---

## Documenting Skills

Every skill must have a dedicated reference doc in `docs/skills/<skill-name>.md`. Use `docs/skill-doc-template.md` as the starting point.

Each skill doc must include:

- **Overview** — what the skill does in 2–3 sentences
- **Usage** — basic invocation
- **Flags** — table with flag, description, and default
- **Examples** — concrete invocations with expected output
- **Prerequisites** — required tools and config files
- **What It Creates or Modifies** — files and artifacts produced
- **Related Skills** — cross-links to companion skills

The skill name in `docs/skills/` must match the skill directory name in `plugins/<plugin>/skills/`. Link the doc from the skills table in `README.md`.
