---
name: code-quality
description: "Reviews Node.js scripts for error handling, async patterns, consistent CLI conventions, and common code smells"
triggers:
  - "**/*.js"
skip-when:
  - "**/node_modules/**"
  - "**/dist/**"
  - "**/build/**"
  - "**/vendor/**"
severity: medium
model: sonnet
---

# Code Quality Review

Review Node.js scripts for clarity, correctness, and maintainability. This project uses standalone Node.js scripts (no package.json / no bundler) in `plugins/*/scripts/` and `.github/scripts/`.

## Checklist

- [ ] Functions and variables use clear, intention-revealing names
- [ ] Functions have single responsibility — not doing too many things
- [ ] Error cases are handled explicitly — no silent `catch {}` blocks that swallow errors
- [ ] Scripts use correct exit codes: `process.exit(0)` for success, `process.exit(1)` for user errors, `process.exit(2)` for script errors — both plugin scripts (`scripts/*.js`) and CI scripts (`.github/scripts/*.js`) follow this convention
- [ ] Error messages go to `stderr` (`process.stderr.write` or `console.error`), normal output to `stdout`
- [ ] File paths use `path.join()` or `path.resolve()` — no string concatenation for paths
- [ ] `child_process` calls (execSync, spawnSync) handle errors and check exit codes
- [ ] No magic numbers or strings — use named constants
- [ ] No dead code or commented-out code blocks
- [ ] `fs` operations check for file/directory existence before access where appropriate
- [ ] Consistent patterns across lib modules (e.g., similar error handling, similar function signatures)
- [ ] YAML/JSON parsing has proper error handling for malformed input
- [ ] No unnecessary complexity — prefer simple, direct code over abstractions

## Severity Guide

| Finding | Severity |
|---------|----------|
| Silent error swallowing / lost error context | high |
| Wrong exit code (success on error, or vice versa) | high |
| Missing error handling on fs/child_process operations | high |
| Path string concatenation instead of path.join | medium |
| Inconsistent/misleading naming that could cause bugs | medium |
| Dead code | low |
| Magic number without explanation | low |
| Commented-out code blocks | info |
