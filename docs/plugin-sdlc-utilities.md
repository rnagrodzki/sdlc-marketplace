# Plugin: sdlc-utilities — Reference

## Overview

`sdlc-utilities` automates common SDLC tasks. It ships a smart pull request command that generates structured 8-section PR descriptions from commits and diffs — readable by both technical and non-technical stakeholders. See the [README](../README.md) for installation and quick start.

---

## `/sdlc:pr` — Smart Pull Request Creation

Analyzes all commits and the diff on your branch, then generates a structured 8-section PR description and creates the PR via the GitHub CLI. Presents the generated description for your review before creating.

### Basic Usage

```text
/sdlc:pr
```

### Example Output

Generates a title and structured description, then prompts:

```text
PR Title: feat: add webhook retry with idempotency keys

PR Description:
─────────────────────────────────────────────
## Summary
Added idempotency key validation to the webhook retry handler to prevent
duplicate payment processing on retried events.

## JIRA Ticket
PAY-142

## Business Context
Retried webhook events were being processed multiple times, causing duplicate
charges for customers at checkout.

## Business Benefits
Eliminates duplicate charge risk; reduces customer support tickets for payment
issues on retries.

## Technical Design
Use Stripe's event ID as an idempotency key, stored in a `processed_events`
table with a TTL index to bound storage growth.

## Technical Impact
New `processed_events` table migration required. Webhook handler logic changes
are backward-compatible.

## Changes Overview
- Webhook handler validates event ID before processing and records it after success
- New migration adds `processed_events` table with TTL index
- Retry deduplication test coverage added

## Testing
Automated: 4 new unit tests covering duplicate event detection, first-time
processing, expired TTL, and concurrent retry scenarios. All pass.
Manual: triggered test webhooks with repeated event IDs via Stripe CLI.
─────────────────────────────────────────────

Create this PR? (yes / edit / cancel)
```

### Flags

```text
/sdlc:pr --draft                    # create as a draft PR
/sdlc:pr --update                   # update description of an existing PR on this branch
/sdlc:pr --base develop             # target the develop branch instead of main
/sdlc:pr --draft --base release/2   # combine flags
```

### Requirements

**Requires**: `gh` CLI installed and authenticated (`gh auth login`). Falls back to showing the description for manual use if `gh` is unavailable.

---

---

## `/sdlc:review` — Multi-Dimension Code Review

Loads project review dimensions from `.claude/review-dimensions/`, matches them to changed
files via glob patterns, dispatches parallel review subagents, deduplicates findings, and
posts a single consolidated comment to the PR.

```text
/sdlc:review
```

### Review Flags

```text
/sdlc:review --base develop             # diff against develop instead of auto-detected base
/sdlc:review --dimensions security-review,api-review  # run only named dimensions
/sdlc:review --dry-run                  # show review plan without dispatching subagents
```

### Consolidated Comment Format

The skill posts a PR comment structured as:

```markdown
## Code Review — 3 dimension(s), 7 finding(s)

> Automated review by `sdlc:reviewing-changes` · 2026-02-25

### Summary

| Dimension       | Findings | Critical | High | Medium | Low | Info |
|-----------------|----------|----------|------|--------|-----|------|
| security-review | 3        | 0        | 2    | 1      | 0   | 0    |
| code-quality    | 4        | 0        | 0    | 2      | 2   | 0    |
| **Total**       | **7**    | **0**    | **2**| **3**  | **2**| **0**|

### Verdict: APPROVED WITH NOTES

Two high-severity security findings require attention before merging.

---

### security-review — 3 finding(s)

<details>
<summary>0 critical · 2 high · 1 medium · 0 low · 0 info</summary>

#### [HIGH] Unvalidated user input passed to exec()
**File:** `src/handlers/deploy.ts:47`
User-supplied `command` parameter is passed directly to `child_process.exec()` without sanitization.
**Suggestion:** Use `execFile()` with a fixed command and pass arguments as an array.

</details>
```

### Review Prerequisites

