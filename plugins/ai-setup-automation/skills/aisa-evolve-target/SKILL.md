---
name: aisa-evolve-target
description: "Targeted evolution after a specific change (new feature, refactor, new integration). Scans only the affected area, updates relevant skills/agents, proposes new ones if needed. Faster than full /aisa-evolve — use after shipping a feature or completing a refactor."
argument-hint: "<description of what changed>"
---

# Targeted Skills & Agents Update

Update `.claude/` configuration for a specific change without a full evolution cycle.

## Context

What changed: `$ARGUMENTS`

## Instructions

### Step 1 — Scope the Change (Git-First, Cache-Aware)

**Primary path — git diff** (fastest, most precise):

```bash
# Identify exactly what changed
git log --oneline -10
git diff --name-only HEAD~5  # adjust range to match the described change
```

Use the file list from `git diff --name-only` to identify affected skills: only audit
skills that reference paths, modules, or patterns touched by the changed files.

If `.claude/cache/snapshot.json` exists, cross-reference the changed files against cached
skill metadata to narrow scope further.

**Fallback — manual scan** (only if git is unavailable or change predates git history):

Based on the description, identify:

- **Files changed**: Grep git diff or scan the described area to find affected files
- **Domains affected**: Which business/technical/design domains does this touch?
- **Skills potentially affected**: Which existing skills reference the changed code, patterns, or domains?
- **Agents potentially affected**: Which agents work in the affected area?

### Step 2 — Targeted Drift Check

For ONLY the affected skills (not all skills):

- Do code examples still match after the change?
- Do rules still hold?
- Do business rules still apply?
- Do file path references still resolve?
- Has the domain language changed?

For ONLY the affected agents:

- Do they still load the right skills?
- Do their workflows still make sense after the change?

Validate against Agent Principles A1-A6 from `.claude/skills/aisa-evolve-principles/SKILL.md`.

Workflow maturity checks on affected skills:

Validate against Skill Principles P1-P3 from `.claude/skills/aisa-evolve-principles/SKILL.md`.
If the change removed required sections, restore them.

For CLAUDE.md:

- Does the tech stack section need updating?
- Do test commands still work?
- Does the mock boundary map need updating?

### Step 3 — New Coverage Needs

Does the change introduce anything that needs new skill content?

- **New patterns**: coding patterns, API patterns, error handling approaches not in any skill
- **New business rules**: domain rules, state transitions, validation logic
- **New integrations**: external APIs, services, databases — need mock boundary updates
- **New domain concepts**: terms, entities, relationships not in any skill's ubiquitous language
- **New test patterns**: new test infrastructure, new fixture approaches

### Step 4 — Propose Changes

Present a focused change plan:

```
## Targeted Update for: {description}

### Affected Scope
- Skills: {list with what needs updating}
- Agents: {list with what needs updating}
- CLAUDE.md sections: {list}

### Changes Proposed

| # | Priority | File | Change | Reason |
|---|----------|------|--------|--------|
| 1 | {P0-P5} | {file} | {description} | {why} |

### New Content Needed
{any new skills, new skill sections, or new agent adjustments}

### Also Noticed (outside scope)
{any drift detected in unrelated skills during the scan — flag but don't fix}
```

### Step 5 — Apply

After approval:

1. Apply changes surgically to affected files only
2. If new learning entries are warranted by the change, append to `.claude/learnings/log.md`
3. Update CLAUDE.md if affected
4. Commit:
```
chore: update skills/agents for {change description}

- Updated {N} skills: {names}
- Updated {N} agents: {names}
- {any new skills created}
- Triggered by: {what changed}
```

## Scope Discipline

- **DO**: Update everything affected by the described change
- **DO**: Flag drift found outside the scope (in "Also Noticed")
- **DO NOT**: Fix drift outside the described scope (save for `/aisa-evolve`)
- **DO NOT**: Create new skills for areas unrelated to the change
- **DO NOT**: Reorganize or restructure the `.claude/` setup — that's `/aisa-evolve` territory
- **NOTE**: `openspec-*` are external framework skills — do not check/enforce workflow maturity patterns on them

## Quality Gate

Before presenting the change plan, verify:

- [ ] Each proposed fix traces to a specific drift item from Step 2
- [ ] No fix targets skills outside the affected scope (without flagging as "Also Noticed")
- [ ] Workflow maturity gaps (missing self-learning or critique-improve) appear in the change plan if detected
- [ ] At least one mechanical check (`ls`, `grep`) was run per affected skill

## Cache Update

After changes are committed, partially update `.claude/cache/snapshot.json`:
- Update hashes and principle flags for modified skills/agents
- Add entries for newly created skills/agents
- Leave unchanged entries intact

## See Also

- After applying targeted fixes → run `/aisa-evolve-validate` on modified files
- If "Also Noticed" section has many items → schedule full `/aisa-evolve`
- If the change caused an incident → use `/aisa-evolve-postmortem` instead

## Learning Capture

If discoveries are made during the targeted update (e.g., unexpected side effects, undocumented
dependencies between skills), append entries to `.claude/learnings/log.md` using the standard format.
