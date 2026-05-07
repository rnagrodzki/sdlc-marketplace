# Failure Context — harden-sdlc invocation

## Failure Details
Calling skill:  plan-sdlc
Step:           Step 4 — IMPROVE (error-severity guardrail block)
Operation:      error-severity guardrail evaluation
Failure text:   Guardrail `no-auto-eval` (severity: error) failed. Plan task 7 invokes the full-suite `promptfoo eval` directly in its bash block, which is forbidden by the no-auto-eval guardrail (full-suite or wide-subset eval runs remain user-initiated only; only a single targeted test scoped to the change is allowed).
Exit code:     —
Error type:     —
User intent:    Author an implementation plan for a new test runner skill

## Loaded Surfaces (preview from harden-prepare.js)
plan.guardrails:
  - no-auto-eval (error): "Full-suite or wide-subset `promptfoo eval` runs remain user-initiated only. A single targeted test case scoped to the changed surface MAY be run as the final verification step. Exec-only configs (no LLM provider) are fully relaxed. Tight-loop retries (run-fix-rerun) are forbidden in all cases."
  - test-coverage-required (error): "Every task that creates or modifies source code must include corresponding promptfoo test cases."
  - skill-docs-required (error): "Any task that creates `plugins/*/skills/*/SKILL.md` must include matching entries for all four companion artifacts."
execute.guardrails: 10 entries
review.dimensions: 13 entries (script-resolution, runtime-contract, ...)
copilot.instructions: 6 entries
error-report-skill: resolved
