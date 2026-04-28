# Code Review — feat/search-api

**Verdict:** CHANGES REQUESTED
**Scope:** Committed branch changes only
**Base branch:** main
**Findings:** 4 (1 critical, 1 high, 1 medium, 1 low)

## Summary

| Dimension | Severity | Findings |
|---|---|---|
| security-review | critical | 1 |
| security-review | high | 1 |
| code-quality-review | medium | 1 |
| api-review | low | 1 |

---

<details>
<summary>security-review (2 findings)</summary>

### CRITICAL — `src/auth/login.ts:42` — Plaintext password comparison

The login handler compares `req.body.password` against the stored hash using `===` instead of a constant-time bcrypt comparison. This leaks timing information and accepts the raw hash if an attacker can read it from the database.

**Fix:** Replace `user.passwordHash === req.body.password` with `await bcrypt.compare(req.body.password, user.passwordHash)`.

### HIGH — `src/auth/session.ts:88` — Session token has no expiry

`createSession()` issues a JWT without an `exp` claim, so tokens are valid forever once issued. Combined with no revocation list, a leaked token is permanent.

**Fix:** Add `expiresIn: '24h'` to the `jwt.sign()` options and document refresh-token rotation.

</details>

<details>
<summary>code-quality-review (1 finding)</summary>

### MEDIUM — `src/search/query.ts:120` — Unbounded recursion in nested filter parser

`parseFilter()` recurses into `filter.children` without a depth limit. A pathological 10-deep nested query crashes the worker with stack overflow.

**Fix:** Add a `MAX_FILTER_DEPTH = 8` guard and reject deeper queries with a 400 response.

</details>

<details>
<summary>api-review (1 finding)</summary>

### LOW — `src/api/search.ts:15` — Inconsistent response envelope

`/api/search` returns `{ results: [] }` while every other endpoint returns `{ data: [] }`. This breaks the SDK's response normalizer.

**Fix:** Rename `results` to `data` or add the field as an alias for one release before removing.

</details>

---

_Posted by `/review-sdlc` — 4 findings across 3 dimensions._
