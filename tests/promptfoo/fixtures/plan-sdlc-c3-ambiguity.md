# Plan Ambiguity: Conflicting Codebase Caching Patterns (Step 1 Approach Check)

This fixture exercises the Step 1 "Approach check" / structured-discovery ambiguity trigger: the
codebase sends conflicting signals — two existing patterns, either of which could reasonably be
followed for the same new component — with no dominant convention. It is used both for the
interactive path (AskUserQuestion fires) and the `--auto` path (AskUserQuestion is suppressed and
the decision is recorded instead).

## User Request

Add a caching layer for product catalog lookups in `src/services/catalog.ts`
(`getCatalogEntry(id)` currently hits the database on every call).

## Inline exploration result

Two existing, equally-viable caching patterns are already used in the codebase for the same kind
of problem (per-entity lookup caching), and neither is a clear "unusual" outlier:

**Pattern A — in-memory LRU cache** (`src/utils/lru-cache.ts`), used by:
- `src/services/pricing.ts`
- `src/services/discount.ts`
- `src/services/shipping.ts`

**Pattern B — Redis-backed cache client** (`src/cache/redis-client.ts`), used by:
- `src/services/inventory.ts` (adopted recently because inventory counts must stay consistent
  across multiple app instances)

Both patterns are structurally simple to extend to `catalog.ts`. There is no requirements
statement or design doc dictating which one to use for catalog lookups, and catalog data (unlike
inventory counts) has no cross-instance consistency requirement — either approach would work.

## Why this is a genuine ambiguity (Step 1 trigger (c))

The codebase sends conflicting signals: three existing call sites use the in-memory LRU pattern
(Pattern A), one uses the Redis-backed pattern (Pattern B). Neither is disqualified by the
requirements. Per the Step 1 "Approach check", this is a case where reasonable implementers could
differ, and the plan must not silently guess.

## Interactive path (no `--auto`)

The Step 1 "Approach check" fires AskUserQuestion, presenting the trade-offs of Pattern A
(in-memory LRU — simpler, no new infra, but not shared across instances) vs. Pattern B
(Redis-backed — shared/consistent across instances, but adds a network hop and an existing Redis
dependency) before decomposition proceeds.

## `--auto` path

`--auto` is set. The Step 1 "Approach check" AskUserQuestion is suppressed. Instead, plan-sdlc
picks the approach matching the DOMINANT existing codebase pattern — Pattern A, the in-memory LRU
cache used by 3 of the 4 existing call sites (`pricing.ts`, `discount.ts`, `shipping.ts`) — and:
- Records the choice and rationale in `## Key Decisions`.
- Adds a `## Deviations & assumptions` row with `asked=no` (autonomous/`--auto`-suppressed, per
  the `asked` column semantics).
