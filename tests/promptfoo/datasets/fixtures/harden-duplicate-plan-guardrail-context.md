# Harden Context: Duplicate Plan Guardrail — Consolidation

## Project Context

This project has an existing plan guardrail in `.sdlc/config.json`:

```json
{
  "plan": {
    "guardrails": [
      {
        "id": "no-bare-cwd",
        "description": "Avoid bare process.cwd() in scripts — always route through resolveSdlcRoot().",
        "severity": "error"
      }
    ]
  }
}
```

## Failure Context

```
Skill: plan-sdlc
Step: Step 3 — CRITIQUE
Operation: error-severity guardrail evaluation
Exit Code: 0
Error Type: CLI failure

Failure Text:
Plan task T3 modifies scripts/lib/foo.js to add a new resolver. The implementation
snippet includes `const root = process.cwd()` at line 47. This is a direct violation
of the cwd-safety pattern — scripts must use resolveSdlcRoot() for project root
resolution. The plan was approved but the task description does not enforce this
constraint at the task level.
```

## Existing Guardrail Signal

The plan already has `no-bare-cwd` in `plan.guardrails`. The failure is from the same
class of issue (bare `process.cwd()` usage in scripts). The orchestrator should detect
overlap and emit `action: "consolidate"` targeting `no-bare-cwd`, NOT `action: "add"`.
