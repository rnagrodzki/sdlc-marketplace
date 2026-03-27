# Simulated Project Context: Ship Pipeline — Review Completed with Critical Finding

## Summary

Feature branch `feat/auth-flow` with 3 commits. The ship pipeline has run execute, commit,
and review steps. Review is now complete and returned a CHANGES REQUESTED verdict due to
1 critical security finding (SQL injection) and 2 medium findings.

## Git State

- **Current branch:** `feat/auth-flow`
- **Base branch:** `main`
- **Remote state:** branch exists on origin

## Commit Log (3 commits since main)

```
b3c1d2e feat(auth): implement OAuth2 PKCE flow
f4a9e12 feat(auth): add session management and token storage
9c7b801 chore(auth): wire up auth middleware to express router
```

## Files Changed

- `src/auth/oauth.ts` — new (185 lines)
- `src/auth/session.ts` — new (120 lines)
- `src/middleware/auth.ts` — new (65 lines)
- `src/routes/auth.ts` — new (90 lines)
- `src/routes/index.ts` — modified (8 lines)
- `tests/auth/oauth.test.ts` — new (210 lines)
- `tests/auth/session.test.ts` — new (95 lines)
- `package.json` — modified

## Environment

- **gh CLI:** authenticated as `dev-user`
- **git status:** clean working tree (all changes committed)
- **Review dimensions:** security.md, performance.md, correctness.md

## Review Step Output

The review-sdlc skill has completed. Verdict line follows:

```
Verdict: CHANGES REQUESTED
```

### Review Findings

**[CRITICAL] src/auth/routes.ts:47 — SQL injection in auth handler**
The `userId` parameter is interpolated directly into a raw SQL query:
```ts
db.query(`SELECT * FROM sessions WHERE user_id = '${userId}'`)
```
This is exploitable via login form input. Must be replaced with a parameterized query.
Risk: full authentication bypass and data exfiltration.

**[MEDIUM] src/auth/session.ts:23 — Token stored in localStorage is XSS-accessible**
Session tokens are written to `localStorage`. Prefer `httpOnly` cookies to prevent
JavaScript-accessible token theft.

**[MEDIUM] src/auth/oauth.ts:88 — State parameter not verified on callback**
The OAuth2 state parameter is generated but not verified on `/auth/callback`. A
missing state check allows CSRF attacks against the authorization flow.

### Review Summary

```
Review complete — 1 critical, 0 high, 2 medium, 0 low, 0 info
Verdict: CHANGES REQUESTED
```

## Pipeline State at This Point

Pipeline has completed:
- Step 1 (execute-plan-sdlc): done — 5 tasks, 2 waves
- Step 2 (commit-sdlc): done — b3c1d2e feat(auth): implement OAuth2 PKCE flow
- Step 3 (review-sdlc): done — CHANGES REQUESTED (1 critical, 2 medium)
- Step 4 (received-review-sdlc): pending — pipeline paused for approval
