# `/pr-sdlc` — Pull Request Creation

## Overview

Analyzes all commits and the diff on the current branch, generates a structured PR description, and opens the PR via the GitHub CLI. Presents the generated description for review before creating. Supports custom per-project templates.

---

## Usage

```text
/pr-sdlc
```

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--draft` | Create the PR as a draft | — |
| `--update` | Update the description of an existing PR on this branch | — |
| `--base <branch>` | Target branch for the PR | repo default |

---

## Examples

### Create a PR

```text
/pr-sdlc
```

Generates and displays a structured description, then prompts:

```text
PR Title: feat: add webhook retry with idempotency keys
Labels: enhancement, api

PR Description:
─────────────────────────────────────────────
## Summary
Added idempotency key validation to the webhook retry handler to prevent
duplicate payment processing on retried events.

## Business Context
Retried webhook events were being processed multiple times, causing duplicate
charges for customers at checkout.

## Technical Design
Use Stripe's event ID as an idempotency key, stored in a `processed_events`
table with a TTL index to bound storage growth.

## Changes Overview
- Webhook handler validates event ID before processing and records it after success
- New migration adds `processed_events` table with TTL index
- Retry deduplication test coverage added

## Testing
4 new unit tests covering duplicate event detection, first-time processing,
expired TTL, and concurrent retry scenarios.
─────────────────────────────────────────────

Create this PR? (yes / edit / cancel)
```

### Create a draft PR targeting a specific branch

```text
/pr-sdlc --draft --base release/2
```

### Update an existing PR description

```text
/pr-sdlc --update
```

---

## Custom PR Templates

By default, `/pr-sdlc` uses an 8-section template (Summary, JIRA Ticket, Business Context, Business Benefits, Technical Design, Technical Impact, Changes Overview, Testing). Replace it with a project-specific template by creating `.claude/pr-template.md`.

A template is a plain markdown file with `## Section` headings. The text under each heading is a fill instruction for the LLM:

```markdown
## Summary
[1-3 sentence plain-language overview of the change]

## What Changed
[Describe what was changed, grouped by logical concern. No file paths.]

## Why
[Business or technical reason for this change]

## Testing
[How was this verified? Manual steps, automated tests, edge cases.]
```

Run `/pr-customize-sdlc` to create or edit the template interactively.

---

## Auto-Labeling

When creating or updating a PR, the skill analyzes the PR context — branch name, commit messages, changed file paths, diff content — and suggests repository labels that match.

**How it works:**
1. Available labels are fetched from the repository via `gh label list`
2. PR signals (branch prefix, commit types, file paths, diff size) are fuzzy-matched against available labels
3. Suggested labels are displayed in the approval prompt alongside the title and description
4. Labels are applied only after explicit user approval

**Update mode:** Existing labels on the PR are preserved. Only new labels are added — the skill never removes labels.

**When labeling is skipped:** If the repository has no labels defined or `gh` is unavailable, the labeling step is silently skipped.

---

## GitHub Multi-Account Support

When multiple `gh` CLI accounts are authenticated, the skill automatically detects the correct account for the current repository and switches to it before creating or updating the PR.

Detection is two-phase:

1. **Owner match** (fast): If an account login matches the repository owner name, the skill switches to that account.
2. **API access test** (fallback): If no login matches the owner (e.g., org repos), each authenticated account is tested for API access to the repository. The first account with access is selected.

If a switch occurs, the skill notifies you: `GitHub account switched: now using "work-account" (was "personal-account")`. The switch persists for subsequent `gh` commands. If no matching account is found, the skill continues with the currently active account and displays a warning.

To override manually: `gh auth switch --user <login>` before running the skill.

---

## Prerequisites

- **`gh` CLI** — required to open or update the PR (`gh auth login`). Falls back to printing the description for manual use if unavailable. Multiple authenticated accounts are handled automatically.
- **Active branch with commits** — the skill diffs against the target base branch.

### Harness Configuration

| Field | Value |
|---|---|
| `argument-hint` | `[--draft] [--update] [--base <branch>]` |
| Plan mode | Graceful refusal (Step 0) |

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| GitHub PR | Opens a new PR or updates the description of an existing one |

## OpenSpec Integration

When the project uses [OpenSpec](https://github.com/Fission-AI/OpenSpec/), this skill pre-fills PR sections from the active change's proposal.

- **Business Context / Benefits:** Pre-filled from `proposal.md` intent and scope, reducing clarification questions
- **Technical Design:** References `design.md` architectural approach when available
- **Header line:** Adds `**OpenSpec:** openspec/changes/<name>/` to the PR description

See [OpenSpec Integration Guide](../openspec-integration.md) for the full workflow.

---

## Related Skills

- [`/commit-sdlc`](commit-sdlc.md) — commit changes before creating a PR
- [`/review-sdlc`](review-sdlc.md) — review the branch before or after creating a PR
- [`/pr-customize-sdlc`](pr-customize-sdlc.md) — create a custom PR description template
- [`/version-sdlc`](version-sdlc.md) — tag a release after the PR is merged
