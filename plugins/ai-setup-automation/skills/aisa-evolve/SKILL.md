---
name: aisa-evolve
description: "Full evolution cycle for an existing .claude/ setup. Verifies skills/agents against current codebase, detects drift, harvests learnings, identifies expansion needs, and applies prioritized updates. Run every 2-4 weeks or after major features."
argument-hint: "[focus-area]"
---

# Project Skills & Agents Evolver — Full Cycle

Verify, update, and expand the existing `.claude/` setup against the current state of the project.

## Quick Start

Optional focus area: `$ARGUMENTS` (if provided, emphasize this area but still scan everything)

If `$ARGUMENTS` = `dry-run`: execute Phases 1-6, output the full change plan, but skip Phase 7 (Execute).
Useful for previewing what an evolution cycle would change without modifying any files.

## Instructions

Read the full pipeline specification in `REFERENCE.md` (in this skill's directory) and execute all 7 phases.

**Before Phase 1**: Check `.claude/cache/snapshot.json` — if present, use incremental scanning
(only deep-audit files whose hashes changed). See `aisa-evolve-cache` skill for protocol.

**Execution mode** — always parallel:
- `≤ 15` items → subagent parallel via `Task` tool (workstreams)
- `> 15` items → Agent Teams if enabled, else subagent parallel

```
Phase 1 — Snapshot           → inventory .claude/ + scan project (CACHE-FIRST)
Phase 2 — Drift Audit        → reality check every skill/agent (INCREMENTAL if cached)
Phase 3 — Learnings Harvest  → process ACTIVE entries into promotions
Phase 4 — Expansion Analysis → identify missing skills/agents for new code/specs/domains
Phase 5 — Change Plan        → consolidate into prioritized manifest (P0→P5)
Phase 6 — Critique           ← QUALITY GATE
Phase 7 — Execute            → apply approved changes + REBUILD CACHE
```

## Priority System

- **P0 CRITICAL FIX** — Skill states something wrong. Agents produce incorrect code. Fix first.
- **P1 STALE CLEANUP** — Broken references, deleted code, obsolete patterns.
- **P2 DRIFT UPDATE** — Partially correct, missing recent changes.
- **P3 LEARNING PROMOTION** — Accumulated knowledge ready for permanent encoding.
- **P4 EXPANSION** — New skills/agents for new project areas.
- **P5 ENHANCEMENT** — Nice-to-have improvements.

## Critical Rules

1. **Verify before trusting** — never assume existing skills are correct just because they exist
2. **P0 first** — wrong skills are worse than missing skills; fix critical drift immediately
3. **Surgical changes** — update precisely, don't regenerate from scratch unless severely degraded
4. **Promote learnings aggressively** — ACTIVE entries older than 2 weeks with clear patterns should be promoted
5. **Don't expand prematurely** — new skills require concrete evidence in code/specs today
6. **Always leave it better** — even if invoked for a specific area, flag drift elsewhere

## Principle Enforcement (Phase 2 + Phase 6)

During Drift Audit and Critique, validate every skill and agent against the principle checklists
in `.claude/skills/aisa-evolve-principles/SKILL.md` (Skill P1-P3, Agent A1-A6).
Violations are classified as OUTDATED minimum (P2 DRIFT UPDATE). See principles file for
the valid tools list, section templates, and behavioral rules.

## Quality Gate

Before proceeding from Phase 6 (Critique) to Phase 7 (Execute), verify:

- [ ] Every P0 item has a concrete fix — no "investigate later" deferrals
- [ ] The change plan covers all drift identified in Phase 2
- [ ] New skills proposed in Phase 4 cite concrete evidence in today's codebase
- [ ] All changes are surgical — no full regeneration without justification
- [ ] Phase 6 critique was genuinely performed and is not an approval rubber-stamp

## Pause Points

After Phase 2 (Drift Audit) — present drift findings, wait for approval.
After Phase 5 (Change Plan) — present prioritized manifest, wait for approval.
After Phase 6 (Critique) — present quality scores, wait for approval.

## Learning Capture

After each evolution cycle, if meta-patterns emerge about the setup's structure
(e.g., recurring drift in a specific skill cluster, evolution bottlenecks, unexpected
inter-skill dependencies), append entries to `.claude/learnings/log.md` using the standard format.

## Output

Updates existing `.claude/` files surgically. Creates new files only when justified.
Marks learning entries as PROMOTED or STALE. Commits with evolution summary.
