# `/review-init-sdlc` — Review Dimension Setup

## Overview

Scans the project's tech stack, dependencies, and file structure, then proposes and creates tailored review dimension files in `.claude/review-dimensions/`. Each dimension file defines a lens (security, API contracts, test coverage, etc.) that `/review-sdlc` uses to focus its analysis. Covers 31 dimension types across technical code concerns, pipeline/config/docs review, project architecture patterns, and more. Run once per project, then use `--add` to expand as the codebase evolves.

---

## Usage

```text
/review-init-sdlc
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
/review-init-sdlc
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
/review-init-sdlc --add
```

Proposes only dimensions not yet present in `.claude/review-dimensions/`. In `--add` mode, the skill also runs `review-prepare.js` on the current branch and uses any `uncovered_suggestions` (files not covered by installed dimensions) as additional evidence for proposals — citing the specific files found.

---

## Expanded Dimension Catalog

`review-init` can propose any of these 31 dimension types depending on project evidence:

### Always included

| Dimension             | Severity | Evidence    |
|-----------------------|----------|-------------|
| `code-quality-review` | medium   | Any project |

### Security & data

| Dimension                       | Severity | Evidence                                          |
|---------------------------------|----------|---------------------------------------------------|
| `security-review`               | high     | Auth dirs, JWT/OAuth/session deps                 |
| `data-integrity-review`         | high     | ORM deps, migration files, SQL dirs               |
| `database-migrations-review`    | high     | `migrations/` dir, Prisma/Alembic/Flyway files    |

### API

| Dimension             | Severity | Evidence                                       |
|-----------------------|----------|------------------------------------------------|
| `api-review`          | high     | Route/controller/handler dirs, OpenAPI files   |
| `api-contract-review` | high     | OpenAPI/GraphQL schemas, .proto files           |

### Code patterns

| Dimension                    | Severity | Evidence                                              |
|------------------------------|----------|-------------------------------------------------------|
| `error-handling-review`      | medium   | Error boundary files, retry/circuit-breaker patterns  |
| `naming-conventions-review`  | low      | Mixed casing styles, ESLint naming rules              |
| `type-safety-review`         | medium   | `tsconfig.json` strict mode, `.d.ts` files            |
| `state-management-review`    | medium   | Redux/Zustand/Vuex/Pinia deps, `store/` dirs          |
| `concurrency-review`         | high     | Queue libs, worker dirs, async patterns               |

### Testing

| Dimension              | Severity | Evidence                                          |
|------------------------|----------|---------------------------------------------------|
| `test-coverage-review` | medium   | Test files present (`*.test.*`, `*.spec.*`)       |

### Infrastructure & dependencies

| Dimension                        | Severity | Evidence                                          |
|----------------------------------|----------|---------------------------------------------------|
| `infrastructure-review`          | medium   | Docker, k8s, Terraform, CI/CD files               |
| `ci-cd-pipeline-review`          | medium   | `.github/workflows/`, `.circleci/`, `Jenkinsfile` |
| `dependency-management-review`   | medium   | Lock files, `.npmrc`, license-checking deps       |
| `configuration-management-review`| medium   | `.env*`, `config/`, feature flag libs             |

### Frontend

| Dimension                    | Severity | Evidence                               |
|------------------------------|----------|----------------------------------------|
| `ui-review`                  | medium   | UI components, CSS/SCSS, template files|
| `accessibility-review`       | medium   | Components + a11y testing deps         |
| `internationalization-review`| low      | `i18n/`, `locales/`, i18n lib deps     |

### Observability & performance

| Dimension                      | Severity | Evidence                                     |
|--------------------------------|----------|----------------------------------------------|
| `performance-review`           | medium   | Cache libs, service/repo layers              |
| `logging-observability-review` | medium   | Structured logging libs, OpenTelemetry deps  |

### Documentation

| Dimension                      | Severity | Evidence                                          |
|--------------------------------|----------|---------------------------------------------------|
| `documentation-review`         | low      | `docs/` directory, multiple `.md` files           |
| `documentation-quality-review` | low      | JSDoc/docstring config, CHANGELOG, README signals |

### CLI

| Dimension        | Severity | Evidence                                          |
|------------------|----------|---------------------------------------------------|
| `cli-ux-review`  | medium   | `bin/` dir, `commander`/`yargs`/`cobra` deps      |

### Project-type

| Dimension                     | Severity | Evidence                                                  |
|-------------------------------|----------|-----------------------------------------------------------|
| `monorepo-governance-review`  | medium   | `packages/`/`apps/` + workspace config                    |
| `plugin-architecture-review`  | medium   | `plugins/` dir + manifest/hook patterns                   |
| `sdk-library-design-review`   | high     | Package exports, barrel files, semver, CHANGELOG          |
| `mobile-app-review`           | medium   | `android/`/`ios/` dirs, React Native/Flutter deps         |
| `data-pipeline-review`        | high     | DAGs, ETL scripts, Spark/Airflow deps                     |
| `ml-ai-review`                | medium   | Model files, ML libs (torch, tensorflow, sklearn)         |
| `microservices-review`        | medium   | Docker Compose multi-service, API gateway, contract tests |

---

## Prerequisites

- **Git repository** — the skill scans the project structure and git history.

### Harness Configuration

| Field | Value |
|---|---|
| `argument-hint` | `[--add] [--no-copilot]` |
| Plan mode | Not adapted (writes dimension files) |

---

## What It Creates or Modifies

| File / Artifact                          | Description                                                                  |
|------------------------------------------|------------------------------------------------------------------------------|
| `.claude/review-dimensions/*.md`         | One file per dimension, used by `/review-sdlc`                               |
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

## OpenSpec Integration

When the project uses [OpenSpec](https://github.com/Fission-AI/OpenSpec/), this skill proposes a `spec-compliance-review` dimension (high severity) during the tech stack scan.

- **Evidence:** `openspec/config.yaml` present with delta spec files in `openspec/changes/*/specs/`
- **Dimension purpose:** Verifies that code changes satisfy delta spec requirements — checks ADDED, MODIFIED, and REMOVED requirements

See [OpenSpec Integration Guide](../openspec-integration.md) for the full workflow.

---

## Related Skills

- [`/review-sdlc`](review-sdlc.md) — uses the review dimensions this skill creates
