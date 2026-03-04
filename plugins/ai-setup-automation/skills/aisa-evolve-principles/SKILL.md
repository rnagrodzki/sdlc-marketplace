---
name: aisa-evolve-principles
description: "Shared architectural principles, tool registry, and behavioral rules for all aisa-* skills. Not invoked directly — loaded as a dependency by other skills."
---

# Shared Principles & Standards

> **Version:** 8.0 · **Last updated:** 2026-02-24

This file is the single source of truth for architectural principles enforced across all `aisa-*` skills.
Do not duplicate these definitions — reference this file.

---

## Valid Claude Code Built-in Tools

```
Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, TodoWrite, Skill, ToolSearch, Task
```

Notes:
- `Task` can include parenthesized agent types: `Task(worker, researcher)` — restricts spawnable subagents
- Project-specific CLIs are invoked via `Bash`, not listed as standalone tools
- `mgrep` and similar utilities are skills invoked via `Skill`, not built-in tools
- MCP server tools are inherited when `tools:` is omitted from agent frontmatter

---

## Skill Principle Checklist

Apply to every skill (except `openspec-*` which are exempt from Quality Gates):

**P1 · Self-Learning Directive** — REQUIRED:
- Has `## Learning Capture` section (or equivalent)
- References `.claude/learnings/log.md` as target
- Tells agents WHEN to capture (triggers) and provides entry format

**P2 · Quality Gates (Critique-Improve Cycle)** — REQUIRED (except `openspec-*`):
- Has `## Quality Gates` section with at least one gate
- Each gate defines: trigger, check, pass criteria, fail action
- Max iterations specified (prevents infinite loops)

**P3 · Plan → Critique → Improve → Do → Critique → Improve Pattern:**
- Critique the plan before executing: review approach, requirements, and edge cases; improve before acting
- Execute the (now-critiqued) work
- Critique the output: validate result against rules/criteria; improve before delivery
- Not just "plan, do, done" — must critique and improve at both the planning and execution stage
- Reference/knowledge skills satisfy this through their Quality Gates section

**Violation classification:**
- Missing P1 or P2 → OUTDATED minimum (P2 DRIFT UPDATE)
- Missing P1 AND P2 → escalate to P1 STALE CLEANUP

---

## Agent Principle Checklist

Apply to every agent:

**A1 · Frontmatter Completeness:**
- `name` — present, lowercase-hyphens
- `description` — present, describes when to invoke
- `model` — present, valid alias: `sonnet`, `opus`, `haiku`, or `inherit`
- `tools` — **optional**; comma-separated list from valid tools above when present — restricts agent to listed tools; omit to inherit all available tools (including MCP)

**A2 · Tool Validity:**
- If `tools:` is omitted, A2 is automatically satisfied (all tools available)
- Every tool in `tools:` must appear in the Valid Tools list above
- Invalid/invented tool → OUTDATED, propose fix as P1

**A3 · Capability-Tool Consistency:**
- If `tools:` is omitted, A3 is automatically satisfied (all tools available)
- "run", "execute", "lint", "test" → requires `Bash`
- "read", "examine", "inspect" → requires `Read`
- "write", "create file" → requires `Write`
- "edit", "modify" → requires `Edit`
- "search files", "find files" → requires `Glob` or `Grep`
- "search web" → requires `WebSearch`
- "fetch URL" → requires `WebFetch`
- "load skill" → requires `Skill`
- Claimed capability without matching tool → WARNING (flag for review)

**A4 · Workflow Self-Review:**
- `## Workflow` includes a self-review/critique step before delivery
- Has pass/fail logic and specifies what to do on failure
- Max iteration count to prevent infinite loops

**A5 · Learning Capture:**
- Has `## Learning Capture` section with format template
- References `.claude/learnings/log.md`
- Includes enforcement language ("Do NOT skip this step" or equivalent)

**A6 · Skill References:**
- Every `.claude/skills/X.md` referenced actually exists on disk

---

## Behavioral Rules

These rules apply to ALL `aisa-*` skills. Rules 1-19 are foundational (from architect),
rules 20-28 are evolution-specific (from evolver).

### Foundation Rules

1. **Discover, don't assume.** Every skill and agent must be justified by evidence found in code, docs, or specs.

2. **Code is ground truth.** When docs and code disagree, code wins. Note the discrepancy.

3. **Minimal viable set.** Fewer high-quality skills beats many shallow ones.

4. **Spec-driven always.** Workflow must reinforce reading specs before coding.

