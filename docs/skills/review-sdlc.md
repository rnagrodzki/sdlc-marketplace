# `/review-sdlc` — Multi-Dimension Code Review

## Overview

Loads project review dimensions from `.sdlc/review-dimensions/`, matches them to changed files via glob patterns, dispatches parallel review subagents for each matching dimension, deduplicates findings, and posts a consolidated comment to the PR. By default reviews committed branch changes plus staged changes. Requires at least one dimension file — run `/setup-sdlc --dimensions` first if none exist.

Branch-contribution diffs (the `committed` and `all` scopes) use git's three-dot range form (`<base>...HEAD`) so files that landed on the base branch after the feature branch diverged do not appear as findings (issue #239). Before computing the diff, the prepare script attempts a best-effort `git fetch origin <base>:<base>` to fast-forward the local base ref; failure (offline, no remote, auth denied) is non-fatal and the skill proceeds with whatever the local ref reports. The `worktree` scope is exempt by design — it intentionally compares the full working tree against the bare base.

---

## Usage

```text
/review-sdlc
```

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--base <branch>` | Compare against this branch instead of auto-detected base | auto-detected |
| `--committed` | Review only committed branch changes (excludes staged) | — |
| `--staged` | Review only staged changes vs HEAD | — |
| `--working` | Review all uncommitted changes vs HEAD (staged + unstaged) | — |
| `--worktree` | Review full working tree vs base: committed + staged + unstaged | — |
| `--set-default` | Save the resolved scope to `.claude/review.json` as the project default | — |
| `--dimensions <name,...>` | Run only the named dimensions (comma-separated) | all matching |
| `--dry-run` | Show the review plan without dispatching subagents | — |

> **Scope flags:** `--committed`, `--staged`, `--working`, and `--worktree` are mutually exclusive. `--staged` and `--working` cannot be combined with `--base`.

---

## Examples

### Run a full review (committed + staged changes)

```text
/review-sdlc
```

### Review staged changes before committing

```text
/review-sdlc --staged
```

### Review all local changes (staged + unstaged)

```text
/review-sdlc --working
```

### Review only committed changes (exclude staged)

```text
/review-sdlc --committed
```

### Review against a non-default base branch

```text
/review-sdlc --base develop
```

### Run specific dimensions only

```text
/review-sdlc --dimensions security-review,api-review
```

### Review full working tree including unstaged changes

```text
/review-sdlc --worktree
```

### Save a scope as the project default, then run

```text
/review-sdlc --set-default --worktree
```

Saves `worktree` to `.sdlc/review.json` and runs the review. Subsequent `/review-sdlc` calls will use `worktree` automatically.

### Preview what would be reviewed without running

```text
/review-sdlc --dry-run
```

---

## Configuration

The default scope can be persisted in `.sdlc/review.json`:

```json
{
  "defaults": {
    "scope": "worktree"
  }
}
```

**Scope resolution order:** CLI flag → `.sdlc/review.json` → `all` (hardcoded default)

Use `--set-default` to create or update this file without editing it manually:

```text
/review-sdlc --set-default --staged
```

Valid scope values: `all`, `committed`, `staged`, `working`, `worktree`.

### Dimension frontmatter fields

Each `.sdlc/review-dimensions/<name>.md` declares a dimension via YAML frontmatter. The full set of supported fields:

| Field | Required | Type | Purpose |
|---|---|---|---|
| `name` | yes | string | Dimension identifier (lowercase, digits, hyphens; ≤64 chars) |
| `description` | yes | string | One-line dimension purpose (≤256 chars) |
| `triggers` | yes | string[] | Glob patterns selecting files this dimension reviews |
| `severity` | no | string | Default severity bucket: `critical`, `high`, `medium`, `low`, `info` |
| `skip-when` | no | string[] | Glob patterns that exclude files even when `triggers` match |
| `max-files` | no | integer | Cap on files dispatched to this dimension's subagent |
| `requires-full-diff` | no | boolean | Pass full diff (not file list) to the subagent |
| `model` | no | string | Per-dimension model override; passed verbatim to the dispatched subagent (overrides `manifest.subagent_model`). Claude Code only — the Copilot transform in `setup-sdlc` omits it. |

Example with `model:` override:

```yaml
---
name: security-review
description: Identify security risks in changed code.
severity: high
model: claude-haiku-4-5-20251001
triggers:
  - "**/*.ts"
  - "**/*.js"
---
```

When `model:` is absent, the orchestrator falls back to `manifest.subagent_model` (default: `sonnet`).

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

## Dimension Suggestions

When the review finds changed files not covered by any active dimension, it analyzes their patterns and suggests new dimensions in the review plan output:

```text
Suggested new dimensions for uncovered files:

  ci-cd-pipeline-review — 2 CI/CD workflow files not covered
    Files: .github/workflows/ci.yml, .github/workflows/deploy.yml

  configuration-management-review — 3 configuration files not covered
    Files: src/config/db.ts, src/config/auth.ts, .env.example

