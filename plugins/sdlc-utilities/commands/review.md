---
description: Run multi-dimension code review on the current branch using project-defined review dimensions
allowed-tools: [Bash, Skill, Agent]
argument-hint: "[--base <branch>] [--committed] [--staged] [--working] [--worktree] [--set-default] [--dimensions <name,...>] [--dry-run]"
---

# /review Command

Create or run multi-dimension code review on the current branch using
project-defined review dimensions.

## Usage

- `/sdlc:review` — Review committed branch changes + staged changes (default)
- `/sdlc:review --committed` — Review only committed branch changes (excludes staged)
- `/sdlc:review --staged` — Review only staged changes vs HEAD
- `/sdlc:review --working` — Review all uncommitted changes vs HEAD (staged + unstaged)
- `/sdlc:review --worktree` — Review full working tree vs base (committed + staged + unstaged)
- `/sdlc:review --set-default --worktree` — Save `worktree` as default scope, then run the review
- `/sdlc:review --base develop` — Diff against a specific base branch
- `/sdlc:review --dimensions security,performance` — Restrict to named dimensions only
- `/sdlc:review --dry-run` — Show the review plan without dispatching subagents

## Workflow

Invoke the `sdlc-reviewing-changes` skill, passing `$ARGUMENTS` as the CLI flags.
The skill handles everything: script resolution, git data collection, uncommitted
changes warning, dry-run display, orchestrator dispatch, and temp file cleanup.
