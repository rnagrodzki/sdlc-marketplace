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

| Flag | Description | Default |
|------|-------------|---------|
| `--pr <number>` | PR number to fetch review threads from. Enables thread-aware mode: pre-computes thread resolution state, filters to outstanding comments only on re-run. | Auto-detected from current branch |
| `--auto` | Skip consent gates at Step 10 and Step 12. Auto-implement all "will fix" items and auto-post in-thread replies (resolving only "agree, will fix" threads). Critique gates still run. "Disagree" and "won't fix" items are displayed but not auto-implemented; their threads are replied to but left open. | Off |

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

### Auto-implement from ship pipeline

When invoked from `/ship-sdlc` with `--auto`, the consent gate is skipped and "will fix" items are implemented automatically:

```text
/received-review-sdlc --pr 42 --auto
```

Claude runs the full analysis pipeline (Steps 2–9), displays the action plan for visibility, then proceeds directly to implement "will fix" items. Items with "disagree" or "won't fix" verdicts are displayed but not auto-actioned. Critique gates still run. Step 12 also runs automatically: Claude posts in-thread replies and resolves "agree, will fix" threads without a second consent prompt.

### Re-run on a partially addressed PR

```text
/received-review-sdlc --pr 42
```

On re-run, the prepare script detects already-addressed threads:

```text
Found 3 outstanding comments (2 resolved, 1 already replied — skipped).
Processing only the 3 outstanding comments.
```

Only the outstanding comments proceed through the analysis pipeline.

### Reply to review threads after fixing

After implementing fixes, the skill presents a mandatory reply step:

```text
Review feedback processing complete:
- 2 comments addressed (code changes implemented)
- 1 comment pushed back (with technical reasoning)

Should I reply to all addressed review comments on the PR and resolve the threads?
  yes       — post replies and resolve threads
  skip      — do not post replies (user will handle manually)
  selective — let me choose which threads to reply to
```

Selecting "yes" posts in-thread replies and resolves addressed threads automatically.

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
| Resolved review threads | Threads for addressed comments are resolved via GraphQL mutation |

## Link Verification (issue #198)

Before any `gh api` reply is posted (Step 12), the skill pipes the concatenated reply bodies through `scripts/lib/links.js` as a hard gate (Step 11.5). The validator auto-derives `expectedRepo` from `git remote origin` and `jiraSite` from `~/.sdlc-cache/jira/` — the skill never constructs the validator context. URL classes checked: GitHub issues/PRs (owner/repo identity + existence), Atlassian `*.atlassian.net/browse/<KEY>` (host match), and any other `http(s)://` URL (HEAD reachability, 5s timeout). Hosts in the built-in skip list (`linkedin.com`, `x.com`, `twitter.com`, `medium.com`) are reported as `skipped`, not violations. Set `SDLC_LINKS_OFFLINE=1` to skip generic reachability while keeping context-aware checks. On non-zero exit, no replies are posted and the violation list is surfaced verbatim. No flag toggles this gate — it is hard.

## Related Skills

- [`/review-sdlc`](review-sdlc.md) — source of findings this skill responds to
- [`/commit-sdlc`](commit-sdlc.md) — commit the fixes after implementing review feedback
- [`/pr-sdlc`](pr-sdlc.md) — the PR being reviewed
