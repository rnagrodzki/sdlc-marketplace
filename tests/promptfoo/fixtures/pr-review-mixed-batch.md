# PR Review Feedback (Mixed Batch)

## Pull Request
PR #42: feat(search): add full-text search API
Branch: feat/search-api → main
Repository: acme/search-api

## Review Comments

### Comment 1 — Bug (will fix)
File: src/routes/search.ts, Line 67
Reviewer: reviewer-1
Comment: "The search function doesn't handle pagination correctly. When offset exceeds total results, it returns an empty array instead of an error."
Context: This is a confirmed bug. The function should return a 400 or 416 error when offset exceeds the total result count.

### Comment 2 — Improvement (will fix)
File: src/middleware/logging.ts, Line 12
Reviewer: reviewer-1
Comment: "Add request ID to all log statements for traceability. Currently logs don't include correlation IDs."
Context: Valid request. The middleware already generates a request ID but doesn't attach it to log output.

### Comment 3 — Disagreement (pushback)
File: src/services/tokenizer.ts, Line 25
Reviewer: reviewer-2
Comment: "The tokenizer should use the Porter stemming algorithm instead of the current approach. The current stemming is too aggressive."
Context: The aggressive stemming is intentional for recall optimization. Proper nouns are handled by the exact-match fallback path. The reviewer's suggestion would reduce recall by ~15%. Will push back with data.

### Comment 4 — Acknowledged, won't fix
File: src/routes/search.ts, Line 90
Reviewer: reviewer-2
Comment: "Consider extracting the retry logic into a shared utility. It's duplicated in 3 places."
Context: Valid observation but out of scope for this PR. The duplication exists in search.ts, users.ts, and indexer.ts. This should be a separate refactoring PR.

## Prepare Script Manifest

The received-review-prepare.js script has been executed and produced the following manifest:

```json
{
  "pr": { "number": 42, "owner": "acme", "repo": "search-api" },
  "threads": [
    { "id": 5, "status": "outstanding", "file": "src/routes/search.ts", "line": 67, "body": "The search function doesn't handle pagination correctly. When offset exceeds total results, it returns an empty array instead of an error.", "author": "reviewer-1" },
    { "id": 6, "status": "outstanding", "file": "src/middleware/logging.ts", "line": 12, "body": "Add request ID to all log statements for traceability. Currently logs don't include correlation IDs.", "author": "reviewer-1" },
    { "id": 7, "status": "outstanding", "file": "src/services/tokenizer.ts", "line": 25, "body": "The tokenizer should use the Porter stemming algorithm instead of the current approach. The current stemming is too aggressive.", "author": "reviewer-2" },
    { "id": 8, "status": "outstanding", "file": "src/routes/search.ts", "line": 90, "body": "Consider extracting the retry logic into a shared utility. It's duplicated in 3 places.", "author": "reviewer-2" }
  ],
  "summary": { "total": 4, "resolved": 0, "self_replied": 0, "stale": 0, "outstanding": 4 }
}
```

## Context
All 4 threads are outstanding. Expected response verdicts: Comment 1 (will fix — bug), Comment 2 (will fix — improvement), Comment 3 (disagree — pushback with reasoning), Comment 4 (acknowledge, won't fix — out of scope).
