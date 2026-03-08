# Simulated Project Context: Feature Branch with JIRA Reference

## Git State

- **Current branch:** `PROJ-456/fix-auth-timeout`
- **Base branch:** `main`
- **Remote state:** branch exists on origin, up to date

## Commit Log (3 commits since main)

```
aaa1111 fix(auth): increase JWT token expiry to 24h to fix session timeout [PROJ-456]
bbb2222 fix(auth): add refresh token rotation on near-expiry
ccc3333 test(auth): add tests for token refresh and timeout scenarios
```

## JIRA Detection

- Branch name matches pattern `[A-Z]{2,10}-\d+`: **PROJ-456**
- Commit subjects also reference PROJ-456

## Diff Summary

**Files changed:** 3

- `src/middleware/auth.ts` — modified (67 lines): changed token expiry, added refresh logic
- `src/middleware/auth.test.ts` — modified (120 lines): added timeout and refresh test cases
- `src/config/jwt.ts` — modified (8 lines): updated TOKEN_EXPIRY constant

## Diff Stat

```
3 files changed, 195 insertions(+), 42 deletions(-)
```

## pr-prepare.js Output (JSON)

```json
{
  "mode": "create",
  "baseBranch": "main",
  "currentBranch": "PROJ-456/fix-auth-timeout",
  "isDraft": false,
  "existingPr": null,
  "jiraTicket": "PROJ-456",
  "commits": [
    { "subject": "fix(auth): increase JWT token expiry to 24h to fix session timeout [PROJ-456]", "body": "" },
    { "subject": "fix(auth): add refresh token rotation on near-expiry", "body": "" },
    { "subject": "test(auth): add tests for token refresh and timeout scenarios", "body": "" }
  ],
  "diffStat": "3 files changed, 195 insertions(+), 42 deletions(-)",
  "remoteState": "up-to-date",
  "customTemplate": null,
  "warnings": [],
  "errors": []
}
```
