---
name: validate-skill-docs
description: "Use after modifying plugin skills, docs/skills/ pages, or site/src/data/skills-meta.ts. Validates content consistency between SKILL.md files and their documentation surfaces: skills-meta.ts field accuracy, connection validity, doc template compliance, and flag documentation."
---

# Validate Skill Docs

After modifying skill workflows, flags, or documentation surfaces, run this validation
to catch content drift between SKILL.md files and their docs/skills-meta.ts/README representations.

## When to Use

Invoke this skill when you have modified any of:

- `plugins/sdlc-utilities/skills/*/SKILL.md` (workflow steps or flags changed)
- `docs/skills/*.md` (documentation content)
- `site/src/data/skills-meta.ts` (metadata entries)

## Step 1 — Run the Validation Script

```bash
node .claude/skills/validate-skill-docs/check-docs-consistency.js
```

If the script exits 0: all checks pass — proceed.

If the script exits 1: fix each issue before finishing the task (see Step 2).

If the script exits 2: run from the repository root or pass `--project-root <path>`.

## Step 2 — Fix Issues Found

For each finding, apply the appropriate fix:

### `user-invocable-match` (error)

The `userInvocable` boolean in skills-meta.ts does not match the `user-invocable` frontmatter
value in the skill's SKILL.md. Update one to match the other — the SKILL.md frontmatter is
the source of truth.

### `connections-valid` (error)

A `connections[].to` value in skills-meta.ts references a slug that does not exist in the
skillsMeta array. Fix the typo or add the missing skill entry.

### `doc-template-sections` (warning)

A `docs/skills/<name>.md` file is missing one or more required sections from the doc template.
Add the missing sections using `docs/skill-doc-template.md` as the reference.

Required sections: Overview, Usage, Examples, Prerequisites, What It Creates or Modifies,
Related Skills. The Flags section is optional.

### `doc-flags-present` (warning)

A skill has `--` flags in its `argument-hint` but the corresponding `docs/skills/<name>.md`
Flags table does not mention any of them. Add the missing flags to the Flags table.

## Step 3 — Re-run Validation

After fixing all issues:

```bash
node .claude/skills/validate-skill-docs/check-docs-consistency.js
```

Confirm exit 0 before marking work complete.
