# `/setup-sdlc` — Unified Project Setup

## Overview

Configures the SDLC plugin for a project in one interactive flow. Creates `.claude/sdlc.json` (project-level config) and `.sdlc/local.json` (user-local preferences), and orchestrates content setup (review dimensions, PR template). Replaces the fragmented first-use experience of running multiple init commands separately.

---

## Usage

```text
/setup-sdlc
```

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--migrate` | Migrate legacy config files (`.claude/version.json`, `.sdlc/ship-config.json`, etc.) into unified config | — |
| `--skip <section>` | Skip a config section during setup (version, ship, jira, review, commit, pr, content) | — |
| `--force` | Reconfigure already-configured sections | — |
| `--dimensions` | Jump directly to review dimensions sub-flow (skip config builder) | — |
| `--pr-template` | Jump directly to PR template sub-flow (skip config builder) | — |
| `--guardrails` | Jump directly to plan guardrails sub-flow (skip config builder) | — |
| `--execution-guardrails` | Jump directly to execution guardrails sub-flow (skip config builder) | — |
| `--openspec-enrich` | Jump directly to openspec config enrichment sub-flow | — |
| `--remove-openspec` | Remove the managed block from `openspec/config.yaml` (with `--openspec-enrich`) | — |
| `--add` | Expansion mode with `--dimensions` or `--guardrails` (propose only new items) | — |
| `--no-copilot` | Skip GitHub Copilot instructions with `--dimensions` | — |

---

## Examples

### First-time setup

```text
/setup-sdlc
```

Detects missing config, walks through version/ship/jira/review/commit/pr setup, then offers to create review dimensions and PR template.

### Migrate from legacy config files

```text
/setup-sdlc --migrate
```

Reads `.claude/version.json`, `.sdlc/ship-config.json`, `.sdlc/review.json`, and `.sdlc/jira-config.json`, merges them into `.claude/sdlc.json` and `.sdlc/local.json`, and optionally deletes the legacy files.

### Skip specific sections

```text
/setup-sdlc --skip jira --skip commit --skip pr
```

Configures version, ship, and review sections, skipping Jira, commit, and PR title setup.

### Configure commit and PR patterns

```text
/setup-sdlc --skip version --skip jira --skip ship
```

Focuses on review, commit, and PR pattern setup for code style enforcement.

### Review dimensions setup

```text
/setup-sdlc --dimensions
```

Jump directly to review dimensions configuration, skipping the config builder. Scans project tech stack and proposes review dimensions (e.g., security, performance, type safety).

### Expand existing review dimensions

```text
/setup-sdlc --dimensions --add
```

Expansion mode: proposes only dimensions not already installed, leaving existing dimensions unchanged.

### PR template setup

```text
/setup-sdlc --pr-template
```

Jump directly to PR template creation, skipping the config builder. Analyzes project conventions and guides you through creating a custom PR description template.

### Plan guardrails setup

```text
/setup-sdlc --guardrails
```

Jump directly to plan guardrails configuration, skipping the config builder. Configures custom rules evaluated by `/plan-sdlc` during critique phases.

### Expand guardrails

```text
/setup-sdlc --guardrails --add
```

Expansion mode: proposes only guardrails not already configured.

---

## Prerequisites

- Must be inside a git repository
- Node.js >= 16 (for `setup-prepare.js`)

---

## Setup Flow

### Step 3: Configuration Sections

After version, ship, and Jira setup, `/setup-sdlc` guides you through code style enforcement for commits and pull requests:

#### Step 3e: Commit Message Patterns

Choose a commit message convention:

- **conventional** — Enforce type(scope): description format (e.g., `feat(auth): add OAuth2`)
  - Prompts for allowed types and scopes (or accepts defaults)
  - Writes `commit.allowedTypes`, `commit.allowedScopes`, `commit.subjectPattern`, `commit.subjectPatternError` to `.claude/sdlc.json`

- **ticket-prefix** — Enforce ticket ID prefix (e.g., `PROJ-123: description`)
  - Prompts for ticket prefix pattern
  - Writes `commit.subjectPattern` and `commit.subjectPatternError`

- **custom** — Provide your own regex pattern
  - Prompts for `subjectPattern` and `subjectPatternError`
  - Writes custom pattern to `.claude/sdlc.json`

- **skip** — No commit pattern validation
  - Skips this step; subsequent `/commit-sdlc` calls use auto-detected style

#### Step 3f: PR Title Patterns

Choose whether PR titles should match a specific pattern:

- **conventional** — Enforce type[(scope)]: description format for PR titles
  - Accepts same allowed types and scopes as commit setup (or different ones if preferred)
  - Writes `pr.allowedTypes`, `pr.allowedScopes`, `pr.titlePattern`, `pr.titlePatternError`

- **ticket-prefix** — Enforce ticket ID prefix in PR titles
  - Prompts for ticket prefix pattern
  - Writes `pr.titlePattern` and `pr.titlePatternError`

- **custom** — Provide your own regex pattern
  - Prompts for `titlePattern` and `titlePatternError`
  - Writes custom pattern to `.claude/sdlc.json`

- **same-as-commit** — Use the same pattern as commit setup
  - Copies commit pattern fields to `pr` section if commit setup was not skipped
  - Available only if commit step was completed (not skipped)

- **skip** — No PR title pattern validation
  - Skips this step; subsequent `/pr-sdlc` calls generate titles without pattern enforcement

After selection, the skill writes the configuration to `.claude/sdlc.json` and stores local preferences in `.sdlc/local.json`.

### Step 4: Content Setup

After configuration sections are complete, `/setup-sdlc` offers to set up content assets using built-in sub-flows:

#### Review Dimensions

Scans your project's tech stack, dependencies, and directory structure to propose review dimensions (e.g., security, performance, type safety, documentation). Each dimension defines a set of review checks to apply during `/review-sdlc`. Dimensions are stored in `.claude/review-dimensions/*.yaml`.

**Direct entry:** `/setup-sdlc --dimensions` or `/setup-sdlc --dimensions --add` (expansion mode)

#### PR Template

Analyzes project conventions (existing GitHub PR templates, recent PR patterns, JIRA usage) to propose a tailored PR description template. The result is saved to `.claude/pr-template.md` and used automatically by `/pr-sdlc`.

**Direct entry:** `/setup-sdlc --pr-template`

#### Plan Guardrails

Scans the project's codebase structure, dependencies, and architecture to propose and configure plan guardrails in `.claude/sdlc.json`. Each guardrail defines a constraint that `/plan-sdlc` evaluates during its critique phases.

**Direct entry:** `/setup-sdlc --guardrails` or `/setup-sdlc --guardrails --add` (expansion mode)

#### OpenSpec Enrichment

When `openspec/config.yaml` is detected during setup, offers to add a managed block with sdlc-utilities workflow guidance. The block uses string delimiters (`# BEGIN MANAGED BY sdlc-utilities (vN)` / `# END MANAGED BY sdlc-utilities (vN)`) and is idempotent — re-running at the same version is a no-op.

**Direct entry:** `/setup-sdlc --openspec-enrich` or `/setup-sdlc --openspec-enrich --remove-openspec` (removal)

Each option can be individually skipped or accessed later via the `--dimensions`, `--pr-template`, `--guardrails`, or `--openspec-enrich` flags.

### Step 5: Summary

After all steps complete, `/setup-sdlc` prints a summary of what was configured:

```
Version tracking   — [detected from package.json | configured]
Ship pipeline      — [configured | skipped]
Jira integration   — [configured | skipped]
Review dimensions  — [N dimensions created via dimensions sub-flow | skipped]
PR template        — [created via PR template sub-flow | skipped]
Plan guardrails    — [N configured via guardrails sub-flow | skipped]
```

---

## What It Creates or Modifies

| File | Purpose |
|------|---------|
| `.claude/sdlc.json` | Unified project config with `version`, `jira`, `commit`, `pr` sections, and optional `plan.guardrails` |
| `.sdlc/local.json` | User-local config with `review` scope preferences and `ship` settings |
| `.claude/review-dimensions/*.yaml` | Review dimensions created during dimensions sub-flow (via `--dimensions`) |
| `.claude/pr-template.md` | PR template created during PR template sub-flow (via `--pr-template`) |
| `openspec/config.yaml` | Managed block added/updated by openspec enrichment sub-flow (via `--openspec-enrich`). Only the managed block is modified; user-authored content is preserved. |

---

## Related Skills

- [`/review-sdlc`](review-sdlc.md) — multi-dimension code review (requires review dimensions)
- [`/pr-sdlc`](pr-sdlc.md) — pull request creation (uses PR template and patterns)
- [`/plan-sdlc`](plan-sdlc.md) — implementation planning (uses guardrails and commit patterns)
- [`/version-sdlc`](version-sdlc.md) — version management (reads config from `.claude/sdlc.json`)
- [`/ship-sdlc`](ship-sdlc.md) — shipping pipeline (reads config from `.sdlc/local.json`)
- [`/jira-sdlc`](jira-sdlc.md) — Jira integration (reads config from `.claude/sdlc.json`)
