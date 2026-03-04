# Review Dimension Examples

Five ready-to-use dimension files. Copy any of these to your project's
`.claude/review-dimensions/` directory and adjust triggers and instructions
for your tech stack.

---

## security-review.md

```markdown
---
name: security-review
description: "Reviews changes for authentication, authorization, injection vulnerabilities, and secrets exposure"
triggers:
  - "**/middleware/**"
  - "**/auth/**"
  - "**/*auth*"
  - "**/*token*"
  - "**/*secret*"
  - "**/*password*"
  - "**/routes/**"
  - "**/controllers/**"
skip-when:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/testdata/**"
  - "**/__fixtures__/**"
severity: high
max-files: 50
---

# Security Review

Review all changes for security vulnerabilities.

## Checklist

- [ ] No hardcoded credentials, API keys, or secrets in code or config files
- [ ] All user-supplied input is validated before use
- [ ] Authentication checks are present and correct on protected routes
- [ ] Authorization (role/permission checks) is enforced, not just authentication
- [ ] No SQL injection vectors (use parameterized queries / ORM, not string concat)
- [ ] No command injection (avoid exec/shell with user input)
- [ ] No XSS vectors (escape output, use safe APIs)
- [ ] Session tokens are handled securely (HttpOnly, Secure, SameSite)
- [ ] Cryptographic operations use approved libraries and algorithms

## Severity Guide

| Finding | Severity |
|---------|----------|
| Hardcoded secret / credential | critical |
| Missing authentication on protected route | critical |
| SQL / command injection vector | critical |
| Missing authorization check | high |
| Unvalidated user input reaching sensitive operation | high |
| Weak cryptography | high |
| Missing CSRF token | medium |
| Logging sensitive data | medium |
| Overly broad CORS policy | medium |
| Missing rate limiting on auth endpoints | low |
```

---

## code-quality.md

```markdown
---
name: code-quality
description: "Reviews for code clarity, error handling, naming conventions, and common code smells"
triggers:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.py"
  - "**/*.go"
  - "**/*.java"
  - "**/*.rb"
skip-when:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/node_modules/**"
  - "**/vendor/**"
  - "**/dist/**"
  - "**/build/**"
severity: medium
---

# Code Quality Review

Review for code clarity, maintainability, and common code smells.

## Checklist

- [ ] Function and variable names are clear and intention-revealing
- [ ] Functions do one thing (single responsibility)
- [ ] Error cases are handled explicitly — no silent failures
- [ ] No magic numbers or strings (use named constants)
- [ ] No dead code or commented-out code blocks
- [ ] No unnecessary complexity (YAGNI — you aren't gonna need it)
- [ ] No deeply nested conditionals that could be simplified
- [ ] Async operations handle errors (try/catch or .catch())
- [ ] No obvious resource leaks (unclosed connections, files, event listeners)
- [ ] Consistent style with surrounding code

## Severity Guide

| Finding | Severity |
|---------|----------|
| Silent error swallowing / lost error context | high |
| Resource leak | high |
| Inconsistent/misleading naming that could cause bugs | medium |
| Dead code | low |
| Magic number without explanation | low |
| Overly nested code (>3 levels deep) | low |
| Commented-out code blocks | info |
```

---

## performance.md

```markdown
---
name: performance
description: "Reviews for N+1 queries, unnecessary allocations, blocking operations, and caching opportunities"
triggers:
  - "**/services/**"
  - "**/repositories/**"
  - "**/models/**"
  - "**/queries/**"
  - "**/*repository*"
  - "**/*service*"
  - "**/*query*"
  - "**/*cache*"
severity: medium
max-files: 30
---

# Performance Review

Review for common performance pitfalls.

## Checklist

- [ ] No N+1 query patterns (single-row fetches inside loops)
- [ ] Database queries select only needed columns (avoid SELECT *)
- [ ] Large result sets are paginated, not fetched entirely
- [ ] Expensive operations are not repeated unnecessarily (memoize / cache where appropriate)
- [ ] No synchronous / blocking I/O calls in async contexts
- [ ] No unnecessary data serialization / deserialization in hot paths
- [ ] Database indexes exist for fields used in WHERE / ORDER BY clauses (check migrations)
- [ ] Bulk operations use batch APIs rather than individual calls

## Severity Guide

| Finding | Severity |
|---------|----------|
| N+1 query in high-traffic path | high |
| Unbounded result set (no pagination) | high |
| Blocking I/O in async context | high |
| Repeated expensive computation (no memoization) | medium |
| SELECT * on large table | medium |
| Missing index on frequently queried field | medium |
| Minor allocation inefficiency | low |
```

---

## api-review.md

```markdown
---
name: api-review
description: "Reviews API changes for breaking changes, versioning, consistent error responses, and OpenAPI alignment"
triggers:
  - "**/routes/**"
  - "**/controllers/**"
  - "**/handlers/**"
  - "**/api/**"
  - "**/*router*"
  - "**/*handler*"
  - "**/*.yaml"
  - "**/*.json"
skip-when:
  - "**/node_modules/**"
  - "**/dist/**"
  - "**/*.test.*"
  - "**/*.spec.*"
severity: high
---

# API Review

Review API changes for contract stability and consistency.

## Checklist

- [ ] No breaking changes to existing endpoints (removed fields, changed types, renamed paths)
- [ ] New endpoints follow existing naming and versioning conventions
- [ ] All error responses use consistent shape (e.g., `{ error: { code, message } }`)
- [ ] HTTP status codes are semantically correct (200/201/204/400/401/403/404/422/500)
- [ ] Pagination, filtering, and sorting follow existing API conventions
- [ ] Auth requirements are explicitly enforced on new endpoints
- [ ] OpenAPI/Swagger spec updated if it exists
- [ ] Sensitive data is not returned in responses unnecessarily

## Severity Guide

| Finding | Severity |
|---------|----------|
| Breaking change to existing endpoint | critical |
| Missing auth on new endpoint | critical |
| Inconsistent error response shape | high |
| Wrong HTTP status code | medium |
| OpenAPI spec not updated | medium |
| Sensitive data in response | high |
| Missing pagination on list endpoint | medium |
```

---

## test-coverage.md

```markdown
---
name: test-coverage
description: "Reviews whether new code paths have corresponding tests and whether existing tests remain meaningful"
triggers:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.py"
  - "**/*.go"
  - "**/*.java"
  - "**/*.rb"
skip-when:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/node_modules/**"
  - "**/vendor/**"
severity: medium
---

# Test Coverage Review

Review whether new code changes are accompanied by appropriate tests.

## Checklist

- [ ] New functions / methods have at least one test covering the happy path
- [ ] New error conditions have tests (edge cases, invalid input, failure modes)
- [ ] Tests are meaningful — they assert on behavior, not just that code runs
- [ ] Tests do not rely on external state (no implicit ordering, no shared mutable state)
- [ ] Mock/stub usage is appropriate — not hiding real behavior that should be tested
- [ ] Test names describe the scenario clearly (Given/When/Then or similar)
- [ ] Regression tests added when fixing bugs

## Severity Guide

| Finding | Severity |
|---------|----------|
| Complex new logic with no tests | high |
| Bug fix with no regression test | high |
| New public API function with no tests | medium |
| Test assertions too broad (only checks non-null) | medium |
| Missing edge case test | low |
| Test name does not describe scenario | info |
```
