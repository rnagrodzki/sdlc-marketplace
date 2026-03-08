# Simulated Project Context: Feature Branch with Multiple Commits

## Git State

- **Current branch:** `feat/add-search-api`
- **Base branch:** `main`
- **Remote state:** branch does not exist on origin yet (needs push)

## Commit Log (5 commits since main)

```
abc1234 feat(search): add search endpoint with pagination support
def5678 feat(search): implement SearchResult model and query builder
ghi9012 fix(search): handle empty query string gracefully
jkl3456 chore(search): add integration tests for search endpoint
mno7890 chore(deps): add express-validator for input sanitization
```

No JIRA tickets referenced in branch name or commit subjects.

## Diff Summary

**Files changed:** 7

- `src/routes/search.ts` — new file (220 lines): GET /search endpoint with pagination
- `src/models/search-result.ts` — new file (85 lines): SearchResult type and query builder
- `src/middleware/validate.ts` — modified (45 lines): added query validation middleware
- `src/routes/index.ts` — modified (12 lines): registered /search route
- `src/__tests__/search.test.ts` — new file (180 lines): integration tests for search
- `src/__tests__/search-result.test.ts` — new file (95 lines): unit tests for SearchResult
- `package.json` — modified: added express-validator 7.0.1

## Diff Stat

```
7 files changed, 637 insertions(+), 8 deletions(-)
```

## Project Structure

```
src/
  routes/
    index.ts
    search.ts          ← new
    users.ts
  models/
    search-result.ts   ← new
    user.ts
  middleware/
    validate.ts
    auth.ts
  __tests__/
    search.test.ts     ← new
    search-result.test.ts ← new
    users.test.ts
package.json
```

## pr-prepare.js Output (JSON)

```json
{
  "mode": "create",
  "baseBranch": "main",
  "currentBranch": "feat/add-search-api",
  "isDraft": false,
  "existingPr": null,
  "jiraTicket": null,
  "commits": [
    { "subject": "feat(search): add search endpoint with pagination support", "body": "" },
    { "subject": "feat(search): implement SearchResult model and query builder", "body": "" },
    { "subject": "fix(search): handle empty query string gracefully", "body": "" },
    { "subject": "chore(search): add integration tests for search endpoint", "body": "" },
    { "subject": "chore(deps): add express-validator for input sanitization", "body": "" }
  ],
  "diffStat": "7 files changed, 637 insertions(+), 8 deletions(-)",
  "remoteState": "no-remote",
  "customTemplate": null,
  "warnings": [],
  "errors": []
}
```

## Project Config

- `package.json` version: 1.4.2
- No `.github/PULL_REQUEST_TEMPLATE.md`
- No `.claude/pr-template.md`