Run `/setup-sdlc --dimensions --add` to create these dimensions.
```

Files that cannot be mapped to any known dimension type are listed separately:

```text
2 file(s) not mappable to any known dimension type:
  src/custom-runtime.xyz
  build-tool.conf
Consider creating a custom dimension or broadening existing trigger patterns.
```

These suggestions are informational during a review run. To act on them, run `/setup-sdlc --dimensions --add`.

---

## PR Posting Flow

After the orchestrator returns, the full consolidated review (all per-dimension findings, every severity, with `file:line` references and per-dimension `<details>` sections) is printed to the terminal verbatim — read directly from `${diff_dir}/review-comment.md`. The posting prompt then appears below it; replying `cancel` no longer hides any content from view because the body was already shown.

What you see next depends on whether a PR exists for the current branch and the review scope.

### When a PR exists

After printing the full comment body above, the skill prompts:

```text
Post this review comment to PR #{number}? (yes / save / cancel)
```

| Reply | Effect |
|-------|--------|
| `yes` | Posts the comment to the PR via `gh api repos/{owner}/{repo}/issues/{number}/comments -F body=@{comment_file}`. The `-F body=@<path>` form reads the body from the file, so markdown with backticks, quotes, or long content posts reliably — no shell escaping. |
| `save` | Copies the comment to `.claude/reviews/<branch>-<YYYY-MM-DD>.md` (slashes in branch names are replaced with `-`). Does not post. |
| `cancel` | No action. The review remains visible in the terminal only. |

No additional orchestrator or dimension subagent is dispatched after your reply — the comment body was computed during the single orchestrator run and persisted to disk.

### When no PR exists — branch scope (`all` / `committed` / `worktree`)

```text
No PR found. Options:
  1. Create a draft PR and attach this review as a comment
  2. Save review to .claude/reviews/<branch>-<YYYY-MM-DD>.md
  3. Keep in terminal only
```

Option 1 invokes `/pr-sdlc` in draft mode, then posts the comment to the newly created PR.

### When no PR exists — local scope (`staged` / `working`)

```text
Reviewing local changes — no PR to post to. Options:
  1. Save review to .claude/reviews/<branch>-<YYYY-MM-DD>.md
  2. Keep in terminal only
```

### Comment persistence

During the run, the consolidated comment body is written to `${diff_dir}/review-comment.md` (a temporary location under `$TMPDIR`). The skill reads this path from the orchestrator summary and (a) emits the file's contents verbatim in the terminal before the posting prompt, and (b) uses the same file as the body source for `gh api -F body=@…` or `save` copies. The file is discarded along with the diff dir after the terminal branch — including when you reply `cancel` or the command fails — but its contents remain visible in scrollback.

---

## Post-Review Self-Fix

After a review completes with actionable findings (verdict **CHANGES REQUESTED** or **APPROVED WITH NOTES**), the skill prompts:

```text
Would you like to address these findings? (fix / no)
  fix — process findings and implement fixes using received-review-sdlc
  no  — done
```

Choosing `fix` invokes `/received-review-sdlc`, which picks up the findings from conversation context, analyzes each finding against the full codebase context, presents a proposed action plan, and implements only after user approval. The prompt is skipped when the verdict is `APPROVED` (no findings to address).

---

## Prerequisites

- **`.sdlc/review-dimensions/`** — at least one dimension file must exist. Run `/setup-sdlc --dimensions` to create them.
- **`gh` CLI** — recommended for posting the PR comment. Falls back to terminal output if unavailable.

### Harness Configuration

| Field | Value |
|---|---|
| `argument-hint` | `[--base <branch>] [--committed] [--staged] [--dimensions <name,...>]` |
| Plan mode | Compatible (read-only analysis; skips PR comment posting) |

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| GitHub PR comment | Consolidated review findings posted to the current PR |

## Link Verification (issue #198)

Before `gh api … /comments` is invoked, the skill pipes the consolidated review-comment body through `scripts/lib/links.js` as a hard gate. The validator auto-derives `expectedRepo` from `git remote origin` and `jiraSite` from `~/.sdlc-cache/jira/` — the skill never constructs the validator context. URL classes checked: GitHub issues/PRs (owner/repo identity + existence), Atlassian `*.atlassian.net/browse/<KEY>` (host match), and any other `http(s)://` URL (HEAD reachability, 5s timeout). Hosts in the built-in skip list (`linkedin.com`, `x.com`, `twitter.com`, `medium.com`) are reported as `skipped`, not violations. Set `SDLC_LINKS_OFFLINE=1` to skip generic reachability while keeping context-aware checks. On non-zero exit, the comment is **not** posted and the violation list is surfaced verbatim. No flag toggles this gate — it is hard.

## Related Skills

- [`/setup-sdlc`](setup-sdlc.md) — create or expand review dimensions via `--dimensions` flag
- [`/received-review-sdlc`](received-review-sdlc.md) — process and respond to review findings
- [`/commit-sdlc`](commit-sdlc.md) — commit changes after review approval
- [`/pr-sdlc`](pr-sdlc.md) — review a PR branch
