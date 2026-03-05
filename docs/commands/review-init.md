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

| Flag           | Description                                                          | Default |
|----------------|----------------------------------------------------------------------|---------|
| `--add`        | Expansion mode — propose only dimensions not already installed       | —       |
| `--no-copilot` | Skip the GitHub Copilot instructions prompt after dimension creation | —       |

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

Would you also like to generate GitHub Copilot review instructions?
These mirror your review dimensions so Copilot's automatic PR code review follows the same standards.
Files will be created in .github/instructions/ (one per dimension, ~1-2 KB each).
(yes/no): yes

Generated Copilot instruction files:
  .github/instructions/code-quality-review.instructions.md  (1,180 chars)
  .github/instructions/security-review.instructions.md      (1,420 chars)
  .github/instructions/api-review.instructions.md           (1,350 chars)
  .github/instructions/test-coverage-review.instructions.md (1,100 chars)
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

| File / Artifact                          | Description                                                                  |
|------------------------------------------|------------------------------------------------------------------------------|
| `.claude/review-dimensions/*.md`         | One file per dimension, used by `/sdlc:review`                               |
| `.github/instructions/*.instructions.md` | GitHub Copilot path-specific review instructions (opt-in, one per dimension) |

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

## GitHub Copilot Instructions

After creating dimension files, `review-init` offers to generate matching GitHub Copilot
instruction files in `.github/instructions/`. These instruct Copilot's automatic PR code
review to follow the same standards as your Claude Code dimensions.

Each dimension maps to one path-specific instruction file:

| Dimension field  | Copilot field                       | Notes                                        |
|------------------|-------------------------------------|----------------------------------------------|
| `triggers`       | `applyTo` (comma-separated string)  | Activates instruction for matched file paths |
| `description`    | Opening paragraph                   | Used as-is                                   |
| `severity`       | Header note                         | "Default severity: {value}"                  |
| Body checklist   | Checklist section                   | Converts checkbox items to plain list        |
| `skip-when`      | Advisory note                       | Copilot has no native exclusion support      |

### Copilot instruction file format

```markdown
---
applyTo: "**/middleware/**,**/auth/**"
---
# security-review — Review Instructions

Reviews changes for authentication, authorization, injection vulnerabilities, and secrets exposure.

Default severity: high

## Checklist

- No hardcoded credentials, API keys, or secrets
- All user-supplied input is validated before use
- Authentication checks are present on protected routes
- No SQL injection vectors (use parameterized queries)
- No command injection (avoid exec/shell with user input)

## Severity Guide

| Finding                              | Severity |
|--------------------------------------|----------|
| Hardcoded secret / credential        | critical |
| Missing authentication on route      | critical |
| SQL / command injection vector       | critical |
| Missing authorization check          | high     |
```

### Copilot limits

- **4,000-character limit**: Copilot code review reads only the first 4,000 characters of
  each instruction file. `review-init` estimates the size before writing and condenses any
  file that would exceed this limit.
- **No exclusion support**: `skip-when` patterns from the dimension are noted in a `## Note`
  section but are not enforced by Copilot.
- **Base branch**: Copilot uses instructions from the PR's base branch, not the feature branch.

Use `--no-copilot` to skip this prompt if you manage Copilot instructions separately.

---

## Related Commands

- [`/sdlc:review`](review.md) — run the review using dimension files created by this command
