---
name: ci-cd-pipeline
description: "Reviews GitHub Actions workflows and CI scripts for permissions, secret handling, job ordering, and script-to-workflow contract alignment"
triggers:
  - ".github/workflows/*.yml"
  - ".github/scripts/*.js"
skip-when:
  - "**/node_modules/**"
severity: high
model: sonnet
---

# CI/CD Pipeline Review

Review GitHub Actions workflows and their companion CI scripts for security, correctness, and contract alignment. This project ships workflows that invoke Node.js scripts under `.github/scripts/`; both sides of that boundary must agree on environment variable names, exit codes, and permissions. Past issues include over-broad `permissions:` blocks and env variable mismatches between YAML definitions and `process.env` reads in scripts.

## Checklist

- [ ] Every `permissions:` block is scoped to the minimum required — use `contents: read` unless the job explicitly pushes tags or commits, which requires `contents: write`
- [ ] `retag-release.yml` carries `contents: write` permission (required for tag push operations)
- [ ] `check-version-bump.yml` correctly passes PR base context so the script can resolve the comparison ref
- [ ] No secrets or tokens are hardcoded in workflow YAML — all sensitive values are referenced via `${{ secrets.NAME }}` or `${{ github.token }}`
- [ ] Job `needs:` declarations match actual execution dependencies — no job starts before its required predecessor has completed
- [ ] Workflows that mutate shared state (tags, releases, branches) define a `concurrency:` group to prevent parallel runs from racing
- [ ] Action references are pinned to full SHA hashes (e.g., `uses: actions/checkout@abc1234...`), not mutable version tags like `@v4`
- [ ] Workflow `env:` variable names (e.g., `BASE_REF`, `PR_NUMBER`) match exactly what CI scripts read from `process.env` — no casing or naming drift
- [ ] CI scripts use `process.exit(0)`, `process.exit(1)`, and `process.exit(2)` consistently per the documented exit code contract (`0` = success, `1` = handled error, `2` = unexpected crash)
- [ ] Version comments in workflow YAML headers match the version exported or logged by the corresponding CI script
- [ ] Workflow steps that invoke CI scripts check `$?` after execution and fail the job explicitly on non-zero exit rather than silently continuing
- [ ] No `pull_request_target` trigger is used without verifying that it cannot be exploited to expose secrets to untrusted forks

## Severity Guide

| Finding | Severity |
|---------|----------|
| Hardcoded secret or token in YAML | critical |
| Permission scope too broad (e.g., `contents: write` when read suffices) | high |
| Missing `needs:` causing job race condition | high |
| Action pinned to mutable tag instead of SHA | high |
| Env variable mismatch between workflow and script | high |
| Version comment mismatch between workflow and script | medium |
| Missing concurrency group for racing workflows | medium |
| CI script exit code inconsistency | medium |
| Minor YAML formatting or documentation gap | low |
