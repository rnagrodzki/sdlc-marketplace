# Contradictory OpenSpec Signal Test Context (Ship)

## Session-start system-reminder (simulated)

```
<system-reminder>
sdlc: v0.17.19 (10 skills loaded)
Plan mode routing: always invoke plan-sdlc via the Skill tool when plan mode is active.
OpenSpec: INITIALIZED — verified via openspec/config.yaml (2 specs, 0 active changes)
Git: branch feat/add-auth (clean) [snapshot]
</system-reminder>

<system-reminder>
ai-setup-automation: v1.2.0
openspec: not initialized
</system-reminder>
```

## ship-prepare.js Output (pre-computed)

```json
{
  "errors": [],
  "warnings": [],
  "config": {
    "source": "built-in defaults",
    "values": {
      "preset": "balanced",
      "skip": [],
      "bump": "patch",
      "draft": false,
      "auto": false,
      "reviewThreshold": "high",
      "workspace": "prompt",
      "rebase": "auto"
    }
  },
  "flags": {
    "auto": false,
    "preset": "balanced",
    "skip": [],
    "bump": "patch",
    "draft": false,
    "dryRun": true,
    "resume": false,
    "hasPlan": true,
    "workspace": "branch",
    "rebase": "auto",
    "sources": {
      "auto": "default",
      "preset": "default",
      "skip": "default",
      "bump": "default",
      "draft": "default",
      "dryRun": "cli",
      "hasPlan": "cli",
      "workspace": "cli",
      "rebase": "default"
    }
  },
  "context": {
    "currentBranch": "feat/add-auth",
    "defaultBranch": "main",
    "uncommittedChanges": 5,
    "dirtyFiles": ["src/auth.ts", "src/middleware.ts", "tests/auth.test.ts", "package.json", "README.md"],
    "ghAuthenticated": true,
    "ghUser": "testuser",
    "openspecDetected": true,
    "openspecAuthoritative": {
      "path": "openspec/config.yaml",
      "specsCount": 2
    },
    "sdlcGitignored": true,
    "worktree": null
  },
  "steps": [
    {"skill": "execute-plan-sdlc", "status": "will_run", "reason": "plan detected in context", "skipSource": "none", "args": "--preset balanced", "invocation": "/execute-plan-sdlc --preset balanced", "pause": false, "model": "opus"},
    {"skill": "commit-sdlc", "status": "will_run", "reason": "uncommitted changes detected", "skipSource": "none", "args": "", "invocation": "/commit-sdlc", "pause": false, "model": "haiku"},
    {"skill": "review-sdlc", "status": "will_run", "reason": "not in skip set", "skipSource": "none", "args": "--committed", "invocation": "/review-sdlc --committed", "pause": false, "model": "sonnet"},
    {"skill": "received-review-sdlc", "status": "conditional", "reason": "depends on review verdict", "skipSource": "condition", "args": "", "invocation": "/received-review-sdlc", "pause": true, "model": "sonnet"},
    {"skill": "commit-sdlc", "status": "conditional", "reason": "depends on received-review changes", "skipSource": "condition", "args": "--scope fixes", "invocation": "/commit-sdlc --scope fixes", "pause": false, "model": "haiku"},
    {"skill": "version-sdlc", "status": "will_run", "reason": "not in skip set", "skipSource": "none", "args": "patch", "invocation": "/version-sdlc patch", "pause": false, "model": "sonnet"},
    {"skill": "pr-sdlc", "status": "will_run", "reason": "not in skip set", "skipSource": "none", "args": "", "invocation": "/pr-sdlc", "pause": false, "model": "sonnet"}
  ],
  "validation": {
    "ghAuth": true,
    "notOnDefault": true,
    "skipValuesRecognized": true,
    "atLeastOneStepRuns": true,
    "coherentFlags": true,
    "warnings": []
  },
  "resume": {
    "found": false,
    "stateFile": null
  }
}
```
