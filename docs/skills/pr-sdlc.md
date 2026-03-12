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

## Prerequisites

- **`gh` CLI** — required to open or update the PR (`gh auth login`). Falls back to printing the description for manual use if unavailable.
- **Active branch with commits** — the skill diffs against the target base branch.

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| GitHub PR | Opens a new PR or updates the description of an existing one |

---

## Related Skills

- [`/pr-customize-sdlc`](pr-customize-sdlc.md) — create or edit a project-specific PR template
- [`/review-sdlc`](review-sdlc.md) — run code review on the branch before opening the PR
