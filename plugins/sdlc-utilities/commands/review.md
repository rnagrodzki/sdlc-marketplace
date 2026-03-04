---
description: Run multi-dimension code review on the current branch using project-defined review dimensions
allowed-tools: [Glob, Bash, Skill, Agent]
argument-hint: "[--base <branch>] [--dimensions <name,...>] [--dry-run]"
---

# /review Command

Invoke the `sdlc-reviewing-changes` skill, passing all `$ARGUMENTS`.

All validation (git state, base branch detection, uncommitted changes warning,
dimension discovery) is handled by the `review-prepare.js` script inside the skill.

## Error Handling

The skill delegates to `review-prepare.js` which exits with:

- Exit code 1: user-facing error (no changes, no dimensions, etc.) — show the stderr message and stop.
- Exit code 2: script error — show `Script error — see output above` and stop.
