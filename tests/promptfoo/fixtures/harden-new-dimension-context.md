# Failure Context — harden-sdlc invocation (new review dimension warranted)

## Failure Details
Calling skill:  review-sdlc
Step:           Step 5 — actionable findings
Operation:      self-fix offer
Failure text:   Review missed a class of bug entirely. A GraphQL resolver in `src/graphql/resolvers/payments.ts` performed an unbounded N+1 database fetch inside a list resolver, and NO existing review dimension covers GraphQL resolver patterns. The codebase recently adopted GraphQL (12 resolver files under `src/graphql/resolvers/`) but the review configuration predates that adoption — there is no dimension whose triggers match `src/graphql/**`, so the pattern slipped through unreviewed.

## Loaded Surfaces
plan.guardrails: 17 entries
execute.guardrails: 10 entries
review.dimensions:
  - script-resolution (high): "Reviews find-based script resolution and Glob-based reference lookup patterns in commands and skills."
  - runtime-contract (high)
  - skill-architecture (medium)
  (none of the existing dimensions have triggers matching `src/graphql/**`)
copilot.instructions: 6 entries (one per existing dimension; no graphql mirror exists)

## Hardening Signal
The failure class is uncovered: no existing review dimension targets GraphQL resolver files. The appropriate hardening action is to ADD a NEW review dimension (e.g. `graphql-resolver-review`) under `.sdlc/review-dimensions/` whose triggers match `src/graphql/resolvers/**`, with a checklist covering N+1 fetches, missing dataloader batching, and unbounded list resolvers. Because a NEW review-dimension file is created, its matching `.github/instructions/graphql-resolver-review.instructions.md` Copilot mirror must be generated and written in the same approved write step (R-copilot-mirror, #456).
