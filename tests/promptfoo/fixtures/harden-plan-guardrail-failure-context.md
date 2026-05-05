# Failure Context — harden-sdlc invocation

## Failure Details
Calling skill:  plan-sdlc
Step:           Step 4 — IMPROVE (error-severity guardrail block)
Operation:      error-severity guardrail evaluation
Failure text:   Guardrail `no-auto-eval` (severity: error) failed. Plan task 7 invokes `promptfoo eval` directly in its bash block, which is forbidden by the no-auto-eval guardrail (evaluation runs are user-initiated only).
Exit code:     —
Error type:     —
User intent:    Author an implementation plan for a new test runner skill

## Loaded Surfaces (preview from harden-prepare.js)
plan.guardrails:
  - no-auto-eval (error): "Plans must never include steps that run promptfoo eval — evaluation runs are user-initiated only."
  - test-coverage-required (error): "Every task that creates or modifies source code must include corresponding promptfoo test cases."
  - skill-docs-required (error): "Any task that creates `plugins/*/skills/*/SKILL.md` must include matching entries for all four companion artifacts."
execute.guardrails: 10 entries
review.dimensions: 13 entries (script-resolution, runtime-contract, ...)
copilot.instructions: 6 entries
error-report-skill: resolved
