# User Request: Plan a New Skill

## User Input

User invokes `/plan-sdlc` with the request:

> Plan a new skill called `example-skill` that does the following: given a directory path,
> it scans for files matching a glob pattern and emits a JSON manifest of file metadata
> (path, size, sha256). The skill should expose a `--root <path>` flag and a `--pattern <glob>`
> flag, default pattern `**/*`. Implement as a Claude Code skill under
> `plugins/sdlc-utilities/skills/example-skill/`.

## Project Context

This is the **sdlc-marketplace** repo. The plugin in scope is `sdlc-utilities`.

### Repository Layout (relevant excerpts)

```text
.claude/sdlc.json                                  # SDLC config (guardrails live here)
plugins/sdlc-utilities/
  skills/                                          # one subdirectory per skill
    plan-sdlc/SKILL.md
    execute-plan-sdlc/SKILL.md
    ...
docs/
  specs/                                           # behavioral contracts (WHAT)
    plan-sdlc.md
    ...
  skills/                                          # usage reference (for end users)
    plan-sdlc.md
    ...
  spec-template.md
  skill-doc-template.md
README.md                                          # contains a "Skills" table listing each skill
site/src/data/skills-meta.ts                       # SkillCard registry powering the docs site
tests/promptfoo/datasets/<skill-name>.yaml         # behavioral test datasets
tests/promptfoo/fixtures/                          # markdown fixtures referenced from datasets
```

### AGENTS.md — Documenting Skills (verbatim excerpt)

> Every skill requires three artifacts:
>
> 1. **Specification** at `docs/specs/<skill-name>.md` — behavioral contract (WHAT).
> 2. **SKILL.md** at `plugins/<plugin>/skills/<skill-name>/SKILL.md` — implementation (HOW).
> 3. **Reference doc** at `docs/skills/<skill-name>.md` — usage reference for end users.
>
> The skill name in `docs/skills/` must match the skill directory name in
> `plugins/<plugin>/skills/`. Link the doc from the skills table in `README.md`.

The site additionally renders skill cards from `site/src/data/skills-meta.ts` — every new
skill must add a registry entry there or it will not appear on the docs site.

### Active Plan Guardrails (from .claude/sdlc.json)

```json
[
  { "id": "test-coverage-required", "severity": "error" },
  { "id": "no-ci-bypass", "severity": "error" },
  { "id": "no-auto-eval", "severity": "error" },
  {
    "id": "skill-docs-required",
    "severity": "error",
    "description": "Any task that creates `plugins/*/skills/*/SKILL.md` must include matching entries for all four companion artifacts: `docs/specs/<skill-name>.md` (spec), `docs/skills/<skill-name>.md` (reference doc), `README.md` (skills-table row), and `site/src/data/skills-meta.ts` (SkillCard registry). Skill-name is derived from the SKILL.md path's parent directory."
  },
  { "id": "no-scope-creep", "severity": "warning" },
  { "id": "single-responsibility-tasks", "severity": "warning" },
  { "id": "scripts-over-llm-logic", "severity": "error" },
  { "id": "yagni", "severity": "warning" },
  { "id": "cross-skill-consistency", "severity": "error" },
  { "id": "pr-link-github-issue", "severity": "error" },
  { "id": "dry", "severity": "warning" },
  { "id": "kiss", "severity": "warning" },
  { "id": "spec-first", "severity": "error" }
]
```

### What the plan must produce

A plan that creates the new skill. Because the plan introduces
`plugins/sdlc-utilities/skills/example-skill/SKILL.md`, the `skill-docs-required` guardrail
requires the plan's combined Files list to include all four companion artifacts:

- `docs/specs/example-skill.md`
- `docs/skills/example-skill.md`
- `README.md` (skills-table row update)
- `site/src/data/skills-meta.ts` (SkillCard registry entry)

Per `spec-first`, the spec task must be ordered before the SKILL.md task.
