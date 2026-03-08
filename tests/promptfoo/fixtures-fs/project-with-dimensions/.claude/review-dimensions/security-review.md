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

Check for OWASP Top 10 vulnerabilities, secrets in code, and authentication gaps.
