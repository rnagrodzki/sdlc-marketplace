# Execute — plan loaded, classified, and waved (ready to dispatch)

The plan below has already passed Step 1 (LOAD), Step 2 (VALIDATE), Step 3 (CLASSIFY) and
Step 4 (WAVE), so the run is ready to dispatch.

**Precedence:** this is background context. Where an individual prompt states its own wave
composition, task count, or execution stage, that statement is authoritative and overrides the
plan and wave table below.

Quality tier: **balanced** (`--quality balanced`) → Trivial=haiku, Standard=sonnet, Complex=opus.
Escalation budget: 2 per task.

## Plan in context

```
# Resource Indicators Implementation Plan

**Goal:** Add resource indicators end to end
**Architecture:** New component + service method, cache layer, then API surface
**Source:** conversation context
**Verification:** npm test

---

### Task 1: Create ResourceIndicator component
**Complexity:** Standard
**Risk:** Low
**Depends on:** none
**Verify:** npm test -- ResourceIndicator
**Files:** Create: src/components/ResourceIndicator.tsx
**Notes:** Presentational component only — no data fetching.
**Acceptance criteria:** Renders the indicator for every status value.

### Task 2: Add getIndicators to ResourceService
**Complexity:** Standard
**Risk:** Low
**Depends on:** none
**Verify:** npm test -- ResourceService
**Files:** Modify: src/services/ResourceService.ts
**Notes:** Read-only accessor over the existing resource list.
**Acceptance criteria:** Returns one indicator per resource.

### Task 3: Create IndicatorCache with TTL support
**Complexity:** Standard
**Risk:** Medium
**Depends on:** Task 2
**Verify:** npm test -- IndicatorCache
**Files:** Create: src/cache/IndicatorCache.ts
**Notes:** TTL is configurable; default comes from existing cache config.
**Acceptance criteria:** Entries expire after the configured TTL.

### Task 4: Wire IndicatorCache into ResourceService
**Complexity:** Trivial
**Risk:** Low
**Depends on:** Task 3
**Verify:** npm test -- ResourceService
**Files:** Modify: src/services/ResourceService.ts
**Notes:** Swap the direct call for the cached read.
**Acceptance criteria:** Cached path is used on repeat reads.

### Task 5: Replace the resource API transport layer
**Complexity:** Complex
**Risk:** High
**Depends on:** Task 4
**Verify:** npm test
**Files:** Modify: src/api/resources.ts
**Notes:** Architectural change — swaps the transport every consumer depends on.
**Acceptance criteria:** All existing consumers keep working against the new transport.
```

## Wave structure built in Step 4

| Wave | Tasks | Complexity / Risk | Assigned model |
|---|---|---|---|
| 1 | T1, T2 | Standard / Low | sonnet |
| 2 | T3 (Standard / Medium), T4 (Trivial / Low) | mixed | sonnet, haiku |
| 3 | T5 | Complex / **HIGH RISK** (architectural change) | opus |

Wave 3's single task **T5** is classified HIGH RISK, so Step 5a's high-risk approval gate applies
to that wave.

## activeGuardrails (loaded in Step 1 from `.sdlc/config.json` → `execute.guardrails`)

```json
[
  { "id": "test-coverage-required", "description": "Code changes must include corresponding test coverage", "severity": "error" },
  { "id": "no-scope-creep", "description": "Stay within the task's stated scope", "severity": "warning" }
]
```

## Run state

- `runId`: `run-resource-indicators`
- `stateScript`: `/abs/path/plugins/sdlc-utilities/scripts/state/execute.js`
- `.sdlc/learnings/log.md` exists and is writable.
- Working tree is a feature branch; no worktree was created.
