# Harden Context: Duplicate Execute Guardrail — Consolidation

## Project Context

This project has an existing execute guardrail in `.sdlc/config.json`:

```json
{
  "execute": {
    "guardrails": [
      {
        "id": "no-scope-creep",
        "description": "Implementation must stay within the task's stated scope — no additional features, refactoring, or cleanup beyond what was specified.",
        "severity": "warning"
      }
    ]
  }
}
```

## Failure Context

```
Skill: execute-plan-sdlc
Step: 5c-ter
Operation: post-wave guardrail evaluation
Exit Code: 0
Error Type: CLI failure

Failure Text:
Wave 2 completed but the agent added an unspecified helper function extractContextKey()
to lib/context.js that was not mentioned in the task description. The task was scoped
to modifying only the run() function. This out-of-scope addition introduces untested
code paths and scope creep beyond what the plan authorized.
```

## Existing Guardrail Signal

The project has `no-scope-creep` in `execute.guardrails`. The failure is directly
related to scope creep. The orchestrator should detect the description overlap and
emit `action: "consolidate"` targeting `no-scope-creep` with a tighter description,
NOT `action: "add"` (which would create a second scope-related guardrail).
