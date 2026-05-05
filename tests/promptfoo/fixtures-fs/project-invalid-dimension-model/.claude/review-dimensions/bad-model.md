---
name: bad-model-dimension
description: "A test dimension with non-string model frontmatter to trigger D13"
severity: medium
model: 123
triggers:
  - "**/*.ts"
---

# Bad Model Test

This dimension declares `model: 123` (a number) in its frontmatter. The
validator must emit a D13 warning naming the field and the expected type.
