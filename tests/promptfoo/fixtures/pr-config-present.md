# Simulated Project Context: PR with Config Constraints

## Git State

- **Current branch:** `feat/add-api-caching`
- **Base branch:** `main`
- **Remote state:** branch exists on origin

## Commit Log (3 commits since main)

```
abc1234 feat(api): add Redis-based response caching
def5678 feat(api): implement cache invalidation strategy
ghi9012 chore(api): add cache integration tests
```

## Diff Summary

**Files changed:** 5

- `src/cache/redis.ts` — new file (120 lines): Redis cache implementation
- `src/middleware/cache.ts` — new file (80 lines): cache middleware
- `src/api/routes.ts` — modified (35 lines): integrated caching
- `src/__tests__/cache.test.ts` — new file (150 lines): cache integration tests
- `package.json` — modified: added redis@4.6.0

## Diff Stat

```
5 files changed, 385 insertions(+), 10 deletions(-)
```

## pr-prepare.js Output (JSON)

```json
{
  "mode": "create",
  "baseBranch": "main",
  "currentBranch": "feat/add-api-caching",
  "isDraft": false,
  "existingPr": null,
  "jiraTicket": null,
  "commits": [
    { "subject": "feat(api): add Redis-based response caching", "body": "" },
    { "subject": "feat(api): implement cache invalidation strategy", "body": "" },
    { "subject": "chore(api): add cache integration tests", "body": "" }
  ],
  "diffStat": "5 files changed, 385 insertions(+), 10 deletions(-)",
  "remoteState": "exists",
  "customTemplate": null,
  "prConfig": {
    "titlePattern": "^(feat|fix|chore|refactor|docs)(\\([a-z-]+\\))?:",
    "titlePatternError": "Title must start with a valid type (feat, fix, chore, refactor, docs) optionally followed by a scope in parentheses",
    "allowedTypes": ["feat", "fix", "chore", "refactor", "docs"],
    "allowedScopes": ["api", "auth", "db"]
  },
  "warnings": [],
  "errors": []
}
```

## Project Config (.claude/sdlc.json)

```json
{
  "pr": {
    "titlePattern": "^(feat|fix|chore|refactor|docs)(\\([a-z-]+\\))?:",
    "allowedTypes": ["feat", "fix", "chore", "refactor", "docs"],
    "allowedScopes": ["api", "auth", "db"]
  }
}
```

## PR Details

- **Type:** feat
- **Scope:** api
- **Title:** feat(api): add Redis-based response caching
- **Pattern match required:** Yes
