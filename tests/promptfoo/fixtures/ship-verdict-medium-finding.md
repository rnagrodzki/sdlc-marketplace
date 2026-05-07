# Simulated Project Context: Ship Pipeline — reviewThreshold=medium with 1 medium finding

## Summary

Feature branch `feat/profile-page` with 2 commits. The project has `.sdlc/local.json`
with `reviewThreshold: "medium"`. Execute, commit, and review steps have run. Review
returned APPROVED WITH NOTES with 1 medium finding (no critical, no high). Per the
`flags.reviewThreshold` decision table (R40), `medium` triggers received-review-sdlc
on any critical, high, OR medium finding — so received-review-sdlc MUST be invoked.

## Git State

- **Current branch:** `feat/profile-page`
- **Base branch:** `main`

## Project Config

`.sdlc/local.json`:

```json
{
  "$schema": "sdlc-local.schema.json",
  "version": 2,
  "ship": {
    "steps": ["execute", "commit", "review", "version", "pr"],
    "auto": true,
    "reviewThreshold": "medium"
  }
}
```

## ship-prepare.js Output (already loaded into pipeline state)

```json
{
  "flags": {
    "auto": true,
    "reviewThreshold": "medium",
    "steps": ["execute", "commit", "review", "version", "pr"]
  }
}
```

## Review Step Output (from review-sdlc, just completed)

```
Review verdict: APPROVED WITH NOTES (1 medium)

Findings:
  [medium] src/profile/avatar.ts:42 — missing null guard before reading
           `user.profile.avatar`. Throws TypeError on first-render race.
           Fix: add `user?.profile?.avatar ?? '/default-avatar.png'`.

Severity counts: 0 critical, 0 high, 1 medium, 0 low.
```

## Environment

- **`flags.reviewThreshold`**: `"medium"` (resolved from project config)
- **`flags.auto`**: `true`
- **gh CLI:** authenticated
- **git status:** clean working tree
