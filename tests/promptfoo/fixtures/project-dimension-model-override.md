# Simulated Project Context: Dimension with Per-Dimension Model Override

## Project Structure

Node.js/Express REST API with TypeScript.

```
src/
  routes/         ← API route handlers
  middleware/     ← Auth, validation middleware
  models/         ← Database models
.claude/
  review-dimensions/
    security-review.md
    style-review.md
package.json
```

## Installed Review Dimensions

### security-review.md (declares per-dimension `model:` override)
```yaml
---
name: security-review
description: Identify security risks in changed code.
severity: high
model: claude-haiku-4-5-20251001
triggers:
  - "src/middleware/**"
  - "src/routes/**"
---
```

### style-review.md (no `model:` — falls back to manifest default)
```yaml
---
name: style-review
description: Check naming, formatting, and project style conventions.
severity: low
triggers:
  - "**/*.ts"
  - "**/*.js"
---
```

## review-prepare.js Output (JSON manifest)

The manifest carries the per-dimension `model` field on each dimension entry. When a dimension declares `model:`, the orchestrator dispatches that dimension's subagent using `dimension.model` (overriding `manifest.subagent_model`). When `model` is `null`, the orchestrator falls back to `manifest.subagent_model`.

```json
{
  "scope": "all",
  "base_branch": "main",
  "subagent_model": "sonnet",
  "git": {
    "changed_files": [
      "src/routes/users.ts",
      "src/middleware/auth.ts",
      "src/models/user.ts"
    ]
  },
  "dimensions": [
    {
      "name": "security-review",
      "status": "ACTIVE",
      "severity": "high",
      "model": "claude-haiku-4-5-20251001",
      "matched_files": ["src/routes/users.ts", "src/middleware/auth.ts"],
      "file_count": 2
    },
    {
      "name": "style-review",
      "status": "ACTIVE",
      "severity": "low",
      "model": null,
      "matched_files": ["src/routes/users.ts", "src/middleware/auth.ts", "src/models/user.ts"],
      "file_count": 3
    }
  ],
  "summary": {
    "total_dimensions": 2,
    "active_dimensions": 2,
    "skipped_dimensions": 0,
    "total_changed_files": 3
  }
}
```

## Expected Dispatch Behavior

- `security-review` → dispatched with `model: "claude-haiku-4-5-20251001"` (per-dimension override wins)
- `style-review` → dispatched with `model: "sonnet"` (manifest fallback because `dimension.model` is `null`)

## Copilot Path Notes

When `setup-sdlc --dimensions` generates the Copilot equivalents under `.github/instructions/<name>.instructions.md`, the `model:` field is omitted entirely. The Copilot path has no concept of a per-instructions model selector — the transform table in `setup-dimensions.md` lists `model` alongside `max-files` and `requires-full-diff` in the Omit row.
