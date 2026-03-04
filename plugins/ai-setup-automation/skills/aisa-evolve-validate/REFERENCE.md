# Principle Validation — Detailed Check Procedures

Reference specification for `/aisa-evolve-validate`. The SKILL.md defines the workflow;
this file defines the exact checks to run.

---

## Skill Validation Checks (Step 2)

For EACH skill file (except `openspec-*` which are exempt from Quality Gates):

### 2a. Self-Learning Directive — REQUIRED

```bash
grep -c "learnings/log.md\|Learning Capture\|capture.*learnings\|learnings.*capture" "{skill_path}"
```

- Count > 0 → ✅ PASS
- Count = 0 → ❌ FAIL — skill never tells agents to capture discoveries

**Deep check:** Does the skill have a `## Learning Capture` section (or equivalent) that:
- References `.claude/learnings/log.md` as the target
- Tells agents WHEN to capture (what triggers a learning entry)
- Provides or references the entry format

### 2b. Quality Gates (Critique-Improve Cycle) — REQUIRED (except `openspec-*`)

```bash
grep -c "Quality Gate[s]\?\|quality gate[s]\?\|pass criteria\|fail action\|self-review\|critique.*before\|review.*before.*deliver" "{skill_path}"
```

- Count > 0 → ✅ PASS
- Count = 0 → ❌ FAIL — skill has no self-validation mechanism

**Deep check:** Does the skill have a `## Quality Gates` section (or equivalent) that defines:
- At least one gate with: trigger, check, pass criteria, fail action
- Max iterations (to prevent infinite loops)
- OR: a workflow that includes a review/validation step before output is considered complete

### 2c. Plan → Critique → Improve → Do → Critique → Improve Pattern

Does the skill's workflow or process description follow this pattern?

- **Plan**: Define what needs to happen (gather context, understand requirements)
- **Critique**: Review the plan against rules/requirements before executing — check approach, edge cases, completeness
- **Improve**: Refine the plan based on critique findings
- **Do**: Execute the (now-critiqued) work
- **Critique**: Review/validate the output against rules/criteria
- **Improve**: Fix issues found during output critique, iterate if needed

A skill that says "plan, do X, done" without any review at plan or output stage → ❌ FAIL.
A skill that says "plan, review plan, improve plan, do X, review result against criteria, fix if needed" → ✅ PASS.
A skill that critiques only the output (old PDCI) partially satisfies this — flag as partial if plan critique is missing.

**Note:** Reference/knowledge skills (collections of rules, patterns, domain knowledge) satisfy
this requirement through their Quality Gates section — the gate IS the critique-improve step.

---

## Agent Validation Checks (Step 3)

For EACH agent file:

### 3a. Frontmatter Completeness

Read the YAML frontmatter between `---` markers. Required fields:

| Field | Required | Check |
|-------|----------|-------|
| `name` | YES | Present and non-empty |
| `description` | YES | Present, non-empty, describes when to invoke |
| `model` | YES | Present, valid alias: `sonnet`, `opus`, `haiku`, or `inherit` |
| `tools` | NO (optional) | If present: non-empty comma-separated list. If omitted: all tools available (including MCP) |

Missing `name`, `description`, or `model` → ❌ FAIL with specific field listed.
Missing `tools` → ✅ PASS (optional field).

### 3b. Tool Validity

If `tools:` is omitted → skip this check (all tools are inherited).

If `tools:` is present: parse the field and check each tool against the valid tools list from
`.claude/skills/aisa-evolve-principles/SKILL.md`.

Any tool NOT in the valid list → ❌ FAIL.

Notes:
- `mgrep` and similar are skills invoked via `Skill` tool, not standalone tools
- `Task(worker, researcher)` is valid — parenthesized agent types restrict subagent spawning

### 3c. Capability-Tool Consistency

If `tools:` is omitted → skip this check (all tools are available, no mismatch possible).

If `tools:` is present: scan the agent body for claimed capabilities. For each, verify the required tool exists:

| Capability pattern in body | Required tool |
|---------------------------|---------------|
| "run", "execute", "lint", "test", "compile" | `Bash` |
| "read", "examine", "inspect", "load" | `Read` |
| "write", "create file", "generate file" | `Write` |
| "edit", "modify", "update file" | `Edit` |
| "search files", "find files" | `Glob` or `Grep` |
| "search web", "look up" | `WebSearch` |
| "fetch URL", "download" | `WebFetch` |
| "load skill", "invoke skill" | `Skill` |

Claimed capability without matching tool → ⚠️ WARNING (may be false positive — flag for review).

### 3d. Workflow Self-Review (Critique-Improve Cycle)

```bash
grep -c "self-review\|review.*before.*deliver\|critique.*before\|check.*pass.*criteria\|validate.*output\|re-read.*output\|Quality Gate" "{agent_path}"
```

- Count > 0 → ✅ PASS
- Count = 0 → ❌ FAIL — agent delivers output without any self-check

**Deep check:** Does the `## Workflow` section include a step that:
- Reviews output against loaded skill rules or defined criteria
- Has explicit pass/fail logic (not just "review your work")
- Specifies what to do on failure (revise, iterate, or warn)
- Has a max iteration count to prevent infinite loops

### 3e. Learning Capture Section

```bash
grep -c "Learning Capture\|learnings/log.md" "{agent_path}"
```

- Count > 0 → ✅ PASS
- Count = 0 → ❌ FAIL — agent never captures discoveries

**Deep check:** Does the agent have a `## Learning Capture` section that:
- Lists trigger conditions (gotcha, pattern discovered, doc gap, etc.)
- Shows the entry format template
- References `.claude/learnings/log.md` as target
- Includes "Do NOT skip this step" or equivalent enforcement language

### 3f. Skill References Valid

For each `.claude/skills/X.md` referenced in the agent's `## Skills` section:

```bash
ls -la ".claude/skills/X.md"
```

- Exists → ✅ PASS
- Missing → ❌ FAIL — agent loads a nonexistent skill

---

## Report Templates (Step 4)

### Skill Compliance Table

```markdown
| Skill | Self-Learning | Quality Gates | Plan→Critique→Improve→Do→Critique→Improve | Status |
|-------|--------------|---------------|--------------------------|--------|
| {name} | ✅/❌ | ✅/❌/EXEMPT | ✅/❌ | PASS/FAIL |
```

### Agent Compliance Table

```markdown
| Agent | Frontmatter | Tools Valid | Cap-Tool Match | Self-Review | Learning Capture | Skill Refs | Status |
|-------|------------|-------------|----------------|-------------|-----------------|------------|--------|
| {name} | ✅/❌ {missing} | ✅/❌ {invalid} | ✅/⚠️ | ✅/❌ | ✅/❌ | ✅/❌ | PASS/FAIL |
```

### Issues Table

```markdown
| # | File | Check | Issue | Proposed Fix |
|---|------|-------|-------|-------------|
| 1 | {file} | {check id} | {what's wrong} | {concrete fix — exact section/content to add} |
```

---

## Scope Boundaries

This skill answers ONE question: **Do the skills and agents follow the required architectural patterns?**

It does NOT:
- Verify code examples against the actual codebase (use `/aisa-evolve-health`)
- Check if file paths in skills resolve to real files (use `/aisa-evolve-health`)
- Check symbol signatures or API routes (use `/aisa-evolve` full cycle)
- Evaluate skill content quality or specificity (use `/aisa-evolve` critique phase)
- Process learnings or propose new skills (use `/aisa-evolve-harvest`)
