# Ship — commitWaves forwarding (Fixes #392 / R35)

## .sdlc/local.json

```json
{
  "$schema": "sdlc-local.schema.json",
  "schemaVersion": 4,
  "ship": {
    "steps": ["execute", "commit", "pr"],
    "bump": "patch",
    "auto": false,
    "execute": {
      "commitWaves": true
    }
  }
}
```

## scripts/skill/ship.js prepare output (steps[].invocation excerpt)

```json
{
  "flags": {
    "executeCommitWaves": true,
    "quality": null,
    "workspace": "prompt",
    "rebase": "auto"
  },
  "steps": [
    {
      "name": "execute",
      "skill": "execute-plan-sdlc",
      "status": "will_run",
      "args": "--commit-waves",
      "invocation": "execute-plan-sdlc --commit-waves"
    },
    { "name": "commit", "skill": "commit-sdlc", "status": "will_run", "args": "" },
    { "name": "pr",     "skill": "pr-sdlc",     "status": "will_run", "args": "" }
  ]
}
```

## Question

Walk through what ship-sdlc shows the user when the pipeline plan is rendered. Specifically:
- Does the execute step's invocation include `--commit-waves`?
- How does ship-sdlc SKILL.md cite this — does it read `config.execute.commitWaves` directly, or
  does it cite `step.invocation`?
