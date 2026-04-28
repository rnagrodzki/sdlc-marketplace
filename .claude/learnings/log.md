# Learnings Log

Append-only learnings log for the `sdlc-marketplace` repository.
Entries flow from incidents, debugging sessions, and evolution cycles.

Active bugs are tracked in GitHub issues. This log retains only entries < 30 days old
that capture non-obvious gotchas not yet reflected in code, docs, or skills.

## Tracked in GH Issues
- version-sdlc auto-set-upstream → #183
- pr-sdlc post-failure gh-switch → #184
- plan-sdlc README reminder → #185

## 2026-04-29 — received-review-sdlc processing of review findings for fix(#183)
- `not-icontains` on `--set-upstream` would match the string anywhere in the response (including explanatory text), producing false negatives on regression-guard assertions; `not-regex: 'git push.*--set-upstream'` scopes the check to actual push command lines only.
- When adding a new behavior to version-sdlc (R15), always verify: (1) CHANGELOG entry covers the fix, (2) P-fields in spec list all script-provided values the skill uses, (3) user-facing docs describe the behavior, (4) regression-guard assertions are precise enough not to false-negative on prose mentions of flagged strings.
