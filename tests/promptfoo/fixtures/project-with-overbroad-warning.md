# Simulated Project Context: Project with Over-Broad Dimension Warning

## Project Structure

Node.js/Express API with TypeScript. New module added. The code-quality-review dimension covers 90% of changed files, triggering an over-broad warning.

```
src/
  a.ts
  b.ts
  c.ts
  d.ts
  e.ts
  f.ts
  g.ts
  h.ts
  i.ts
  j.ts
.claude/
  review-dimensions/
    code-quality-review.md
    security-review.md
package.json
```

## Installed Review Dimensions

Two dimensions installed. The code-quality-review dimension matched 9 of 10 changed files (90%), which exceeds the over-broad threshold.

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

### security-review.md
```yaml
---
name: security-review
description: Review for authentication, authorization, injection vulnerabilities.
severity: high
triggers:
  - "src/a.ts"
  - "src/b.ts"
---
```

## review-prepare.js Output (JSON manifest)

```json
{
  "scope": "all",
  "base_branch": "main",
  "current_branch": "feat/new-module",
  "git": {
    "commit_count": 5,
    "commit_log": "bbb0001 feat: add new module files a-e\nbbb0002 feat: add new module files f-j",
    "changed_files": [
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
      "src/d.ts",
      "src/e.ts",
      "src/f.ts",
      "src/g.ts",
      "src/h.ts",
      "src/i.ts",
      "src/j.ts"
    ]
  },
  "dimensions": [
    {
      "name": "code-quality-review",
      "status": "ACTIVE",
      "severity": "medium",
      "matched_count": 9,
      "matched_files": [
        "src/a.ts",
        "src/b.ts",
        "src/c.ts",
        "src/d.ts",
        "src/e.ts",
        "src/f.ts",
        "src/g.ts",
        "src/h.ts",
        "src/i.ts"
      ]
    },
    {
      "name": "security-review",
      "status": "ACTIVE",
      "severity": "high",
      "matched_count": 2,
      "matched_files": ["src/a.ts", "src/b.ts"]
    }
  ],
  "plan_critique": {
    "uncovered_files": ["src/j.ts"],
    "uncovered_suggestions": [],
    "over_broad_dimensions": ["code-quality-review"],
    "overlapping_pairs": [],
    "dimension_cap_applied": false,
    "queued_dimensions": []
  },
  "summary": {
    "total_dimensions": 2,
    "active_dimensions": 2,
    "skipped_dimensions": 0,
    "total_changed_files": 10,
    "uncovered_file_count": 1
  }
}
```
