# `/verify-pipeline-sdlc` — Analyze Failed CI

## Overview

Analyzes failed CI logs on a PR, classifies the root cause into one of seven categories (lint, test-failure, type-error, build-error, dependency, infra, unknown), and either applies a minimal in-place fix or emits a proposal. Dispatched automatically by `/ship-sdlc`'s `verify-pipeline` step under `--auto`; also user-invocable for standalone CI failure analysis on any PR.

---

## Usage

```text
/verify-pipeline-sdlc --pr <number> [--logs <path-or-string>] [--auto]
```

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--pr <number>` | PR number to analyze. Required when invoked standalone. | — |
| `--logs <path-or-string>` | Failed-check log excerpts. Either a filesystem path or inline text. When omitted, the skill resolves logs internally via `gh run view --log-failed`. | resolved internally |
| `--auto` | Non-interactive mode. Required when dispatched as a subagent under `flags.auto` from ship-sdlc. When set, actionable categories (lint/test-failure/type-error) trigger an in-place `Edit`; otherwise the skill emits a proposal regardless of category. | `false` |

---

## Examples

### Standalone analysis (interactive)

```text
/verify-pipeline-sdlc --pr 142
```

Resolves the latest failed check on PR #142, classifies the logs, and emits a JSON proposal with diagnosis and suggested patch. No edits applied.

### Auto-fix from ship-sdlc

```text
/ship-sdlc --verify-pipeline --auto
```

ship-sdlc dispatches this skill with `--auto`. On `lint` / `test-failure` / `type-error` categories, the skill applies a minimal in-place edit and emits `{"status":"fix-applied", ...}`. ship-sdlc then dispatches commit-sdlc to commit and push, and re-polls CI.

### Inline logs (e.g., from local `gh run view --log-failed > /tmp/logs.txt`)

```text
/verify-pipeline-sdlc --pr 142 --logs /tmp/logs.txt
```

Reads logs from the file, classifies, emits proposal.

---

## Prerequisites

- **`gh` CLI** — required for resolving logs internally when `--logs` is omitted (`gh run view --log-failed`). Install via `brew install gh`; authenticate with `gh auth login`. Without `gh`, the skill aborts with `{"status":"abort","reason":"gh not authenticated"}`.
- **Authenticated PR access** — `gh` must have read access to the repository hosting the PR.

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| Source files in the working tree | Edited in place when `--auto` is set AND the category is actionable (lint/test-failure/type-error) AND a minimal fix is obvious. |
| stdout (single JSON line) | The verdict: `fix-applied` / `proposal` / `abort`. |

This skill never commits, pushes, or modifies files outside the project root. Commit/push is the parent's responsibility (ship-sdlc dispatches commit-sdlc separately on `fix-applied`).

---

## Related Skills

- [`/ship-sdlc`](ship-sdlc.md) — invokes this skill from the verify-pipeline step under `--auto`
- [`/commit-sdlc`](commit-sdlc.md) — invoked by ship-sdlc after this skill returns `fix-applied`
- [`/received-review-sdlc`](received-review-sdlc.md) — companion skill for processing reviewer feedback (await-review step)

<!--
NOTE: This section is for GitHub markdown browsing only.
On the site, Related Skills are rendered as styled SkillCard tiles auto-generated from
`site/src/data/skills-meta.ts` connections. The remark-strip-related-skills plugin removes
this section before site rendering.
-->
