# `/sdlc:review-init` — Review Dimension Setup

## Overview

Scans the project's tech stack, dependencies, and file structure, then proposes and creates tailored review dimension files in `.claude/review-dimensions/`. Each dimension file defines a lens (security, API contracts, test coverage, etc.) that `/sdlc:review` uses to focus its analysis. Run once per project, then use `--add` to expand as the codebase evolves.

---

## Usage

```text
/sdlc:review-init
```

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--add` | Expansion mode — propose only dimensions not already installed | — |

---

## Examples

### Initial setup

```text
/sdlc:review-init
```

```text
Scanning project tech stack...
  ✓ Found: TypeScript, Express.js, Prisma ORM, Jest
  ✓ Directories: src/routes/ (12 files), src/middleware/ (4 files)

Proposed review dimensions:

1. code-quality-review (medium) — always included
   Coverage: **/*.ts, **/*.tsx

2. security-review (high)
   Coverage: **/middleware/**, **/routes/**
   Why: jsonwebtoken in package.json; auth handlers in src/middleware/

3. api-review (high)
   Coverage: **/routes/**, **/*.yaml
   Why: Express routes in src/routes/ (12 files)

4. test-coverage-review (medium)
   Coverage: **/*.ts (excluding **/*.test.ts)
   Why: Jest present; 31% of source files have no test

Install which? (numbers comma-separated, or "all"): all

✓ Created .claude/review-dimensions/code-quality-review.md
✓ Created .claude/review-dimensions/security-review.md
✓ Created .claude/review-dimensions/api-review.md
✓ Created .claude/review-dimensions/test-coverage-review.md

Validation: 4/4 dimensions pass all checks.
```

### Add dimensions to an existing setup

```text
/sdlc:review-init --add
```

Proposes only dimensions not yet present in `.claude/review-dimensions/`.

---

## Prerequisites

- **Git repository** — the command scans the project structure and git history.

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| `.claude/review-dimensions/*.md` | One file per dimension, used by `/sdlc:review` |

---

## Dimension File Format

Each dimension is a markdown file with a YAML frontmatter block:

```yaml
---
name: security-review          # required. lowercase, hyphens only. max 64 chars.
description: "..."             # required. what this dimension reviews. max 256 chars.
triggers:                      # required. glob patterns for files that activate this dimension.
  - "**/middleware/**"
  - "**/auth/**"
skip-when:                     # optional. files excluded even if triggers match.
  - "**/*.test.*"
severity: high                 # optional. default: medium. critical|high|medium|low|info
max-files: 50                  # optional. default: 100.
requires-full-diff: false      # optional. default: false.
---

[Review instructions — free-form markdown describing what to look for]
```

### Example dimension file

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

## Checklist

- [ ] No hardcoded credentials, API keys, or secrets
- [ ] All user-supplied input is validated before use
- [ ] Authentication checks are present on protected routes
- [ ] No SQL injection vectors (use parameterized queries)
- [ ] No command injection (avoid exec/shell with user input)

## Severity Guide

| Finding | Severity |
|---------|----------|
| Hardcoded secret / credential | critical |
| Missing authentication on protected route | critical |
| SQL / command injection vector | critical |
| Missing authorization check | high |
```

---

## Related Commands

- [`/sdlc:review`](review.md) — run the review using dimension files created by this command
