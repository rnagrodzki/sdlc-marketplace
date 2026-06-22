# Project Context: ship-sdlc verify-openspec step (issue #441)

## Scenario A — verify-openspec configured and matched change exists

### Prepare Script Output (skill/ship.js)
```json
{
  "flags": {
    "steps": ["execute","commit","review","version","verify-openspec","archive-openspec","pr"],
    "auto": false,
    "bump": "patch",
    "workspace": "branch"
  },
  "context": {
    "openspecDetected": true,
    "openspec": { "branchMatch": "add-auth", "isAlreadyArchived": false }
  },
  "steps": [
    { "name": "execute",         "status": "will_run",  "skill": "execute-plan-sdlc", "model": "opus",   "dispatchMode": "agent", "args": "--plan-file /tmp/plan.md", "pause": true,  "isolation": null },
    { "name": "commit",          "status": "will_run",  "skill": "commit-sdlc",       "model": "haiku",  "dispatchMode": "agent", "args": "",        "pause": false, "isolation": null },
    { "name": "review",          "status": "will_run",  "skill": "review-sdlc",       "model": "sonnet", "dispatchMode": "agent", "args": "",        "pause": false, "isolation": null },
    { "name": "version",         "status": "will_run",  "skill": "version-sdlc",      "model": "sonnet", "dispatchMode": "agent", "args": "--bump patch", "pause": true, "isolation": null },
    { "name": "verify-openspec", "status": "will_run",  "skill": null,                "model": null,     "dispatchMode": null,    "args": "--change add-auth", "pause": true, "isolation": null, "reason": "openspec change \"add-auth\" ready for verify" },
    { "name": "archive-openspec","status": "conditional","skill": null,               "model": "haiku",  "dispatchMode": null,    "args": "--change add-auth", "pause": true, "isolation": null },
    { "name": "pr",              "status": "will_run",  "skill": "pr-sdlc",           "model": "sonnet", "dispatchMode": "agent", "args": "",        "pause": false, "isolation": null }
  ],
  "errors": [],
  "warnings": []
}
```

## Scenario B — verify-openspec NOT in steps (fallback text should appear)

### Prepare Script Output (skill/ship.js) — verify-openspec absent from steps
```json
{
  "flags": {
    "steps": ["execute","commit","review","version","archive-openspec","pr"],
    "auto": false,
    "bump": "patch",
    "workspace": "branch"
  },
  "context": {
    "openspecDetected": true,
    "openspec": { "branchMatch": "add-auth", "isAlreadyArchived": false }
  },
  "steps": [
    { "name": "execute",         "status": "will_run",    "skill": "execute-plan-sdlc", "model": "opus",   "dispatchMode": "agent", "args": "--plan-file /tmp/plan.md", "pause": true,  "isolation": null },
    { "name": "commit",          "status": "will_run",    "skill": "commit-sdlc",       "model": "haiku",  "dispatchMode": "agent", "args": "",        "pause": false, "isolation": null },
    { "name": "review",          "status": "will_run",    "skill": "review-sdlc",       "model": "sonnet", "dispatchMode": "agent", "args": "",        "pause": false, "isolation": null },
    { "name": "version",         "status": "will_run",    "skill": "version-sdlc",      "model": "sonnet", "dispatchMode": "agent", "args": "--bump patch", "pause": true, "isolation": null },
    { "name": "verify-openspec", "status": "skipped",     "skill": null,                "model": null,     "dispatchMode": null,    "args": "",        "pause": false, "isolation": null, "reason": "not in steps[]", "skipSource": "default" },
    { "name": "archive-openspec","status": "conditional", "skill": null,               "model": "haiku",  "dispatchMode": null,    "args": "--change add-auth", "pause": true, "isolation": null },
    { "name": "pr",              "status": "will_run",    "skill": "pr-sdlc",           "model": "sonnet", "dispatchMode": "agent", "args": "",        "pause": false, "isolation": null }
  ],
  "errors": [],
  "warnings": []
}
```
