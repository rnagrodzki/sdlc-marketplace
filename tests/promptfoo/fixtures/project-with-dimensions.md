# Simulated Project Context: Project with Review Dimensions Installed

## Project Structure

Node.js/Express REST API with TypeScript.

```
src/
  routes/         ← API route handlers
  middleware/     ← Auth, validation middleware
  models/         ← Database models
  services/       ← Business logic
  __tests__/      ← Test files
.claude/
  review-dimensions/
    security-review.md
    code-quality-review.md
    api-review.md
package.json
```

## Installed Review Dimensions

### security-review.md
```yaml
---
name: security-review
description: Review for authentication, authorization, injection vulnerabilities.
severity: high
triggers:
  - "src/middleware/**"
  - "src/routes/**"
  - "**/*.env*"
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
  - "**/*.js"
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
  - "**/*.dto.ts"
---
```

## review-prepare.js Output (JSON manifest)

```json
{
  "scope": "all",
  "baseBranch": "main",
  "changedFiles": [
    "src/routes/search.ts",
    "src/routes/users.ts",
    "src/middleware/auth.ts",
    "src/models/user.ts",
    "src/services/search.ts",
    "src/__tests__/search.test.ts",
    "src/__tests__/users.test.ts",
    "package.json"
  ],
  "dimensions": [
    {
      "name": "security-review",
      "status": "ACTIVE",
      "severity": "high",
      "matchedFiles": ["src/routes/search.ts", "src/routes/users.ts", "src/middleware/auth.ts"],
      "fileCount": 3
    },
    {
      "name": "code-quality-review",
      "status": "ACTIVE",
      "severity": "medium",
      "matchedFiles": ["src/routes/search.ts", "src/routes/users.ts", "src/middleware/auth.ts", "src/models/user.ts", "src/services/search.ts", "src/__tests__/search.test.ts", "src/__tests__/users.test.ts"],
      "fileCount": 7
    },
    {
      "name": "api-review",
      "status": "ACTIVE",
      "severity": "high",
      "matchedFiles": ["src/routes/search.ts", "src/routes/users.ts"],
      "fileCount": 2
    }
  ],
  "skippedDimensions": [],
  "critique": {
    "uncoveredFiles": ["package.json"],
    "overBroadDimensions": [],
    "overlappingPairs": [["security-review", "code-quality-review"]]
  },
  "errors": []
}
```
