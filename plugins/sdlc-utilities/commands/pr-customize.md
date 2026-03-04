---
description: Guide the user through creating or editing a custom PR template for this project
allowed-tools: [Read, Glob, Grep, Write, Bash, Skill]
argument-hint: ""
---

# /pr-customize Command

Scan the current project for PR conventions and guide the user through creating or editing
`.claude/pr-template.md` — a project-specific PR description template used by `/sdlc:pr`.

## Usage

- `/sdlc:pr-customize` — Create or edit the project PR template interactively

## Workflow

### Step 1: Validate Git State

Confirm the working directory is inside a git repository:

```bash
git rev-parse --is-inside-work-tree
```

If not inside a repo, stop with:

```text
This command must be run from inside a git repository.
```

### Step 2: Check for Existing Template

Check if `.claude/pr-template.md` already exists:

```bash
test -f .claude/pr-template.md && echo "exists" || echo "not-found"
```

If it exists, inform the user:

```text
A PR template already exists at .claude/pr-template.md.
The skill will help you review and update it.
```

### Step 3: Delegate to Skill

Invoke the `sdlc-customizing-pr-template` skill. The skill handles everything from here:
project signal scanning, template proposal, interactive customization, file creation,
and validation.
