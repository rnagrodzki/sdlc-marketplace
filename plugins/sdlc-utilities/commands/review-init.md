---
description: Initialize or expand project review dimensions by scanning the tech stack and proposing tailored dimension files for use with /sdlc:review
allowed-tools: [Read, Glob, Grep, Write, Bash, Skill]
argument-hint: "[--add] [--no-copilot]"
---

# /review-init Command

Scan the current project's tech stack, file structure, and dependencies to propose and
create review dimension files in `.claude/review-dimensions/`. These dimensions are
loaded by `/sdlc:review` to run project-specific multi-dimension code reviews.

## Usage

- `/sdlc:review-init` — Full scan: propose all relevant dimensions for this project
- `/sdlc:review-init --add` — Expansion mode: propose only dimensions not already installed
- `/sdlc:review-init --no-copilot` — Skip the GitHub Copilot instructions prompt

## Workflow

### Step 0: Parse Arguments

Check `$ARGUMENTS` for flags:

- `--add` present → expansion mode (only propose dimensions not already installed)
- `--no-copilot` present → skip the Copilot instructions prompt in the skill

### Step 1: Validate Git State

Confirm the working directory is inside a git repository:

```bash
git rev-parse --is-inside-work-tree
```

If not inside a repo, stop with:

```text
This command must be run from inside a git repository.
```

### Step 2: Delegate to Skill

Invoke the `sdlc-initializing-review-dimensions` skill, passing:

- `--add` flag if set
- `--no-copilot` flag if set

The skill handles everything from here: tech stack scanning, tailored dimension proposals
with evidence, user selection, file creation, and validation.
