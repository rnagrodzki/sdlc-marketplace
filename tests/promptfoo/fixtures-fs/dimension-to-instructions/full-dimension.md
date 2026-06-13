---
name: example-dimension
description: "Reviews example patterns for correctness across contexts"
triggers:
  - "**/commands/*.md"
  - "**/skills/**/SKILL.md"
skip-when:
  - "**/node_modules/**"
  - "docs/**"
severity: high
model: sonnet
---

# Example Review

Review the example patterns. This intro paragraph is dropped by the transform.

## Checklist

- [ ] First check uses the two-step pattern
- [ ] Second check ends with a failure guard
- [ ] Third check names the specific script

## Severity Guide

| Finding | Severity |
|---------|----------|
| Missing failure guard | high |
| Broad glob pattern | medium |
