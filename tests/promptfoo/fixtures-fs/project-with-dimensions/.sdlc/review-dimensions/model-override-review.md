---
name: model-override-review
description: Review dimension declaring an explicit per-dimension model override.
severity: medium
model: claude-haiku-4-5-20251001
triggers:
  - "**/*.ts"
  - "**/*.js"
---

# Model Override Review

This dimension declares a `model:` field in its frontmatter to demonstrate the
per-dimension model override (R15). The orchestrator dispatches this dimension's
subagent using the declared model rather than the manifest default.
