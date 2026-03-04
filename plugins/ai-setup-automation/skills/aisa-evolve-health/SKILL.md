---
name: aisa-evolve-health
description: "Quick health check of the .claude/ setup. Runs snapshot and drift audit only — no expansion, no changes unless critical issues found. Use weekly or before sprints."
---

# Skills & Agents Health Check

Lightweight verification — read-only unless critical drift is found.

## Instructions

Execute only Phase 1 (Snapshot) and Phase 2 (Drift Audit) from the Evolver pipeline
defined in `.claude/skills/aisa-evolve/REFERENCE.md`.

**Do NOT execute** Phases 3-7. This is a diagnostic, not an update cycle.

### Step 1 — Run the Health Script

Locate the script with `Glob` for `**/verify-setup.js`, then run:

```bash
node <plugin-path>/scripts/verify-setup.js health --project-root . --json
```

The script handles in a single invocation:
- **Cache comparison** — hashes current files against `snapshot.json`, categorizes UNCHANGED/MODIFIED/NEW/DELETED
- **Fast Pass A** — extracts all file paths referenced in each skill/agent, batch-verifies they exist on disk
- **Fast Pass G** — runs P1-P3 / A1-A6 principle checks (grep-based) across all files
- **CLAUDE.md table diff** — compares skills/agents tables against actual files on disk
- **Learnings inbox stats** — counts ACTIVE/PROMOTED/STALE entries

Report the scan mode from the `cache` field: snapshot age, files changed vs unchanged.

### Step 2 — Interpret Results and Supplement

Use the script's `classifications` object as a starting point. The script assigns
CURRENT / OUTDATED / STALE / CRITICAL based on objective pass results.

**Fast Pass F — Code example spot-check (manual, 1 per skill):**
The script extracts code blocks but cannot compare them semantically. For skills
classified as MODIFIED or OUTDATED, pick the single most critical code example
from the skill and compare against the actual source file. Skip pure rule/convention
skills with no code examples.

**Checks NOT run in health mode** (save for full `/aisa-evolve`):
- Symbol verification (Pass B) — expensive grep across src
- Error code verification (Pass C) — expensive cross-reference
- Route/endpoint verification (Pass D) — needs router analysis
- Version compatibility (Pass E) — rare drift, check monthly

**CLAUDE.md quick check:**
Use the script's `claude_md` field for table diff. Additionally run one test command
(e.g., `go test ./... 2>&1 | head -5` or equivalent) to confirm test infrastructure works.

Review and upgrade/downgrade classifications as needed — the script catches mechanical drift;
you catch semantic drift.

Classify each file: **CURRENT** / **OUTDATED** / **STALE** / **CRITICAL**

Classification guidance for workflow maturity:
- Missing self-learning directives → OUTDATED minimum
- Missing critique-improve cycle → OUTDATED minimum
- These don't escalate to CRITICAL alone, but compound with other drift signals

**Verification requirement**: Run at least one mechanical check (e.g., `ls` a referenced path, `grep` a referenced symbol) per audited skill before classifying. Do not classify a skill based on reading alone.

### Step 3 — Report

Present a concise health report:

```
## Health Check Report — {date}

### Overall: [HEALTHY / NEEDS ATTENTION / CRITICAL]

### Skills ({N} total)
✅ CURRENT: {list}
⚠️  OUTDATED: {list with one-line reason}
🗑️  STALE: {list with one-line reason}
❌ CRITICAL: {list with one-line reason — these need immediate fixes}

### Agents ({N} total)
{same format — classify as CURRENT/OUTDATED/STALE/CRITICAL}

### Principle Compliance Summary
| File | Type | Self-Learning | Quality Gates | Plan→Critique→Improve→Do→Critique→Improve | Tools Valid |
|------|------|--------------|---------------|------------------------------------------|-------------|
| {name} | skill/agent | ✅/❌ | ✅/❌/EXEMPT | ✅/❌ | ✅/❌/N/A |

### CLAUDE.md: [CURRENT / OUTDATED / STALE]
{one-line summary if not CURRENT}

### Learnings Inbox
- ACTIVE entries: {N} (oldest: {date})
- Recommended: {run /aisa-evolve-harvest if >10 ACTIVE entries or oldest >2 weeks}

### Recommended Actions
1. {highest priority action}
2. {next priority}
...
```

### Auto-Fix Rule

If CRITICAL drift is found (a skill states something actively wrong):

- Present the issue and ask for permission to apply a targeted fix
- If approved: fix only the CRITICAL items, commit with message `fix: correct critical skill drift in {file}`
- Do NOT fix OUTDATED or STALE items — those require the full `/aisa-evolve` cycle

## Quality Gate

Before presenting the health report, verify:

- [ ] At least one verification command (e.g., `ls`, `grep`) was run per audited skill before classifying
- [ ] Every OUTDATED classification has a stated reason grounded in a specific check result
- [ ] Recommended Actions are ordered by severity: CRITICAL → OUTDATED → STALE
- [ ] If any skill was classified without running a verification command, re-run the check before finalizing

## Cache Update

After the health report is complete, update `.claude/cache/drift-report.json` with the audit
results (status per file: CURRENT/OUTDATED/STALE/CRITICAL). This allows the next health check
or evolution run to start from a known baseline.

If files were scanned for the first time (no prior cache), also write/update `snapshot.json`
with their hashes and principle compliance flags.

## See Also

- If CRITICAL drift found → apply fix, then run `/aisa-evolve-validate` to verify principle compliance
- If >10 ACTIVE learning entries → run `/aisa-evolve-harvest`
- If significant drift across many skills → run full `/aisa-evolve`
- If OUTDATED skills need updating → run `/aisa-evolve-target <area>` for scoped fixes

## Learning Capture

If discoveries are made during the health check (e.g., undocumented pattern changes, broken conventions,
surprising drift patterns), append entries to `.claude/learnings/log.md` using the standard format.
