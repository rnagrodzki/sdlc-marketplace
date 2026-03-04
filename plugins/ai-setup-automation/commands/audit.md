---
description: Audit existing AI configuration and suggest improvements
allowed-tools: [Read, Glob, Grep, Bash, TodoWrite]
---

# /audit Command

Audit the AI configuration for the current project. Runs mechanical verification
to report exactly what exists, what passes checks, what fails, and why. Does not
create or modify any files.

## Usage

- `/audit` — Review existing AI configuration and report gaps

## Workflow

Do not create or modify any files during this workflow.

### Step 1: Detect Tech Stack

Examine the project to determine its technology:

```bash
ls package.json tsconfig.json 2>/dev/null && echo "Node.js/TypeScript detected"
ls go.mod go.sum 2>/dev/null && echo "Go detected"
ls pyproject.toml setup.py requirements.txt 2>/dev/null && echo "Python detected"
ls Cargo.toml 2>/dev/null && echo "Rust detected"
ls Makefile Taskfile.yml 2>/dev/null && echo "Build tool found"
```

### Step 2: Run Mechanical Verification

Locate the verification script using `Glob` for `**/verify-setup.js`, then run two checks.

#### 2a: Health check

```bash
node <plugin-path>/scripts/verify-setup.js health --project-root . --markdown
```

This checks (and reports PASS/FAIL per item):

- **Pass A** — every file path referenced in each skill/agent exists on disk
- **Pass G / P1** — each skill has a `## Learning Capture` section referencing `.claude/learnings/log.md`
- **Pass G / P2** — each skill has a `## Quality Gates` section with at least one gate
- **Pass G / P3** — each skill follows a Plan→Critique→Improve→Do→Critique→Improve cycle
- **Pass G / A1–A6** — each agent has valid frontmatter (`name`, `description`, `model`),
  valid built-in tools only, capability-tool consistency, a self-review step, learning capture,
  and only valid skill references
- **CLAUDE.md table diff** — skills/agents listed in CLAUDE.md match files actually on disk
- **Learnings inbox** — count of ACTIVE / PROMOTED / STALE entries

#### 2b: Principle compliance check

```bash
node <plugin-path>/scripts/verify-setup.js validate --project-root . --markdown
```

This runs the same P1–P3 and A1–A6 checks with per-item PASS/FAIL verdicts and a
proposed fix for every failure.

### Step 3: Present Audit Report

Present the report in two clearly labeled sections.

```text
## AI Configuration Audit — [project name]

Detected stack: [language], [framework], [build tool]

---

### Part 1: Mechanical Checks  (objective — verify-setup.js)

#### Health Check
[paste --markdown output from Step 2a verbatim]

#### Principle Compliance
[paste --markdown output from Step 2b verbatim]

---

### Part 2: Supplementary Observations  (LLM judgment — not mechanical)

Spot-check 2–3 items the script cannot verify:

1. **Content accuracy**: Pick 2–3 claims from CLAUDE.md (e.g. build commands, test
   commands, project conventions) and verify them against actual files/code.
   Report each as: "Checked [claim] — confirmed ✅" or "Checked [claim] — contradicts
   actual code ❌ ([what the code actually shows])"

2. **Skill specificity**: For 1–2 skills, check whether code examples reference actual
   functions/types from this project (not generic placeholders).
   Report: "Checked skill [name] — project-specific ✅" or "generic placeholders ❌"

3. **Coverage gaps**: Based on detected tech stack, note if any major area lacks a skill
   (e.g. "Go project with no testing skill detected").

---

### Overall Verdict

Script: [HEALTHY or NEEDS_ATTENTION or CRITICAL] + [COMPLIANT or HAS_ISSUES or NON_COMPLIANT]
Supplementary: [N] additional findings

### Recommendations

[high]   — [only for FAIL/CRITICAL items from the script]
[medium] — [supplementary findings or content accuracy failures]
[low]    — [nice-to-have improvements]
```

Do not create any files. To address issues found, suggest:

- Principle compliance failures → `/aisa:validate` (can auto-fix with approval)
- Missing or outdated skills/agents → `/aisa-evolve-target <area>`
- Full rebuild needed → `/aisa:setup`
