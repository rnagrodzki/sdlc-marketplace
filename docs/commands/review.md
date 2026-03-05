# `/sdlc:review` — Multi-Dimension Code Review

## Overview

Loads project review dimensions from `.claude/review-dimensions/`, matches them to changed files via glob patterns, dispatches parallel review subagents for each matching dimension, deduplicates findings, and posts a consolidated comment to the PR. By default reviews committed branch changes plus staged changes. Requires at least one dimension file — run `/sdlc:review-init` first if none exist.

---

## Usage

```text
/sdlc:review
```

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--base <branch>` | Compare against this branch instead of auto-detected base | auto-detected |
| `--committed` | Review only committed branch changes (excludes staged) | — |
| `--staged` | Review only staged changes vs HEAD | — |
| `--working` | Review all uncommitted changes vs HEAD (staged + unstaged) | — |
| `--dimensions <name,...>` | Run only the named dimensions (comma-separated) | all matching |
| `--dry-run` | Show the review plan without dispatching subagents | — |

> **Scope flags:** `--committed`, `--staged`, and `--working` are mutually exclusive. `--staged` and `--working` cannot be combined with `--base`.

---

## Examples

### Run a full review (committed + staged changes)

```text
/sdlc:review
```

### Review staged changes before committing

```text
/sdlc:review --staged
```

### Review all local changes (staged + unstaged)

```text
/sdlc:review --working
```

### Review only committed changes (exclude staged)

```text
/sdlc:review --committed
```

### Review against a non-default base branch

```text
/sdlc:review --base develop
```

### Run specific dimensions only

```text
/sdlc:review --dimensions security-review,api-review
```

### Preview what would be reviewed without running

```text
/sdlc:review --dry-run
```

---

## Consolidated Comment Format

The command posts a single PR comment:

```markdown
## Code Review — 3 dimension(s), 7 finding(s)

> Automated review by `sdlc:sdlc-reviewing-changes` · 2026-02-25

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

---

## Prerequisites

- **`.claude/review-dimensions/`** — at least one dimension file must exist. Run `/sdlc:review-init` to create them.
- **`gh` CLI** — recommended for posting the PR comment. Falls back to terminal output if unavailable.

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| GitHub PR comment | Consolidated review findings posted to the current PR |

---

## Related Commands

- [`/sdlc:review-init`](review-init.md) — create review dimension files for this project
- [`/sdlc:pr`](pr.md) — open the PR that this command reviews
