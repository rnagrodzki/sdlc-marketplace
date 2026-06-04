---
name: security-review
description: Reviews source changes for security issues (auth, injection, secrets).
severity: high
triggers:
  - "src/**/*.ts"
---

# Security Review

Check for authentication gaps, injection vulnerabilities, and exposed secrets.
