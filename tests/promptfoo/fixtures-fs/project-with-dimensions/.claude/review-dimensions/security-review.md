---
name: security-review
description: OWASP Top 10 review — tags every finding with the matching A01–A10 category.
severity: high
triggers:
  - "src/**/*.ts"
  - "src/**/*.js"
  - "**/*.env*"
---

# Security Review (OWASP Top 10)

Review changes against the OWASP Top 10 (2025).

## Tagging Instruction (REQUIRED)

For every finding, set `**OWASP:**` to the matching category code (`A01`–`A10`). When a finding spans multiple categories, pick the most specific. Omit only when no OWASP category applies.

## Checklist

- [ ] A01 — Broken access control
- [ ] A02 — Cryptographic failures
- [ ] A03 — Injection
- [ ] A04 — Insecure design
- [ ] A05 — Security misconfiguration
- [ ] A06 — Vulnerable & outdated components
- [ ] A07 — Identification & authentication failures
- [ ] A08 — Software & data integrity failures
- [ ] A09 — Security logging & monitoring failures
- [ ] A10 — SSRF

## Severity Guide

| Category | Default Severity |
|----------|------------------|
| A01, A02, A03, A07 | critical |
| A04, A05, A06, A08, A10 | high |
| A09 | medium |
