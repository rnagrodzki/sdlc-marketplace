# Simulated Project Context: Project with Truncated Dimension (max-files exceeded)

## Project Structure

Large-scale refactor touching 150+ files across the codebase. The code-quality-review dimension matched more files than the configured max-files limit.

```
src/
  auth/           ← Authentication logic
  api/            ← API layer
  services/       ← Business services
  models/         ← Data models
  utils/          ← Utility functions
  middleware/     ← Express middleware
  config/         ← Configuration files
  controllers/    ← Request controllers
  repositories/   ← Data access layer
.claude/
  review-dimensions/
    code-quality-review.md
    security-review.md
package.json
```

## Installed Review Dimensions

Two dimensions installed. The code-quality-review dimension matched 150 files, exceeding the max-files limit of 100 and was truncated.

### code-quality-review.md
```yaml
---
name: code-quality-review
description: Review code style, complexity, and naming conventions.
severity: medium
triggers:
  - "**/*.ts"
  - "**/*.js"
---
```

### security-review.md
```yaml
---
name: security-review
description: Review for authentication, authorization, injection vulnerabilities.
severity: high
triggers:
  - "src/auth/**"
  - "src/middleware/**"
  - "src/config/**"
---
```

## review-prepare.js Output (JSON manifest)

```json
{
  "scope": "all",
  "base_branch": "main",
  "current_branch": "refactor/large-migration",
  "git": {
    "commit_count": 2,
    "commit_log": "zzz0001 refactor: migrate all services to new pattern\nzzz0002 refactor: update models and repositories",
    "changed_files": [
      "src/services/user.ts",
      "src/services/auth.ts",
      "src/services/payment.ts",
      "src/services/notification.ts",
      "src/services/order.ts",
      "src/models/user.ts",
      "src/models/product.ts",
      "src/models/order.ts",
      "src/repositories/user.ts",
      "src/repositories/product.ts",
      "src/controllers/users.ts",
      "src/controllers/orders.ts",
      "src/api/routes/users.ts",
      "src/api/routes/orders.ts",
      "src/utils/validation.ts",
      "src/utils/errors.ts",
      "src/auth/login.ts",
      "src/auth/register.ts",
      "src/middleware/auth.ts",
      "src/config/secrets.ts"
    ]
  },
  "dimensions": [
    {
      "name": "code-quality-review",
      "status": "TRUNCATED",
      "severity": "medium",
      "matched_count": 150,
      "max_files": 100,
      "truncated": true,
      "matched_files": ["src/services/user.ts", "src/services/auth.ts"],
      "warnings": ["Matched 150 files, truncated to max-files limit of 100"]
    },
    {
      "name": "security-review",
      "status": "ACTIVE",
      "severity": "high",
      "matched_count": 5,
      "matched_files": [
        "src/auth/login.ts",
        "src/auth/register.ts",
        "src/middleware/auth.ts",
        "src/config/secrets.ts",
        "src/utils/crypto.ts"
      ]
    }
  ],
  "plan_critique": {
    "uncovered_files": [],
    "uncovered_suggestions": [],
    "over_broad_dimensions": [],
    "overlapping_pairs": [],
    "dimension_cap_applied": false,
    "queued_dimensions": []
  },
  "summary": {
    "total_dimensions": 2,
    "active_dimensions": 1,
    "skipped_dimensions": 0,
    "total_changed_files": 155,
    "uncovered_file_count": 0
  }
}
```
