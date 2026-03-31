# Simulated Project Context: Commit with Config Constraints

## Git State

- **Current branch:** `feat/add-logging`
- **Base branch:** `main`
- **Staged changes:** 3 files modified

## Staged Diff

```
M src/logger/index.ts     (45 lines)
M src/utils/logging.ts    (28 lines)
M tests/logger.test.ts    (52 lines)
```

## Diff Stat

```
3 files changed, 125 insertions(+), 0 deletions(-)
```

## commit-prepare.js Output (JSON)

```json
{
  "mode": "commit",
  "stagedFiles": [
    "src/logger/index.ts",
    "src/utils/logging.ts",
    "tests/logger.test.ts"
  ],
  "commitConfig": {
    "subjectPattern": "^(feat|fix|chore|refactor|docs)(\\([a-z-]+\\))?:",
    "subjectPatternError": "Subject must start with a valid type (feat, fix, chore, refactor, docs) optionally followed by a scope in parentheses",
    "allowedTypes": ["feat", "fix", "chore", "refactor", "docs"],
    "allowedScopes": ["logger", "utils", "api"],
    "requireBodyFor": ["feat"],
    "requiredTrailers": ["Reviewed-by"]
  },
  "flags": {
    "auto": false
  },
  "warnings": [],
  "errors": []
}
```

## Project Config (.claude/sdlc.json)

```json
{
  "commit": {
    "subjectPattern": "^(feat|fix|chore|refactor|docs)(\\([a-z-]+\\))?:",
    "allowedTypes": ["feat", "fix", "chore", "refactor", "docs"],
    "allowedScopes": ["logger", "utils", "api"],
    "requireBodyFor": ["feat"],
    "requiredTrailers": ["Reviewed-by"]
  }
}
```

## Commit Details

- **Type:** feat
- **Scope:** logger
- **Subject:** add structured logging with Winston integration
- **Body Required:** Yes (type is `feat`)
- **Trailer Required:** Reviewed-by
