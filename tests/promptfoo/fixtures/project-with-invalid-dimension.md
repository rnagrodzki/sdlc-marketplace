# Simulated Project Context: Project with Invalid Dimension (Validation Failed)

## Project Structure

Go REST API with PostgreSQL and OpenAPI spec.

```
cmd/
  api/
    main.go
internal/
  handlers/    ← 10 HTTP handler files
  models/      ← 8 model files
  repository/  ← 6 repository files
  middleware/  ← 4 middleware files
api/
  openapi.yaml
.claude/
  review-dimensions/
    security-review.md
    code-quality-review.md
    api-review.md
go.mod
go.sum
```

## Key Dependencies (go.mod)

```
module github.com/example/api

go 1.22

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/jackc/pgx/v5 v5.5.3
    github.com/golang-migrate/migrate/v4 v4.17.0
    github.com/stretchr/testify v1.8.4
)
```

## Review Dimensions State

`.claude/review-dimensions/` exists with **3 dimension files**:

- `security-review.md`
- `code-quality-review.md`
- `api-review.md`

## validate-dimensions.js Output (exit code 1)

```
Dimension Validation Report

| Dimension           | Status | Errors | Warnings |
|---------------------|--------|--------|----------|
| security-review     | PASS   | 0      | 0        |
| code-quality-review | FAIL   | 1      | 0        |
| api-review          | PASS   | 0      | 1        |

Overall: HAS_ISSUES

Errors:
- code-quality-review.md: D4 — triggers field is empty (must be a non-empty array)

Warnings:
- api-review.md: D11 — unknown field "require-full-diff" (did you mean: requires-full-diff?)
```

## Context

Validation failed after dimension creation (exit code 1). The skill should recognize that
`code-quality-review.md` has a blocking error (D4: empty triggers field) and `api-review.md`
has a non-blocking warning (D11: unknown field name). The skill must offer to fix these issues
before proceeding. It should not re-generate dimensions that passed validation.
