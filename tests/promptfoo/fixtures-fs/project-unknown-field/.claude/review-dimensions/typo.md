---
name: typo-dimension
description: "A test dimension with a typo in severity field name"
triggers:
  - "**/*.js"
sevrity: high
---

# Typo Test Dimension

This dimension has a misspelled field name (sevrity instead of severity)
to test D11 unknown field detection with typo suggestions.
