---
name: security-review
description: Review for authentication, authorization, injection vulnerabilities, and secrets exposure.
severity: high
triggers:
  - "src/**/*.ts"
  - "src/**/*.js"
  - "**/*.env*"
---

# Security Review

Check for authentication bypass, injection, and exposed secrets.
