---
description: Create or update a pull request with an auto-generated description from commits and diffs
allowed-tools: [Bash, Skill]
argument-hint: "[--draft] [--update] [--base <branch>]"
---

# /pr Command

Create or update a pull request on the current branch with a description
auto-generated from commit history and diffs. Uses the Conventional PR format.

Auto-detects whether a PR already exists: if one does, updates it; otherwise
creates a new one.

## Usage

- `/pr` — Auto-detect: create a new PR or update the existing one
- `/pr --draft` — Create a draft PR (new PRs only)
- `/pr --update` — Force update mode (error if no PR exists for this branch)
- `/pr --base develop` — Target a specific base branch

## Workflow

Invoke the `sdlc-creating-pull-requests` skill, passing `$ARGUMENTS` as the CLI flags.
The skill handles everything: script resolution, git data collection, description
generation, self-critique, user review, and PR creation or update.