**Requires:** Project must have at least one dimension file in `.claude/review-dimensions/`.
Run `/sdlc:review-init` first if no dimensions exist. `gh` CLI recommended for posting PR
comments; falls back to terminal output if unavailable.

---

## `/sdlc:review-init` — Review Dimension Initialization

Scans the project's tech stack, dependencies, and file structure to propose and create
tailored review dimension files in `.claude/review-dimensions/`.

```text
/sdlc:review-init
```

### Init Flags

```text
/sdlc:review-init --add   # expansion mode: propose only dimensions not already installed
```

### Example Session

```text
Scanning project tech stack...
  ✓ Found: TypeScript, Express.js, Prisma ORM, Jest
  ✓ Directories: src/routes/ (12 files), src/middleware/ (4 files), src/models/ (8 files)

Proposed review dimensions:

1. code-quality-review (medium severity) — always included
   Coverage: **/*.ts, **/*.tsx
   Why: TypeScript project with 67 source files

2. security-review (high severity)
   Coverage: **/middleware/**, **/routes/**
   Why: Found `jsonwebtoken` in package.json; src/middleware/ with auth handlers

3. api-review (high severity)
   Coverage: **/routes/**, **/*.yaml
   Why: Express routes in src/routes/ (12 files)

4. test-coverage-review (medium severity)
   Coverage: **/*.ts (excluding **/*.test.ts)
   Why: Jest test files present; 31% of source files have no corresponding test

Install which? (numbers comma-separated, or "all"): all

✓ Created .claude/review-dimensions/code-quality-review.md
✓ Created .claude/review-dimensions/security-review.md
✓ Created .claude/review-dimensions/api-review.md
✓ Created .claude/review-dimensions/test-coverage-review.md

Validation: 4/4 dimensions pass all checks.
```

---

---

## Review Dimensions Format

Each project defines review dimensions as `.md` files in `.claude/review-dimensions/`.

### Schema

```yaml
---
name: security-review          # REQUIRED. Lowercase letters, digits, hyphens. Max 64 chars.
description: "..."             # REQUIRED. What this dimension reviews. Max 256 chars.
triggers:                      # REQUIRED. Non-empty array of glob patterns.
  - "**/middleware/**"
  - "**/auth/**"
skip-when:                     # OPTIONAL. Files excluded even if triggers match.
  - "**/*.test.*"
  - "**/node_modules/**"
severity: high                 # OPTIONAL. Default: medium. One of: critical|high|medium|low|info
max-files: 50                  # OPTIONAL. Default: 100. Positive integer.
requires-full-diff: false      # OPTIONAL. Default: false. Full diff for matched files.
---

[Review instructions — free-form Markdown. Minimum 10 characters.]
```

### Validation

Run the bundled validation script to check all dimension files:

```bash
node $(find ~/.claude -name validate-dimensions.js -path '*/sdlc-utilities/*') \
  --project-root . --markdown
```

The script checks 12 rules (D1–D12): required fields, glob syntax, body length, name
uniqueness, and type correctness. Exit codes: `0` = pass, `1` = errors found, `2` = script error.

### Example Dimension File

```markdown
---
name: security-review
description: "Reviews changes for authentication, authorization, injection vulnerabilities, and secrets exposure"
triggers:
  - "**/middleware/**"
  - "**/auth/**"
  - "**/*auth*"
  - "**/*token*"
skip-when:
  - "**/*.test.*"
  - "**/*.spec.*"
severity: high
max-files: 50
---

# Security Review

Review all changes for security vulnerabilities.

## Checklist

- [ ] No hardcoded credentials, API keys, or secrets in code or config files
- [ ] All user-supplied input is validated before use
- [ ] Authentication checks are present on protected routes
- [ ] No SQL injection vectors (use parameterized queries, not string concat)
- [ ] No command injection (avoid exec/shell with user input)

## Severity Guide

| Finding | Severity |
|---------|----------|
| Hardcoded secret / credential | critical |
| Missing authentication on protected route | critical |
| SQL / command injection vector | critical |
| Missing authorization check | high |
```
