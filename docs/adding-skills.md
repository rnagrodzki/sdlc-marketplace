# Adding Skills

## Overview

Skills teach Claude how to perform specific tasks. Each skill is a directory containing
a `SKILL.md` file with YAML frontmatter and optional supporting files.

## Creating a New Skill

### Step 1: Create the Directory

```bash
mkdir -p plugins/ai-setup-automation/skills/<skill-name>/
```

Choose a directory name that makes the skill's purpose immediately obvious. Two conventions
are used in this repo — pick the one that fits the plugin's naming style:

- **Prefix pattern** (used by `aisa` skills): `<plugin-prefix>-<noun>`, e.g., `aisa-init`, `aisa-evolve-health`
- **Suffix pattern** (used by `sdlc` skills): `<action-verb>-sdlc`, e.g., `pr-sdlc`, `review-sdlc`, `version-sdlc`

The `-sdlc` suffix convention for this plugin puts the action word first (making the `/` menu
scannable) and appends `-sdlc` for disambiguation in a user's combined namespace of project
skills and plugin skills.

Use lowercase and hyphens only. Avoid vague names (`setup`, `utils`) — names should be specific.

> **Name resolution:** User-invocable skills are callable directly by their directory name with
> no prefix. A skill in `skills/pr-sdlc/` is invoked as `/pr-sdlc`.

### Step 2: Create SKILL.md

```markdown
---
name: <skill-name>
description: "Use this skill when [specific trigger conditions]. Covers [what it does]. Triggers on [keywords or phrases that should activate this skill]."
---

# Skill Title

Brief introduction of what this skill does.

## When to Use This Skill

- Trigger condition one
- Trigger condition two

## Workflow

### Step 1: [First Action]

[Instructions]

### Step 2: [Second Action]

[Instructions]

## Best Practices

1. [Practice one]
2. [Practice two]

## DO NOT

- [Anti-pattern one]
- [Anti-pattern two]
```

### Step 3: Add Supporting Files (Optional)

Place additional `.md` files alongside `SKILL.md` for:
- **Templates** — Reusable file templates referenced from SKILL.md
- **Checklists** — Step-by-step verification lists
- **Examples** — Detailed code examples that would make SKILL.md too long
- **Reference tables** — Configuration reference, API mappings, etc.

Reference them from SKILL.md with relative paths:

```markdown
See `./templates.md` for language-specific templates.
See `./checklist.md` for the full verification checklist.
```

## Rules and Constraints

| Rule | Limit |
|---|---|
| `name` field | Lowercase, hyphens only, max 64 chars. Use prefix or action-suffix pattern (see above). |
| `description` field | Maximum 1024 characters |
| `SKILL.md` content | Maximum 500 lines |
| `user-invocable` field | Set to `true` to expose the skill in the `/` menu so users can invoke it directly (e.g., `/pr-sdlc`). Set to `false` (or omit) for internal skills invoked only by Claude automatically or by other skills. The skills-primary model favors `user-invocable: true` — skills own argument parsing and preparation directly. |

## Writing Effective Descriptions

The `description` field is how Claude decides when to activate your skill. Write it
as a trigger specification, not a summary.

**Good:**
```yaml
description: "Use this skill when setting up AI tooling configuration for a new or existing project. Triggers on 'set up AI config', 'initialize Claude configuration', 'create CLAUDE.md', 'add AI setup', or 'scaffold .claude directory'."
```

**Bad:**
```yaml
description: This skill helps with AI configuration.
```

Include:
- When to use it (action verbs and situations)
- Trigger keywords users might say
- What contexts or file types it applies to

## Example: Minimal Skill

Directory:
```
plugins/ai-setup-automation/skills/reviewing-ai-config/
├── SKILL.md
└── review-criteria.md
```

`SKILL.md`:
```markdown
---
name: reviewing-ai-config
description: "Use when reviewing or auditing an existing AI configuration. Triggers on 'review AI setup', 'audit .claude directory', 'check AI config', or when asked to evaluate the quality of CLAUDE.md or skills."
---

# Reviewing AI Configuration

Audit an existing AI setup and identify improvements.

## Workflow

### Step 1: Check Structure

Verify all expected files exist. See `./review-criteria.md` for the full checklist.

### Step 2: Evaluate CLAUDE.md Quality

Check that CLAUDE.md covers: tech stack, project structure, build/test/lint commands,
and any project-specific conventions.

## Best Practices

- Look for missing sections rather than rewriting what exists
- Suggest additions, not replacements
```
