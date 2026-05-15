# PR Review Feedback — with reply_footer context (#363)

## Manifest (from received-review.js prepare script)

```json
{
  "version": 1,
  "pr": { "number": 42, "owner": "user", "repo": "my-project" },
  "plugin_version": "0.20.7",
  "reply_footer": "\n\n_via `received-review-sdlc` v0.20.7_",
  "flags": { "auto": false, "alwaysFixSeverities": [] },
  "threads": [
    {
      "databaseId": 1001,
      "threadId": "PRRT_aaa",
      "status": "outstanding",
      "severity": "high",
      "body": "The null check here is wrong — `if (query)` will pass for empty strings. Should be `if (query !== null && query !== undefined)`.",
      "author": "alice",
      "file": "src/routes/search.ts",
      "line": 45
    },
    {
      "databaseId": 1002,
      "threadId": "PRRT_bbb",
      "status": "outstanding",
      "severity": null,
      "body": "This tokenize function is unused — should be removed.",
      "author": "bob",
      "file": "src/utils/tokenizer.ts",
      "line": 8
    }
  ],
  "summary": {
    "outstanding": 2,
    "resolved": 0,
    "selfReplied": 0,
    "stale": 0
  }
}
```

## Pull Request
PR #42: feat(search): add full-text search API
Branch: feature/add-search → main
Repository: user/my-project

## Review Threads

### Thread 1 — Bug (outstanding)
File: src/routes/search.ts, Line 45
Reviewer: alice
Comment: "The null check here is wrong — `if (query)` will pass for empty strings. Should be `if (query !== null && query !== undefined)`."
Comment ID (databaseId): 1001

### Thread 2 — Incorrect claim (outstanding)
File: src/utils/tokenizer.ts, Line 8
Reviewer: bob
Comment: "This tokenize function is unused — should be removed."
The function IS used: imported in src/routes/search.ts:3 and src/services/indexer.ts:7.
Comment ID (databaseId): 1002
