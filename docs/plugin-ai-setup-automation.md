# Plugin: ai-setup-automation — Reference

## Overview

`ai-setup-automation` creates and continuously evolves AI-ready project configurations (`CLAUDE.md`, `.claude/` directory) for any codebase. See the [README](../README.md) for installation and quick start.

---

## Skills Reference

### `aisa:aisa-init` — Build from Scratch

Full 6-phase pipeline: discover project → design skills/agents → critique → generate → critique → wire.

```text
aisa:aisa-init specs/
aisa:aisa-init openspec/
aisa:aisa-init          # auto-detects specs location
```

**When**: New project setup, full `.claude/` rebuild, starting fresh.
**Model**: opus
**Phases**: Discovery → Design → Critique → Generate → Critique → Wire

---

### `aisa:aisa-evolve` — Full Evolution Cycle

7-phase pipeline: snapshot → drift audit → harvest learnings → expansion analysis → change plan → critique → execute.

```text
aisa:aisa-evolve
aisa:aisa-evolve payment-integration   # emphasize a specific area
```

**When**: Every 2-4 weeks, after major features, when setup feels stale.
**Model**: opus
**Phases**: Snapshot → Drift → Harvest → Expand → Plan → Critique → Execute

---

### `aisa:aisa-evolve-health` — Quick Health Check

Read-only drift scan. Reports status of every skill/agent/CLAUDE.md. Only fixes critical issues.

```text
aisa:aisa-evolve-health
```

**When**: Weekly, before sprints, quick sanity check.
**Model**: sonnet
**Output**: Health report with CURRENT/OUTDATED/STALE/CRITICAL status per file.

---

### `aisa:aisa-evolve-harvest` — Promote Learnings

Processes ACTIVE entries in `.claude/learnings/log.md` into skills, docs, and specs.

```text
aisa:aisa-evolve-harvest
```

**When**: 10+ ACTIVE learning entries, or oldest entry >2 weeks old.
**Model**: sonnet
**Actions**: Promotes to skill gotchas, creates new skills, fills doc gaps, rewrites unclear rules.

---

### `aisa:aisa-evolve-target` — Targeted Update

Scoped update after a specific change. Fast, focused, no full evolution.

```text
aisa:aisa-evolve-target added Stripe webhook handler for subscription cancellation
aisa:aisa-evolve-target refactored auth module from sessions to JWT
aisa:aisa-evolve-target new PIX payment integration
```

**When**: After shipping a feature, completing a refactor, adding an integration.
**Model**: sonnet
**Scope**: Only the affected skills/agents. Flags but doesn't fix unrelated drift.

---

### `aisa:aisa-evolve-postmortem` — Learn from Incidents

Creates learning entries, identifies skill gaps that allowed the incident, proposes prevention.

```text
aisa:aisa-evolve-postmortem webhook retry loop caused duplicate payments
aisa:aisa-evolve-postmortem OIDC token refresh race condition in concurrent requests
aisa:aisa-evolve-postmortem test suite passed but feature broke in production due to mocked repo
```

**When**: After incidents, painful bugs, production issues, long debugging sessions.
**Model**: opus
**Actions**: Creates learning entries, updates skills with prevention rules, closes test gaps.

---

### `aisa:aisa-evolve-validate` — Principle Compliance Check

Validates all skills and agents against architectural principles (self-learning, Plan→Critique→Improve→Do→Critique→Improve, structural completeness). Does NOT check codebase accuracy — purely structural/pattern validation.

```text
aisa:aisa-evolve-validate
aisa:aisa-evolve-validate .claude/skills/my-new-skill.md     # validate specific file
aisa:aisa-evolve-validate .claude/agents/                     # validate all agents
```

**When**: After introducing new skills/agents independently, before committing skill changes, after manual edits.
**Model**: sonnet
**Checks**: Self-learning directives, Quality Gates sections, agent frontmatter, tool validity, self-review workflow, capability-tool consistency.
**Does NOT**: Check codebase accuracy, file paths, symbol signatures, or content quality — that's `aisa:aisa-evolve-health`.

