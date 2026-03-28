# Simulated Project Context: Project with Filtered Dimensions (--dimensions flag)

## Project Structure

Node.js/Express REST API with TypeScript. Auth middleware recently updated.

```
src/
  middleware/     ← Auth, validation middleware
  routes/         ← API route handlers
  __tests__/      ← Test files
.claude/
  review-dimensions/
    security-review.md
    code-quality-review.md
    api-review.md
package.json
```

## Installed Review Dimensions

Three dimensions installed. Review was invoked with `--dimensions security-review`, so only security-review is active.

### security-review.md
```yaml
---
name: security-review
description: Review for authentication and authorization vulnerabilities
severity: high
triggers:
  - "src/middleware/**"
  - "src/routes/**"
---
```

### code-quality-review.md
```yaml
---
name: code-quality-review
description: Review code style, complexity, and naming conventions.
severity: medium
triggers:
  - "**/*.ts"
---
```

### api-review.md
```yaml
---
name: api-review
description: Review API contract, error handling, and response consistency.
severity: high
triggers:
  - "src/routes/**"
---
```

## review-prepare.js Output (JSON manifest)

```json
{
  "scope": "all",
  "base_branch": "main",
  "current_branch": "feat/auth-updates",
  "git": {
    "commit_count": 3,
    "commit_log": "abc1234 feat: update auth middleware\ndef5678 fix: token refresh\nghi9012 test: auth tests",
    "changed_files": ["src/middleware/auth.ts", "src/routes/users.ts", "src/__tests__/auth.test.ts"]
  },
  "dimensions": [
    {
      "name": "security-review",
      "description": "Review for authentication and authorization vulnerabilities",
      "status": "ACTIVE",
      "severity": "high",
      "matched_files": ["src/middleware/auth.ts", "src/routes/users.ts"],
      "matched_count": 2,
      "diff_file": "/tmp/sdlc-review-xyz/security-review.diff"
    }
  ],
  "plan_critique": {
    "uncovered_files": ["src/__tests__/auth.test.ts"],
    "uncovered_suggestions": [],
    "over_broad_dimensions": [],
    "overlapping_pairs": [],
    "dimension_cap_applied": false,
    "queued_dimensions": []
  },
  "summary": {
    "total_dimensions": 3,
    "active_dimensions": 1,
    "skipped_dimensions": 0,
    "total_changed_files": 3,
    "uncovered_file_count": 1
  }
}
```
