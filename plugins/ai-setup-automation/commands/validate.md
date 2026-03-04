---
description: Validate skills and agents against architectural principles
allowed-tools: [Read, Glob, Grep, Bash, Skill, TodoWrite]
argument-hint: "[path-to-specific-file-or-directory]"
---

# /validate Command

Validate `.claude/` skills and agents against architectural principles — structural completeness,
self-learning directives, and Plan→Critique→Improve→Do→Critique→Improve patterns. Does NOT check codebase accuracy.

## Usage

- `/validate` — Validate all skills and agents in `.claude/`
- `/validate <path>` — Validate only the specified file or directory

## Workflow

Invoke the `aisa-evolve-validate` skill, passing `$ARGUMENTS` as the target scope.
