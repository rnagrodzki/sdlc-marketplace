# PR Review Feedback

## Pull Request
PR #42: feat(search): add full-text search API
Branch: feature/add-search → main
Repository: user/my-project

## Review Comments

### Comment 1 — Bug (confirmed)
File: src/routes/search.ts, Line 45
Reviewer: alice
Comment: "The null check here is wrong — `if (query)` will pass for empty strings. Should be `if (query !== null && query !== undefined)`."
Context: The function receives `query` from request params which can be an empty string.
Actual code at line 45: `if (query) { return searchIndex(query); }`

### Comment 2 — Style suggestion
File: src/models/search.ts, Line 12
Reviewer: alice
Comment: "Rename `res` to `searchResults` for clarity."
Context: Variable declaration `const res = await db.query(sql);`
Actual code at line 12: `const res = await db.query(sql);`

### Comment 3 — Incorrect claim
File: src/utils/tokenizer.ts, Line 8
Reviewer: bob
Comment: "This tokenize function is unused — should be removed."
Context: The function IS used. It is imported in src/routes/search.ts (line 3) and src/services/indexer.ts (line 7).
Actual code at line 8: `export function tokenize(text: string): string[] {`
Grep results for "tokenize":
  src/routes/search.ts:3: import { tokenize } from '../utils/tokenizer';
  src/services/indexer.ts:7: import { tokenize } from '../utils/tokenizer';
