# `/received-review-sdlc` — Respond to Code Review Feedback

## Overview

Guides Claude through responding to code review feedback with technical rigor. Analyzes each item against the full codebase context — not just the change diff — using internal self-critique gates to prevent performative agreement and blind implementation. Presents a complete action plan with drafted responses for user approval before making any changes. Can be invoked manually or launched automatically from `/review-sdlc` when actionable findings exist.

---

## Usage

```text
/received-review-sdlc
```

Provide review feedback in one of three ways:
- Paste the review comments into the conversation
- Provide a PR number — Claude will fetch comments via `gh`
- Launch from `/review-sdlc` — findings are passed automatically via context

---

## Flags

No flags. This is a behavioral skill with no configuration options.

---

## Examples

### Process review feedback from context

After `/review-sdlc` reports findings, confirm `fix` when prompted:

```text
Would you like to address these findings? (fix / no)
> fix
```

Claude launches `received-review-sdlc` with the findings already in context.

### Process feedback manually by pasting

```text
/received-review-sdlc

[paste review comments here]
```

Claude analyzes each item against the full codebase context, presents findings and a proposed action plan, then implements only after explicit user consent.

### Process feedback from a PR

```text
/received-review-sdlc

PR #142
```

Claude fetches review comments via `gh pr view 142 --comments`, analyzes them against the full codebase, and presents a proposed action plan.

### What the output looks like

After analysis, Claude presents findings and asks for approval:

```text
| # | File        | Line | Type      | Verdict         | Reasoning                            |
|---|-------------|------|-----------|-----------------|--------------------------------------|
| 1 | search.ts   | 45   | bug       | agree, will fix | `if (query)` passes for empty string |
| 2 | search.ts   | 12   | style     | agree, will fix | `res` → `searchResults` improves clarity |
| 3 | tokenizer.ts| 8    | incorrect | disagree        | Function is imported in 2 files      |

Will fix:
  #1 — Change null check to handle empty strings correctly
  #2 — Rename `res` to `searchResults`

Will push back:
  #3 — tokenize() is used in search.ts and indexer.ts

No changes have been made yet.

How to proceed? (implement / edit / skip)
  implement — post responses to PR and apply code changes
  edit      — modify the plan before proceeding
  skip      — discard, make no changes
```

---

## Prerequisites

- **`gh` CLI** — recommended for fetching review comments and posting in-thread replies. Falls back to manual copy-paste if unavailable.
- **Active PR with review feedback** — or review findings already in the conversation context from `/review-sdlc`.

### Harness Configuration

| Field | Value |
|---|---|
| Plan mode | Graceful refusal (Step 0) |

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| GitHub PR thread replies | In-thread responses posted to reviewer comment threads via `gh api` |
| Source code changes | Edits implementing accepted review feedback, in priority order |

## Related Skills

- [`/review-sdlc`](review-sdlc.md) — source of findings this skill responds to
- [`/commit-sdlc`](commit-sdlc.md) — commit the fixes after implementing review feedback
- [`/pr-sdlc`](pr-sdlc.md) — the PR being reviewed
