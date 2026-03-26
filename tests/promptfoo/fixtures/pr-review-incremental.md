# PR Review Feedback (Incremental Re-run)

## Pull Request
PR #42: feat(search): add full-text search API
Branch: feature/add-search → main
Repository: user/my-project

## Prepare Script Manifest

The received-review-prepare.js script has been executed and produced the following manifest:

```json
{
  "version": 1,
  "pr": { "number": 42, "owner": "user", "repo": "my-project" },
  "currentUser": "assistant-bot",
  "threads": [
    {
      "id": "PRRT_thread1",
      "status": "resolved",
      "path": "src/routes/search.ts",
      "line": 45,
      "isResolved": true,
      "isOutdated": false,
      "firstComment": {
        "id": "IC_1001",
        "databaseId": 1001,
        "body": "The null check here is wrong — `if (query)` will pass for empty strings.",
        "authorLogin": "alice",
        "createdAt": "2026-03-25T10:00:00Z"
      },
      "replyCount": 1,
      "hasUserReply": true,
      "allComments": []
    },
    {
      "id": "PRRT_thread2",
      "status": "resolved",
      "path": "src/models/search.ts",
      "line": 12,
      "isResolved": true,
      "isOutdated": false,
      "firstComment": {
        "id": "IC_1002",
        "databaseId": 1002,
        "body": "Rename `res` to `searchResults` for clarity.",
        "authorLogin": "alice",
        "createdAt": "2026-03-25T10:01:00Z"
      },
      "replyCount": 1,
      "hasUserReply": true,
      "allComments": []
    },
    {
      "id": "PRRT_thread3",
      "status": "self-replied",
      "path": "src/utils/tokenizer.ts",
      "line": 8,
      "isResolved": false,
      "isOutdated": false,
      "firstComment": {
        "id": "IC_1003",
        "databaseId": 1003,
        "body": "This tokenize function is unused — should be removed.",
        "authorLogin": "bob",
        "createdAt": "2026-03-25T10:02:00Z"
      },
      "replyCount": 1,
      "hasUserReply": true,
      "allComments": []
    },
    {
      "id": "PRRT_thread4",
      "status": "outstanding",
      "path": "src/routes/search.ts",
      "line": 78,
      "isResolved": false,
      "isOutdated": false,
      "firstComment": {
        "id": "IC_1004",
        "databaseId": 1004,
        "body": "This endpoint should validate the `limit` parameter — negative values will cause a database error.",
        "authorLogin": "alice",
        "createdAt": "2026-03-25T14:00:00Z"
      },
      "replyCount": 0,
      "hasUserReply": false,
      "allComments": []
    },
    {
      "id": "PRRT_thread5",
      "status": "outstanding",
      "path": "src/services/indexer.ts",
      "line": 23,
      "isResolved": false,
      "isOutdated": false,
      "firstComment": {
        "id": "IC_1005",
        "databaseId": 1005,
        "body": "The batch size of 1000 might be too large for the production database. Consider making it configurable.",
        "authorLogin": "carol",
        "createdAt": "2026-03-25T14:05:00Z"
      },
      "replyCount": 0,
      "hasUserReply": false,
      "allComments": []
    }
  ],
  "summary": {
    "total": 5,
    "outstanding": 2,
    "resolved": 2,
    "selfReplied": 1,
    "stale": 0
  }
}
```

## Context
The first run addressed comments 1-3. This is a re-run that should only process the 2 outstanding comments (#4 and #5).
