---
name: aisa-evolve-harvest
description: "Process accumulated learnings from .claude/learnings/log.md into skills and docs. Promotes recurring patterns into skill gotchas, creates new skills for uncovered domains, fills documentation gaps. Run when learning log has 10+ ACTIVE entries."
---

# Learnings Harvest

Promote accumulated development knowledge into permanent architecture.

## Instructions

Execute Phase 3 (Learnings Harvest) from the Evolver pipeline in `.claude/skills/aisa-evolve/REFERENCE.md`.

### Step 1 — Read the Learning Log

Read `.claude/learnings/log.md`. Count entries by status and category:

```
ACTIVE: {N}  |  PROMOTED: {N}  |  STALE: {N}
By category: GOTCHA({n}) PATTERN_DISCOVERED({n}) PATTERN_FAILED({n}) DOC_GAP({n}) 
             DEPENDENCY_QUIRK({n}) CONVENTION_VIOLATION({n}) PERFORMANCE({n}) INFRA({n})
```

If 0 ACTIVE entries → report "nothing to harvest" and stop.

### Step 2 — Cluster Analysis

Group ACTIVE entries by theme. Look for:

- **2+ entries with same gotcha** → HIGH priority promotion to existing skill
- **3+ entries in uncovered domain** → signal for new skill
- **DOC_GAP entries** → collect for docs/ updates
- **PATTERN_FAILED entries** → add to anti-patterns in relevant skills
- **CONVENTION_VIOLATION entries** → the skill's rules aren't clear enough — revise the rule, not just add a gotcha

### Step 3 — Propose Promotions

For each action, present:

```
## Harvest Proposal

### Promotions to Existing Skills
| Entry | Target Skill | Section | Content to Add |
|-------|-------------|---------|----------------|
| {title} | {skill}.md | Learned Gotchas | {specific text} |

### New Skills Proposed
| Proposed Name | Dimension | Justified By | Key Content |
|--------------|-----------|--------------|-------------|
| {name} | {tech/bus/design} | {entry list} | {summary} |

### Doc Updates
| Entry | Target Doc | Gap Being Filled |
|-------|-----------|------------------|
| {title} | docs/{file} | {description} |

### Rule Rewrites (from convention violations)
| Skill | Current Rule | Problem | Proposed Rewrite |
|-------|-------------|---------|-----------------|
| {skill} | {current text} | {why it's unclear} | {clearer version} |

### Entries to Mark STALE
| Entry | Reason |
|-------|--------|
| {title} | {references removed code / no longer applicable} |
```

### Step 4 — Apply

After approval:

1. Add promoted content to skill files (Learned Gotchas, Anti-Patterns, or Rules sections)
2. Create new skills following the template from `.claude/skills/aisa-init/REFERENCE.md` Phase 4.1
3. Update docs/ files as proposed
4. Mark entries in log.md: change `- **Status**: ACTIVE` to `- **Status**: PROMOTED:{target}` or `STALE`
5. Update CLAUDE.md skills/agents tables if new skills were created
6. When promoting to an existing skill, verify the target has self-learning directives and critique-improve cycle; if missing, add them alongside the promotion
7. When creating new skills, ensure they include Quality Gates and Learning Capture sections from the start
8. Commit:
```
chore: harvest learnings into skills

- Promoted {N} entries to existing skills
- Created {N} new skills: {names}
- Updated {N} docs
- Marked {N} entries STALE
```

## Quality Gate

Before presenting the harvest proposal, verify:

- [ ] Each promotion target exists (run `ls .claude/skills/{target}.md`) or has justified rationale for creation
- [ ] Proposed location is appropriate for content type (gotcha → Learned Gotchas, pattern → Patterns, anti-pattern → Anti-Patterns)
- [ ] Non-existent promotion targets without creation rationale → remove from proposal

**Principle compliance** — apply to every promotion target and new skill/agent:

Validate against Skill P1-P3 and Agent A1-A6 from `.claude/skills/aisa-evolve-principles/SKILL.md`.
Use templates from the same file when adding missing sections. New skills include both
Quality Gates and Learning Capture from creation — no "add later" deferrals.

## Cache Update

After promotions are committed, update `.claude/cache/snapshot.json` entries for:
- Modified skills (new hash, updated principle flags)
- New skills (add entry with hash and principle flags)
- Modified learning log (new hash, updated counts)

This partial update keeps the cache fresh without requiring a full rebuild.

## See Also

- After promoting learnings → run `/aisa-evolve-validate` to verify new/updated skills
- If promotions reveal deep drift → run `/aisa-evolve-health` or full `/aisa-evolve`
- For incident-driven learnings → use `/aisa-evolve-postmortem` instead

## Learning Capture

If discoveries are made during the harvest (e.g., patterns in the learning log that reveal systemic issues,
skill gaps not visible from individual entries), append entries to `.claude/learnings/log.md`.