---

### `aisa:aisa-evolve-cache` — Manage Snapshot Cache

Maintains `.claude/cache/` for incremental scanning. Reduces token consumption by 60-80% on repeat evolution runs.

```text
aisa:aisa-evolve-cache              # rebuild cache from current state
aisa:aisa-evolve-cache status       # report cache freshness
aisa:aisa-evolve-cache invalidate   # force full scan on next run
```

**When**: After any aisa-evolve cycle (auto-rebuilt), or manually when cache seems stale.
**Model**: sonnet
**Output**: `.claude/cache/snapshot.json` (file hashes + principle flags) and `drift-report.json` (last audit results).

---

### `aisa:aisa-evolve-principles` (dependency only)

Shared principles, tool registry, and behavioral rules for all `aisa-*` skills. Never invoked directly — loaded as a dependency by other skills.

---

## Commands — Extended Usage

### `/aisa:postmortem` — Guided Incident Analysis

Walks you through describing an incident with interactive questions, checks recent git history for evidence, then hands off to the `aisa-evolve-postmortem` skill to encode the lessons into your skills so the same mistake can't happen again.

```text
/aisa:postmortem
```

Answer questions one at a time:

```text
What went wrong? Describe the incident, bug, or painful situation.
> webhook retry loop caused duplicate payments in checkout

How did you find out?
> customer support tickets, 3 duplicate charges reported

How was it fixed — or is it still open?
> added idempotency key check before processing retry

How long did it take to identify the root cause?
> ~4 hours

Which part of the codebase or system was involved?
> payments/webhook_handler.py and the Stripe retry config
```

Or skip the Q&A by providing a description upfront:

```text
/aisa:postmortem webhook retry loop caused duplicate payments in checkout
/aisa:postmortem OIDC token refresh race condition in concurrent requests
/aisa:postmortem test suite passed but feature broke in production due to mocked repo
```

**When**: After incidents, painful bugs, production issues, long debugging sessions.
**Requires**: A project with `.claude/` configured (run `/aisa:setup` first if not).
**Delegates to**: `aisa:aisa-evolve-postmortem` skill for root cause → skill gap analysis.

### `/aisa:validate` — Principle Compliance

Thin wrapper around the `aisa-evolve-validate` skill. Validates all `.claude/` skills and agents against architectural principles — structural completeness, self-learning directives, and Plan→Critique→Improve→Do→Critique→Improve patterns. Does NOT check codebase accuracy.

```text
/aisa:validate
/aisa:validate .claude/skills/my-new-skill/SKILL.md   # validate specific file
/aisa:validate .claude/agents/                         # validate all agents
```

**When**: After adding or editing skills/agents, before committing `.claude/` changes, as a pre-flight check in any workflow that creates or modifies skills.
**Requires**: A project with `.claude/` configured (run `/aisa:setup` first if not).
**Delegates to**: `aisa:aisa-evolve-validate` skill for all checks and optional fix application.

---

## Recommended Cadence

| When | Skill to run |
| --- | --- |
| New project or full rebuild | `aisa:aisa-init` |
| After shipping a feature or refactor | `aisa:aisa-evolve-target` |
| Weekly or before a sprint | `aisa:aisa-evolve-health` |
| Every 2–4 weeks | `aisa:aisa-evolve` |
| When 10+ learning log entries accumulate | `aisa:aisa-evolve-harvest` |
| After an incident or painful bug | `aisa:aisa-evolve-postmortem` |
| After writing new skills or agents | `/aisa:validate` → `aisa:aisa-evolve-validate` |

---

## Lifecycle Diagram

