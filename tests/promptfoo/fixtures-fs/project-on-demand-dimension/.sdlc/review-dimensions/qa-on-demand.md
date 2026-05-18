---
name: qa-on-demand
description: QA-only on-demand review dimension. Triggers only match __qa-only__/** so it never activates during default /review but activates fully when invoked via --dimensions qa-on-demand.
severity: medium
triggers:
  - "__qa-only__/**"
---

# QA On-Demand Review

Performs QA-specific checks when explicitly requested. This dimension is dormant during regular reviews.
