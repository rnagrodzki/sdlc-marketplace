---
description: Initialize AI configuration for the current project
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, TodoWrite]
---

# /setup Command

Initialize the AI configuration for the current project. This command
creates CLAUDE.md, .claude/ directory structure, skills, agents, and learnings
based on the detected tech stack.

## Usage

- `/setup` — Full setup: detect tech stack, create CLAUDE.md, scaffold .claude/

## Workflow

### Step 1: Detect Tech Stack

Examine the project to determine its technology:

```bash
ls package.json tsconfig.json 2>/dev/null && echo "Node.js/TypeScript detected"
ls go.mod go.sum 2>/dev/null && echo "Go detected"
ls pyproject.toml setup.py requirements.txt 2>/dev/null && echo "Python detected"
ls Cargo.toml 2>/dev/null && echo "Rust detected"
ls Makefile Taskfile.yml 2>/dev/null && echo "Build tool found"
```

### Step 2: Check Existing Configuration

```bash
test -f CLAUDE.md && echo "CLAUDE.md exists" || echo "CLAUDE.md missing"
test -d .claude && echo ".claude/ exists" || echo ".claude/ missing"
test -d .claude/skills && echo "skills/ exists" || echo "skills/ missing"
test -d .claude/agents && echo "agents/ exists" || echo "agents/ missing"
test -d .claude/learnings && echo "learnings/ exists" || echo "learnings/ missing"
test -d .claude/cache && echo "cache/ exists" || echo "cache/ missing"
```

### Step 2.5: Branch on Existing Configuration

If ANY of `CLAUDE.md`, `.claude/skills/`, or `.claude/agents/` already exist,
**stop and present this choice to the user**:

Count existing skills and agents:

```bash
find .claude/skills -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l
find .claude/agents -mindepth 1 -maxdepth 1 -name "*.md" 2>/dev/null | wc -l
```

Then present:

```text
Existing AI configuration detected:
  ✅ CLAUDE.md                  [present / missing]
  ✅ .claude/skills/            (N skills)
  ✅ .claude/agents/            (N agents)

What would you like to do?

  1. Audit  — review what exists, report gaps, suggest improvements (non-destructive)
  2. Rebuild — remove existing .claude/ and CLAUDE.md, regenerate from scratch

⚠️  Option 2 will DELETE all existing skills, agents, and learnings. This cannot be undone.
```

Wait for explicit user choice:

- **If "audit" (or 1)**: Run the mechanical audit (same as `/aisa:audit`) — locate
  `verify-setup.js` via Glob, run `health` and `validate` modes, present the structured
  report, then suggest targeted fixes with `/aisa-evolve-target`. Do NOT proceed with setup.

- **If "rebuild" (or 2)**: Confirm once more:
  `"This will permanently delete N skills and N agents. Type 'confirm' to proceed."`
  Wait for "confirm", then continue to Step 3.

- **If nothing exists** (fresh project): proceed to Step 3 directly — no prompt needed.

### Step 3: Present Plan to User

Before creating any files, present a clear summary of what will happen:

```text
AI Setup Plan for [project name]

Detected: [language], [framework], [build tool]

Will create:
  - CLAUDE.md                        (project context document)
  - .claude/skills/                  (project-specific expertise files)
  - .claude/agents/                  (autonomous executor definitions)
  - .claude/learnings/log.md         (learning journal)
  - .claude/learnings/README.md      (learning system docs)
  - .claude/cache/snapshot.json      (incremental evolution cache)

Proceed? (yes to continue, no to cancel)
```

Wait for explicit user confirmation before creating any files.

### Step 4: Execute Setup

Use the `aisa-init` skill to perform the actual setup based on
the detected tech stack and user confirmation.

### Step 5: Verify and Report Results

After setup, run mechanical verification to confirm everything was generated correctly.
Do NOT declare success without running these checks first.

#### 5a: Locate verification script

```bash
# Use Glob to find the script: **/verify-setup.js
# Then run both checks below using the resolved path
```

#### 5b: Run health check (file paths, principle compliance, CLAUDE.md table diff)

```bash
node <plugin-path>/scripts/verify-setup.js health --project-root . --markdown
```

This checks:

- **Pass A** — every file path referenced in generated skills/agents exists on disk
- **Pass G** — each skill has Learning Capture (P1), Quality Gates (P2), and a
  critique-improve cycle (P3); each agent has valid frontmatter, tools, self-review,
  and learning capture (A1–A6)
- **CLAUDE.md table diff** — skills/agents tables match actual files on disk
- **Learnings inbox** — entry counts

#### 5c: Run principle compliance check (detailed P1–P3, A1–A6)

```bash
node <plugin-path>/scripts/verify-setup.js validate --project-root . --markdown
```

#### 5d: Present the Setup Verification Report

Combine both outputs for the user:

```text
## Setup Complete — Verification Report

### Files Created
[list all files created with relative paths, from the Phase 6 manifest]

### Health Check  (verify-setup.js health)
[paste --markdown output verbatim]

### Principle Compliance  (verify-setup.js validate)
[paste --markdown output verbatim]

### Overall Verdict
- Both scripts exit 0 → "Setup verified — all checks pass ✅"
- Any FAIL items → list each one explicitly: "[check name]: [what failed] — [suggested fix]"

### Next Steps
- To add more skills: see https://github.com/rnagrodzki/ai-setup-automation/blob/main/docs/adding-skills.md
- If issues found: run `/aisa:validate` for detailed principle compliance report
- For scoped updates later: run `/aisa-evolve-target <area>`
```
