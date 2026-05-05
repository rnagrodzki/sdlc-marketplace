# Failure Context — harden-sdlc invocation (review-sdlc dimension blocker)

## Failure Details
Calling skill:  review-sdlc
Step:           Step 5 — actionable findings
Operation:      self-fix offer
Failure text:   Review verdict CHANGES REQUESTED. Dimension `script-resolution` flagged a CRITICAL blocker — find pattern in skills/foo-sdlc/SKILL.md:42 lacks the `-path "*/sdlc*/scripts/*"` filter, allowing other plugins' scripts to match unexpectedly.

## Loaded Surfaces
plan.guardrails: 17 entries
execute.guardrails: 10 entries
review.dimensions:
  - script-resolution (high): "Reviews find-based script resolution and Glob-based reference lookup patterns in commands and skills for runtime correctness across installed and development contexts."
  - runtime-contract (high)
  - skill-architecture (medium)
  - ...
copilot.instructions: 6 entries
