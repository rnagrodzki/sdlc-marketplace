# `/review-receive-sdlc` — Respond to Code Review Feedback

## Overview

Guides Claude through responding to code review feedback with technical rigor. Reads, verifies, evaluates, and responds to reviewer comments using a dual self-critique gate — prevents performative agreement and blind implementation of incorrect suggestions. Can be invoked manually or launched automatically from `/review-sdlc` when actionable findings exist.

---

## Usage

```text
/review-receive-sdlc
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

Claude launches `review-receive-sdlc` with the findings already in context.

### Process feedback manually by pasting

```text
/review-receive-sdlc

[paste review comments here]
```

Claude reads, verifies, evaluates, and responds to each item in turn.

### Process feedback from a PR

```text
/review-receive-sdlc

PR #142
```

Claude fetches review comments via `gh pr view 142 --comments` and processes them.

---

## Prerequisites

- **`gh` CLI** — recommended for fetching review comments and posting in-thread replies. Falls back to manual copy-paste if unavailable.
- **Active PR with review feedback** — or review findings already in the conversation context from `/review-sdlc`.

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| GitHub PR thread replies | In-thread responses posted to reviewer comment threads via `gh api` |
| Source code changes | Edits implementing accepted review feedback, in priority order |

---

## Related Skills

- [`/review-sdlc`](review-sdlc.md) — runs the code review that this skill responds to; offers to launch this skill when findings are actionable
- [`/pr-sdlc`](pr-sdlc.md) — creates the PR that gets reviewed
