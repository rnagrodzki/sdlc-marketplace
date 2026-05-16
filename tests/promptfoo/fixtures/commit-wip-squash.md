# Commit — WIP squash path (Fixes #392 / R35)

## Branch state

Current branch: `feat/auth-rewrite` (forked from `main` at sha `abcd123`).

Commits since fork-point:
```
0001aaa wip(execute): wave 1 — Create TokenValidator class
0002bbb wip(execute): wave 2 — Wire TokenValidator into auth middleware
```

User has no staged changes on top.

## commit.js prepare output (wipSquash field)

```json
{
  "wipSquash": {
    "commits": ["0002bbb...", "0001aaa..."],
    "stagedClean": true
  },
  "flags": {
    "noSquashWip": false,
    "auto": false
  }
}
```

## Question

Walk through Step 1c (WIP-commit squash detection) of commit-sdlc. Show the bash commands run,
explain the soft-reset mechanic, and confirm whether the orchestrator in Step 2 will be allowed
to generate a subject starting with `wip:` for the final commit.
