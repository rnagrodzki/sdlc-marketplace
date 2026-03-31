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
| `--auto` | Skip interactive approval — create/update the PR immediately after generation | — |
| `--label <name>` | Force a label onto the PR (repeatable). Created automatically if it doesn't exist in the repo | — |

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

### Force a label onto the PR

```text
/pr-sdlc --label skip-version-check
```

Multiple labels can be forced: `/pr-sdlc --label bug --label urgent`. Forced labels are always included regardless of auto-labeling signals and are created in the repository if they don't already exist.

### Create a PR without interactive approval

```text
/pr-sdlc --auto
```

Generates the description, runs critique/improve internally, and creates the PR without prompting for confirmation. Combine with `--draft` for a safety net: `/pr-sdlc --auto --draft`.

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

**Forced labels:** The `--label` flag bypasses signal matching — forced labels are always included in the PR. If a forced label doesn't exist in the repository, it is created automatically before the PR is opened. Forced labels are marked with `(forced)` in the approval prompt to distinguish them from inferred labels. This is used by `/ship-sdlc` to auto-apply `skip-version-check` on worktree PRs.

**When labeling is skipped:** If the repository has no labels defined or `gh` is unavailable, the labeling step is silently skipped. Forced labels (via `--label`) still work — they are created in the repo if needed.

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
| `argument-hint` | `[--draft] [--update] [--base <branch>] [--auto] [--label <name>]` |
| Plan mode | Graceful refusal (Step 0) |

---

## Configuration

PR title validation is configured in `.claude/sdlc.json` under the `pr` key. All fields are optional; if absent, the skill uses auto-generated titles and does not enforce pattern validation.

### Full Configuration Example

```json
{
  "pr": {
    "titlePattern": "^(feat|fix|breaking|docs|refactor)(?:\\([a-z0-9-]+\\))?: .+$",
    "titlePatternError": "PR title must match: type[(scope)]: description (e.g., feat: add auth)",
    "allowedTypes": ["feat", "fix", "breaking", "docs", "refactor", "chore"],
    "allowedScopes": ["auth", "api", "ui", "db"]
  }
}
```

### Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `titlePattern` | string (regex) | Regex pattern the PR title must match. Enforced as a quality gate before PR creation. |
| `titlePatternError` | string | Human-readable error message displayed when `titlePattern` validation fails. |
| `allowedTypes` | array of strings | Allowed PR title type prefixes (e.g., `feat`, `fix`, `breaking`). Absence allows any type. Used for title generation hints only; validation uses `titlePattern`. |
| `allowedScopes` | array of strings | Allowed PR title scopes (the parenthetical in `feat(scope)`). Absence allows any scope. Used for title generation hints only; validation uses `titlePattern`. |

### Note on Type/Scope Flags

Unlike `/commit-sdlc`, `/pr-sdlc` does not accept `--type` or `--scope` flags; PR titles are generated contextually from commit analysis and branch information. The configuration fields `allowedTypes` and `allowedScopes` are advisory only — they guide title generation but do not restrict what titles are accepted, only the `titlePattern` does that.

### Pattern Examples

#### 1. Conventional PR Titles

Type and scope optional; matches squash-merge commit format.

```json
{
  "titlePattern": "^(feat|fix|refactor|docs|chore)(?:\\([a-z0-9-]+\\))?: .+$",
  "titlePatternError": "Title must match: type[(scope)]: description",
  "allowedTypes": ["feat", "fix", "refactor", "docs", "chore"],
  "allowedScopes": ["auth", "api", "ui", "db"]
}
```

Matching titles:
```
feat(auth): add OAuth2 PKCE flow
fix: correct login retry logic
docs: update API documentation
```

#### 2. Ticket Prefix Only

Ticket ID required, no type system.

```json
{
  "titlePattern": "^[A-Z]+-\\d+: .+$",
  "titlePatternError": "Title must match: PROJ-123: description"
}
```

Matching title:
```
PROJ-456: Implement webhook retry with idempotency
```

#### 3. Ticket Prefix + Conventional

Ticket ID and conventional type.

```json
{
  "titlePattern": "^[A-Z]+-\\d+ (feat|fix|refactor|docs): .+$",
  "titlePatternError": "Title must match: PROJ-123 type: description",
  "allowedTypes": ["feat", "fix", "refactor", "docs"]
}
```

Matching title:
```
PROJ-456 feat: add webhook retry with idempotency
```

#### 4. Semantic PR Titles

Explicit keyword categories (no parenthetical scope).

```json
{
  "titlePattern": "^(feat|fix|breaking|refactor|docs): .+$",
  "titlePatternError": "Title must start with: feat: fix: breaking: refactor: or docs:",
  "allowedTypes": ["feat", "fix", "breaking", "refactor", "docs"]
}
```

Matching titles:
```
feat: add webhook retry with idempotency
breaking: remove deprecated auth endpoint
fix: correct login session expiration
```

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