5. **Clean slate.** Existing `.claude/` content is evaluated objectively. Generic boilerplate → propose deletion.

6. **Progressive disclosure.** Skills are loaded on-demand, not dumped into every context. Each skill under 500 lines; split if larger.

7. **Agents are expensive.** Only propose an agent when isolation, parallelism, or tool scoping genuinely adds value.

8. **Critique is not a formality.** A critique finding zero issues is suspicious — re-examine more carefully.

9. **Specificity is the #1 quality signal.** "Could this have been produced without analyzing THIS project?" If yes → rewrite.

10. **Iterate until right, not until done.** Max 2 iteration loops per critique phase. If still failing, present to user.

11. **Honest confidence reporting.** Never claim HIGH confidence to speed things along.

12. **Functional tests are non-negotiable.** Default to functional/integration tests. Mock only at outermost boundary.

13. **Learning is continuous, not optional.** Every agent MUST capture learnings. The log is append-only.

14. **Learnings are evidence for evolution.** Accumulated entries are primary evidence for what skills need to exist.

15. **Domains are three-dimensional.** Evaluate technical (how), business (what/why), design (experience).

16. **Business rules are the highest-value skill content.** State as verifiable invariants, not vague guidance.

17. **Respect bounded contexts.** Never merge business rules from different contexts into one skill.

18. **Know the tools.** Use only valid Claude Code built-in tools (see list above). Project CLIs run via `Bash`.

19. **Generate complete, not retroactively patched.** Every generated skill includes Learning Capture AND Quality Gates from day one.

### Evolution Rules

20. **Verify before trusting.** Never assume existing skills are correct just because they exist.

21. **Prioritize P0 ruthlessly.** Wrong skills are worse than missing skills. Fix critical drift first.

22. **Promote learnings aggressively.** ACTIVE entries >2 weeks old with clear patterns → promote. The log is an inbox, not an archive.

23. **Don't expand prematurely.** New skills require concrete evidence in code/specs today.

24. **Preserve the learning log's integrity.** Never edit or delete entries. Mark PROMOTED or STALE.

25. **Make changes surgical.** Update precisely, don't regenerate from scratch unless severely degraded.

26. **Always leave it better.** Even if invoked for a specific area, flag drift elsewhere.

27. **Workflow maturity is mandatory.** Every skill needs Learning Capture + Quality Gates. Every agent needs self-review. Missing = OUTDATED minimum.

28. **Cache-first scanning.** Check snapshot hashes before deep-reading files. Skip unchanged content.

29. **Always parallel.** Use subagent workstreams or Agent Teams for every audit.

---

## Standard Section Templates

Use these when adding missing sections to existing skills/agents.

### Learning Capture (for skills)

```markdown
## Learning Capture

When working with this skill, capture discoveries by appending to `.claude/learnings/log.md`.
Record entries for: gotchas, undocumented behaviors, patterns that worked/failed, documentation
gaps, dependency quirks, or convention violations encountered while applying this skill's guidance.
```

### Quality Gates (for skills)

```markdown
## Quality Gates

| Gate | Trigger | Check | Pass Criteria | Fail Action | Max Iterations |
|------|---------|-------|---------------|-------------|----------------|
| {name} | {when to run} | {what to verify} | {objective pass/fail condition} | {what to do on failure} | 2 |
```

### Self-Review Workflow Step (for agents)

```markdown
N. **Self-review before delivery:**
   - Re-read output against the loaded skill rules
   - Run verification: {project-specific check}
   - Pass criteria: {what "good" looks like}
   - If FAIL: revise and re-check (max 2 iterations)
   - If still failing after 2 iterations: deliver with explicit warning of remaining issues
```

### Learning Capture (for agents)

```markdown
## Learning Capture

During your work, capture learnings by appending to `.claude/learnings/log.md`.
Record an entry when you encounter:
- **Gotcha**: Unexpected behavior, undocumented API quirk, silent failure
- **Pattern Discovered**: Solution approach that worked well and should be reused
- **Pattern Failed**: Approach that seemed right but didn't work — and why
- **Documentation Gap**: Something needed but not found in docs/ or specs
- **Dependency Quirk**: Library/framework behavior differing from docs
- **Convention Violation**: Code breaking established patterns

Format:
\```
### [{CATEGORY}] {One-line title}
- **Date**: {today}
- **Context**: {what you were working on}
- **Discovery**: {what you found}
- **Impact**: {why it matters}
- **Action**: {workaround applied / fix needed / promote to skill}
\```

Do NOT skip this step. A 30-second learning entry now saves hours of rediscovery later.
```
