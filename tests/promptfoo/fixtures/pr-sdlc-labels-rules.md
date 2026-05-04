# Simulated Project Context: PR Labels — Rules Mode (issue #197)

## Git State

- **Current branch:** `fix/null-pointer-in-cart`
- **Base branch:** `main`
- **Remote state:** branch does not exist on origin yet (needs push)

## Commit Log (2 commits since main)

```
aaa1111 fix(cart): guard against null product in line item
bbb2222 fix(cart): add regression test for null-product crash
```

No JIRA tickets referenced in branch name or commit subjects.

## Diff Summary

**Files changed:** 2

- `src/cart/line-item.ts` — modified (12 lines): null-check before reading product fields
- `src/cart/__tests__/line-item.test.ts` — modified (28 lines): new regression test

## Diff Stat

```
2 files changed, 40 insertions(+), 4 deletions(-)
```

## Project Config — `.claude/sdlc.json`

```json
{
  "pr": {
    "labels": {
      "mode": "rules",
      "rules": [
        { "label": "bug", "when": { "branchPrefix": ["fix/", "bugfix/"] } },
        { "label": "feature", "when": { "commitType": ["feat"] } },
        { "label": "documentation", "when": { "pathGlob": ["**/*.md"] } },
        { "label": "small-change", "when": { "diffSizeUnder": 50 } }
      ]
    }
  }
}
```

## pr-prepare.js Output (PR_CONTEXT_JSON)

```json
{
  "mode": "create",
  "baseBranch": "main",
  "currentBranch": "fix/null-pointer-in-cart",
  "isDraft": false,
  "isAuto": false,
  "existingPr": null,
  "jiraTicket": null,
  "customTemplate": null,
  "prConfig": {
    "labels": {
      "mode": "rules",
      "rules": [
        { "label": "bug", "when": { "branchPrefix": ["fix/", "bugfix/"] } },
        { "label": "feature", "when": { "commitType": ["feat"] } },
        { "label": "documentation", "when": { "pathGlob": ["**/*.md"] } },
        { "label": "small-change", "when": { "diffSizeUnder": 50 } }
      ]
    }
  },
  "commits": [
    { "subject": "fix(cart): guard against null product in line item", "body": "" },
    { "subject": "fix(cart): add regression test for null-product crash", "body": "" }
  ],
  "changedFiles": [
    "src/cart/line-item.ts",
    "src/cart/__tests__/line-item.test.ts"
  ],
  "diffStat": { "files": 2, "insertions": 40, "deletions": 4, "totalLinesChanged": 44 },
  "repoLabels": [
    { "name": "bug", "description": "Defect fix" },
    { "name": "feature", "description": "New capability" },
    { "name": "documentation", "description": "Docs only" },
    { "name": "small-change", "description": "Tiny diff, fast review" },
    { "name": "needs-review", "description": "Awaiting review" }
  ],
  "forcedLabels": [],
  "remoteState": "no-remote",
  "warnings": [],
  "errors": []
}
```

## Expected Label Evaluation

Under `mode = "rules"`:

- Rule 1 (`branchPrefix: ["fix/", "bugfix/"]` → `bug`): MATCHES — branch starts with `fix/`
- Rule 2 (`commitType: ["feat"]` → `feature`): NO MATCH — both commit subjects begin with `fix(...)`
- Rule 3 (`pathGlob: ["**/*.md"]` → `documentation`): NO MATCH — `.ts` files are not all-markdown
- Rule 4 (`diffSizeUnder: 50` → `small-change`): MATCHES — 44 < 50

Final `suggestedLabels`: `[ bug (rule), small-change (rule) ]`. No fabrication, no `feature` or `documentation`.
