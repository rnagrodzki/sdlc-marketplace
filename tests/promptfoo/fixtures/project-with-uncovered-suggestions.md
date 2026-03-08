# Simulated Project Context: Project with Uncovered Files That Have Dimension Suggestions

## Project Structure

Node.js/Express API with CI/CD workflows and config files not covered by installed dimensions.

```
src/
  routes/         ← API route handlers
  middleware/     ← Auth middleware
  config/         ← App configuration files
.github/
  workflows/
    ci.yml        ← GitHub Actions CI pipeline
    deploy.yml    ← Deployment workflow
.claude/
  review-dimensions/
    security-review.md
    code-quality-review.md
package.json
.env.example
```

## Installed Review Dimensions

Two dimensions installed (security + code-quality). No CI/CD or config dimensions.

## review-prepare.js Output (JSON manifest)

```json
{
  "scope": "all",
  "base_branch": "main",
  "git": {
    "changed_files": [
      "src/routes/users.ts",
      "src/middleware/auth.ts",
      ".github/workflows/ci.yml",
      ".github/workflows/deploy.yml",
      "src/config/db.ts",
      "src/config/auth.ts",
      ".env.example"
    ]
  },
  "dimensions": [
    {
      "name": "security-review",
      "status": "ACTIVE",
      "severity": "high",
      "matched_files": ["src/routes/users.ts", "src/middleware/auth.ts"],
      "file_count": 2
    },
    {
      "name": "code-quality-review",
      "status": "ACTIVE",
      "severity": "medium",
      "matched_files": ["src/routes/users.ts", "src/middleware/auth.ts"],
      "file_count": 2
    }
  ],
  "plan_critique": {
    "uncovered_files": [
      ".github/workflows/ci.yml",
      ".github/workflows/deploy.yml",
      "src/config/db.ts",
      "src/config/auth.ts",
      ".env.example"
    ],
    "uncovered_suggestions": [
      {
        "dimension": "ci-cd-pipeline-review",
        "files": [".github/workflows/ci.yml", ".github/workflows/deploy.yml"],
        "reason": "2 CI/CD workflow files not covered by any dimension"
      },
      {
        "dimension": "configuration-management-review",
        "files": ["src/config/db.ts", "src/config/auth.ts", ".env.example"],
        "reason": "3 configuration files not covered by any dimension"
      }
    ],
    "still_uncovered": [],
    "over_broad_dimensions": [],
    "overlapping_pairs": [],
    "dimension_cap_applied": false,
    "queued_dimensions": []
  },
  "summary": {
    "total_dimensions": 2,
    "active_dimensions": 2,
    "skipped_dimensions": 0,
    "total_changed_files": 7,
    "uncovered_file_count": 5,
    "suggested_dimensions": 2
  }
}
```
