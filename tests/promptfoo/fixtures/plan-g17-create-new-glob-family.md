# G17 Fixture: CREATE — New Glob Family (C2)

## Context

A plan adds 4 new files under `packages/payments/**` — a path prefix not covered by any existing dimension.

## Plan file (excerpt)

```markdown
### Task 1: Implement payment processor module

**Files:**
- Create: packages/payments/processor.ts
- Create: packages/payments/processor.test.ts
- Create: packages/payments/types.ts
- Create: packages/payments/index.ts

**Description:** Add a new Stripe payment processor module with TypeScript types and unit tests. No behavior change to existing code — new module only.
```

## Dimension catalog (`.sdlc/review-dimensions/`)

```
typescript-quality.md  — triggers: ["src/**/*.ts", "src/**/*.tsx"]
testing-coverage.md    — triggers: ["src/**/*.test.ts", "tests/**"]
```

Neither dimension covers `packages/payments/**`.

## Learnings log (`.sdlc/learnings/log.md`)

No recent `harden-sdlc` entries.

## Expected G17 output

G17 should fire **C2** (3+ new files share common prefix `packages/payments/` not covered by any dimension).

Expected finding:
- `kind`: `CREATE`
- `dimension`: `payments-processing` (or similar kebab-name)
- `criteria`: includes `C2`
- `severity_hint`: `medium`
- `why`: references `packages/payments/` prefix and the 4 files

Expected rendering: `## Suggested Review Dimensions` section with a `### CREATE:` H3 block.
