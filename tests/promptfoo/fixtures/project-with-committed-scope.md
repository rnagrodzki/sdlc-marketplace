# Simulated Project Context: Project with Committed Scope (--committed flag)

## Project Structure

Node.js/Express REST API with TypeScript. Search feature added across multiple commits.

```
src/
  routes/         ← API route handlers
  services/       ← Business logic
  __tests__/      ← Test files
docs/
  api/
    search.md     ← API documentation
.claude/
  review-dimensions/
    code-quality-review.md
    api-review.md
package.json
```

## Installed Review Dimensions

Two dimensions installed. Review was invoked with `--committed` scope — only committed changes are in scope, no staged content.

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
  "scope": "committed",
  "base_branch": "main",
  "current_branch": "feat/search-api",
  "uncommitted_changes": false,
  "git": {
    "commit_count": 4,
    "commit_log": "aaa1111 feat: add search endpoint\nbbb2222 feat: search filters\nccc3333 test: search tests\nddd4444 docs: search API docs",
    "changed_files": ["src/routes/search.ts", "src/services/search.ts", "src/__tests__/search.test.ts", "docs/api/search.md"]
  },
  "dimensions": [
    {
      "name": "code-quality-review",
      "status": "ACTIVE",
      "severity": "medium",
      "matched_files": ["src/routes/search.ts", "src/services/search.ts", "src/__tests__/search.test.ts"],
      "matched_count": 3
    },
    {
      "name": "api-review",
      "status": "ACTIVE",
      "severity": "high",
      "matched_files": ["src/routes/search.ts"],
      "matched_count": 1
    }
  ],
  "plan_critique": {
    "uncovered_files": ["docs/api/search.md"],
    "uncovered_suggestions": [
      {
        "dimension": "documentation-quality-review",
        "files": ["docs/api/search.md"],
        "reason": "1 documentation file not covered"
      }
    ],
    "over_broad_dimensions": [],
    "overlapping_pairs": [],
    "dimension_cap_applied": false,
    "queued_dimensions": []
  },
  "summary": {
    "total_dimensions": 2,
    "active_dimensions": 2,
    "skipped_dimensions": 0,
    "total_changed_files": 4,
    "uncovered_file_count": 1,
    "suggested_dimensions": 1
  }
}
```