```text
New project ──→ /aisa-init ──→ daily development ──→ /aisa-evolve-target (after features)
                    │                  │                       │
                    │                  ├── /aisa-evolve-health (weekly)
                    │                  ├── /aisa-evolve-harvest (when log fills up)
                    │                  ├── /aisa-evolve-validate (after adding/editing skills)
                    │                  ├── /aisa-evolve (every 2-4 weeks)
                    │                  └── /aisa-evolve-postmortem (after incidents)
                    │
                    └── /aisa-evolve-cache (auto-rebuilt after each cycle)
```

---

## File Structure

```text
.claude/skills/
├── aisa-init/
│   ├── SKILL.md          # aisa:aisa-init — build from scratch
│   └── REFERENCE.md      # Full pipeline specification
├── aisa-evolve/
│   ├── SKILL.md          # aisa:aisa-evolve — full evolution cycle
│   └── REFERENCE.md      # Full Evolver pipeline specification
├── aisa-evolve-health/
│   └── SKILL.md          # aisa:aisa-evolve-health — quick health check
├── aisa-evolve-harvest/
│   └── SKILL.md          # aisa:aisa-evolve-harvest — promote learnings
├── aisa-evolve-target/
│   └── SKILL.md          # aisa:aisa-evolve-target — scoped update
├── aisa-evolve-validate/
│   ├── SKILL.md          # aisa:aisa-evolve-validate — principle compliance
│   └── REFERENCE.md      # Validation checks specification
├── aisa-evolve-cache/
│   └── SKILL.md          # aisa:aisa-evolve-cache — snapshot cache management
├── aisa-evolve-postmortem/
│   └── SKILL.md          # aisa:aisa-evolve-postmortem — incident learning
└── aisa-evolve-principles/
    └── SKILL.md          # Shared principles and rules (dependency only)
```

---

## Scaling: Execution Modes and Token Optimization

### Execution Mode Selector (auto-detected)

| Setup size (skills + agents) | Mode | Token multiplier | Best for |
| --- | --- | --- | --- |
| ≤ 15 | Subagent parallel (`Task` tool) | ~2× | Independent workstreams, fresh context per audit |
| > 15 | Agent Teams (experimental) | ~3-4× | Cross-cutting drift, inter-agent coordination |

**Always parallel.** Even small setups benefit from workstream isolation — each subagent gets a fresh context window, preventing audit fatigue and token bloat in the orchestrator.

**Agent Teams** require `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Teammates get their own context windows and can share findings with each other (unlike subagents which only report back to the orchestrator). Use when workstreams have cross-cutting dependencies — e.g., a renamed type affects both domain and technical skills.

### Cache-First Incremental Scanning

All `aisa-evolve-*` skills check `.claude/cache/snapshot.json` before scanning:

- **UNCHANGED** files (hash match) → skip deep audit, carry forward cached status
- **MODIFIED** files (hash differs) → full audit
- **NEW** files (not in cache) → full audit
- **DELETED** files (in cache, not on disk) → flag for cleanup

Token savings: **60-80%** on typical runs where <30% of files changed. Cache is rebuilt automatically after every full `aisa-evolve` cycle.

---

## Core Principles

Enforced across all commands:

1. **Spec-driven development** — specs are source of truth
2. **Functional-first testing** — real infra, mock only at lowest external boundary
3. **Three-dimensional domains** — technical + business + design
4. **Continuous learning** — capture during work, promote to skills over time (self-learning directives mandatory)
5. **Plan → Critique → Improve → Do → Critique → Improve** — every skill/agent workflow must critique the plan before executing and review output before delivery (dual quality gates mandatory)
6. **Specificity over generics** — every skill must be THIS project's skill, not generic advice
7. **Critique gates** — mandatory dual quality checks (one before execution, one before delivery) prevent both flawed plans and shallow output
8. **Structural completeness** — agents must have valid frontmatter, real tools, and capability-tool consistency
9. **Cache-first scanning** — check snapshot hashes before deep-reading files; skip unchanged content to minimize token consumption
10. **Always parallel** — use subagent workstreams or Agent Teams for every audit; never single-thread through the full setup
