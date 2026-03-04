---
name: aisa-evolve-postmortem
description: "Post-mortem integration after incidents, difficult bugs, or production issues. Creates learning entries, identifies which skills should have prevented the issue, and proposes skill updates to prevent recurrence. Use after any painful debugging session."
argument-hint: "<describe the incident or bug>"
---

# Post-Mortem Integration

Turn painful incidents into permanent prevention by encoding lessons into skills.

## Context

Incident: `$ARGUMENTS`

## Instructions

### Step 1 — Understand the Incident

Gather evidence about what happened:

```bash
# Check recent commits for fixes
git log --oneline -20
# Check for related changes
git diff HEAD~5 --stat
```

Ask (if context unclear):
- What went wrong?
- How was it discovered?
- How was it fixed?
- How long did it take to diagnose?

### Step 2 — Root Cause → Skill Gap Analysis

For each root cause, ask:

- **Which skill should have prevented this?** (an existing skill that's incomplete)
- **Was there a skill that covered this area but its guidance was wrong or ambiguous?**
- **Is this an entirely uncovered area that needs a new skill?**
- **Did the testing skill fail to prevent this?** (missing test pattern, incorrect mock boundary, untested flow)
- **Did the skill lack a critique-improve cycle that would have caught this?** Without quality gates, intermediate errors propagate unchecked through the agent's workflow. If a self-review step would have caught the error before delivery, the skill needs a Quality Gates section.
- **Did the agent lack learning capture that would have recorded this gotcha earlier?** Without self-learning directives, previous sessions' discoveries are lost and the same mistake repeats. If this gotcha was encountered before but not captured, the skill's Learning Capture section is missing or agents aren't following it.

Map each cause:

```
Root Cause: {description}
├── Existing skill coverage: {skill name} — {covers it / partially covers / doesn't cover}
├── Skill gap: {what's missing or wrong in the skill}
├── Skill principles: Quality Gates [PRESENT/MISSING], Learning Capture [PRESENT/MISSING]
├── Agent gap: {agent structural issues — missing tools, no self-review, broken frontmatter}
├── Testing gap: {what test would have caught this}
└── Prevention: {specific skill/agent update that prevents recurrence}
```

**Agent root cause checks** (when an agent was involved in the incident):
- Did the agent have a self-review step that should have caught the output error before delivery?
- Was the agent missing a tool it needed? (e.g., needed `Bash` to run a check but only had `Read`)
- Was the agent's frontmatter complete? Missing `model` could mean wrong model was used.
- Did the agent load all relevant skills, or was it missing a domain skill whose rules it violated?

### Step 3 — Create Learning Entries

Append to `.claude/learnings/log.md`:

```markdown
### [{CATEGORY}] {title}
- **Date**: {today}
- **Session**: post-mortem
- **Discovery**: {what happened and why}
- **Impact**: HIGH
- **Action**: {what skill/doc change prevents recurrence}
- **Status**: ACTIVE
```

Use categories: GOTCHA for surprising behaviors, PATTERN_FAILED for approaches that broke,
DOC_GAP for missing documentation, DEPENDENCY_QUIRK for library/service issues.

### Step 4 — Propose Skill Updates

```
## Post-Mortem: {incident title}

### Root Causes → Skill Gaps

| Root Cause | Affected Skill | Gap | Proposed Fix |
|-----------|---------------|-----|-------------|
| {cause} | {skill or "NEW"} | {what's missing} | {specific content to add} |

### Testing Gaps

| What Should Have Caught It | Current Testing Skill | Fix |
|---------------------------|---------------------|-----|
| {test description} | {what skill says now} | {what to add} |

### Learning Entries Created
- [{CATEGORY}] {title} — added to log.md

### Proposed Skill Updates

{For each affected skill, show the exact content to add — rules, gotchas, 
anti-patterns, code examples. Be specific enough that an agent following 
the updated skill would NOT make this mistake again.}
```

### Step 5 — Apply

After approval:

1. Update affected skills with new rules, gotchas, or anti-patterns
2. Update testing skill if test gaps were found
3. Update mock boundary map if applicable
4. Learning entries already appended in Step 3
5. Commit:
```
chore: post-mortem skill updates — {incident title}

- Updated {N} skills to prevent recurrence
- Added {N} learning entries
- Testing skill: {updated/unchanged}
- Root cause: {one-line summary}
```

## Quality Gate

Before presenting the post-mortem proposal, verify:

- [ ] Each referenced skill actually exists (`ls .claude/skills/{name}`)
- [ ] Each proposed change traces to a root cause from Step 2
- [ ] Changes targeting non-existent skills have creation rationale; untraceable changes are removed

**Principle compliance** — apply to all affected skills and agents:

Validate against Skill P1-P3 and Agent A1-A6 from `.claude/skills/aisa-evolve-principles/SKILL.md`.
Missing principles in affected files → include in proposed fixes. New skills include both
Quality Gates and Learning Capture from creation.

## Cache Update

After postmortem fixes are committed, partially update `.claude/cache/snapshot.json`
for modified/new skills and agents. Update `drift-report.json` to mark fixed files as CURRENT.

## See Also

- After applying fixes → run `/aisa-evolve-validate` to verify principle compliance
- If many skills were updated → run `/aisa-evolve-health` to check overall health
- To process accumulated learning entries → run `/aisa-evolve-harvest`

## Learning Capture

The learning entries created in Step 3 ARE the learning capture for this skill. Additionally, if the
post-mortem reveals systemic patterns (e.g., "all domain skills lack Quality Gates", "agents consistently
skip self-review"), capture that as a separate meta-learning entry.
