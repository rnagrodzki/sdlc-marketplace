# Harden Context: Review Dimension Priority Ordering

## Project Context

This project has both plan guardrails and a gap in review-dimension coverage:

```json
{
  "plan": {
    "guardrails": [
      {
        "id": "spec-first",
        "description": "Changes must have a spec before code.",
        "severity": "error"
      }
    ]
  }
}
```

The project has no review dimension for YAML configuration files.

## Failure Context

```
Skill: review-sdlc
Step: Step 5 — REVIEW
Operation: actionable findings
Exit Code: 0
Error Type: CLI failure

Failure Text:
Review passed with no blockers, but a regression appeared post-merge in
infrastructure/db-config.yaml — the file was modified but no review dimension
covers YAML config files. Additionally, the plan guardrail for spec-first is
too vague: it does not specify that specs must be in docs/specs/ or that the
spec file must reference the issue number. Both gaps contributed to the regression.
```

## Expected Orchestrator Behavior

The orchestrator should:
1. Propose a new `review-dimensions` entry for YAML config files
2. Propose strengthening the `spec-first` plan guardrail

**Critically**, the `review-dimensions` proposal must appear FIRST in `proposals[]`
per R14 ordering — even though the `plan-guardrails` signal may seem more specific.
The envelope must contain the review-dimensions proposal before any plan-guardrails
proposal in the JSON array.
