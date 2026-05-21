# Execute Plan: OpenSpec Task Flipping

## Context

Plan: Add resource indicators
Change name: add-resource-indicators
Branch: feature/add-resource-indicators

## Plan Tasks (with openspec-task blocks)

### Task t1
**Title:** Create ResourceIndicator component with variant props
**Complexity:** Standard
**Wave:** 1
**Acceptance criteria:**
- Component renders health, capacity, and availability variants
- Uses design system color tokens

```
openspec-task:
  change: add-resource-indicators
  ref: create-resourceindicator-component-ab12cd
  line: 1
  title: Create ResourceIndicator component with variant props
```

### Task t2
**Title:** Add getIndicators() to ResourceService
**Complexity:** Standard
**Wave:** 1
**Acceptance criteria:**
- getIndicators(resourceId) returns indicator data
- Method integrated with existing ResourceService

```
openspec-task:
  change: add-resource-indicators
  ref: add-getindicators-to-resourceservice-ef34ab
  line: 2
  title: Add getIndicators() to ResourceService
```

### Task t3
**Title:** Create IndicatorCache (storage layer)
**Complexity:** Standard
**Wave:** 2
**Acceptance criteria:**
- Cache stores indicator data keyed by resourceId
- Persists to disk between calls

```
openspec-task:
  change: add-resource-indicators
  ref: create-indicatorcache-with-ttl-support-cd56ef
  line: 3
  title: Create IndicatorCache with TTL support
```

### Task t4
**Title:** Create IndicatorCache TTL expiry logic
**Complexity:** Trivial
**Wave:** 2
**Acceptance criteria:**
- TTL of 30 seconds enforced
- Expired entries evicted on next read

```
openspec-task:
  change: add-resource-indicators
  ref: create-indicatorcache-with-ttl-support-cd56ef
  line: 3
  title: Create IndicatorCache with TTL support
```

### Task t5
**Title:** Extend GET /api/resources/:id response
**Complexity:** Standard
**Wave:** 2
**Acceptance criteria:**
- indicators field added to response body
- Existing fields unchanged

```
openspec-task:
  change: add-resource-indicators
  ref: extend-get-apiresources-id-response-78abcd
  line: 4
  title: Extend GET /api/resources/:id response
```

## OpenSpec tasks.md (current state before execution)

```
- [ ] Create ResourceIndicator component with variant props
- [ ] Add getIndicators() to ResourceService
- [ ] Create IndicatorCache with TTL support
- [ ] Extend GET /api/resources/:id response
- [ ] Add unit tests for all new code
```

Note: "Add unit tests for all new code" (line 5, ref: add-unit-tests-for-all-new-code-9012ef)
has no plan task with a matching openspec-task block. It IS listed in the plan's
## Out-of-scope OpenSpec tasks section: "Add unit tests for all new code — covered by
individual task acceptance criteria".

## Wave 1 WAVE_SUMMARY

```json
{
  "wave": 1,
  "tasks": [
    { "id": "t1", "status": "DONE", "filesChanged": ["src/components/ResourceIndicator.tsx"] },
    { "id": "t2", "status": "DONE", "filesChanged": ["src/services/ResourceService.ts"] }
  ],
  "allDone": true,
  "errors": []
}
```

## Wave 2 WAVE_SUMMARY

```json
{
  "wave": 2,
  "tasks": [
    { "id": "t3", "status": "DONE", "filesChanged": ["src/cache/IndicatorCache.ts"] },
    { "id": "t4", "status": "DONE", "filesChanged": ["src/cache/IndicatorCache.ts"] },
    { "id": "t5", "status": "DONE", "filesChanged": ["src/api/resources.ts"] }
  ],
  "allDone": true,
  "errors": []
}
```
