# Simulated Project Context: Ship Pipeline — Config File Present

## Summary

Feature branch `feat/auth-flow` with 3 commits. The project has ship config in `.sdlc/local.json`
with preset: B, skip: [version], and bump: patch. gh CLI authenticated.

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

## Config File

`.sdlc/local.json` ship section contents:

```json
{
  "$schema": "https://raw.githubusercontent.com/rnagrodzki/sdlc-marketplace/main/schemas/sdlc-local.schema.json",
  "ship": {
    "preset": "balanced",
    "skip": ["version"],
    "bump": "patch",
    "draft": false,
    "reviewThreshold": "high",
    "workspace": "worktree"
  }
}
```

## Environment

- **gh CLI:** authenticated as `dev-user`
- **git status:** clean working tree (all changes committed)
- **Review dimensions:** configured in `.claude/review-dimensions/`
  - security.md, performance.md, correctness.md
- **Plan in context:** yes (from conversation)

## Project Config

- `package.json` version: 2.1.0
- No `.github/PULL_REQUEST_TEMPLATE.md`
- `.sdlc/local.json` present (ship section configured, see above)
