# OpenSpec Context: Ready for Plan (with Tasks Array)

## plan-prepare.js Output (pre-computed)

```json
{
  "openspec": {
    "present": true,
    "activeChanges": [{
      "name": "add-resource-indicators",
      "stage": "ready-for-plan",
      "deltaSpecCount": 3,
      "hasProposal": true,
      "hasDesign": true,
      "hasTasks": true,
      "tasksDone": 0,
      "tasksTotal": 5
    }],
    "branchMatch": "add-resource-indicators"
  },
  "fromOpenspec": {
    "valid": true,
    "changeName": "add-resource-indicators",
    "hasProposal": true,
    "deltaSpecCount": 3,
    "hasDesign": true,
    "hasTasks": true,
    "tasksDone": 0,
    "tasksTotal": 5,
    "stage": "ready-for-plan"
  },
  "fromOpenspecDirect": true,
  "openspecContext": {
    "changeName": "add-resource-indicators",
    "hasProposal": true,
    "deltaSpecCount": 3,
    "hasDesign": true,
    "hasTasks": true,
    "tasksUpdated": 5,
    "tasks": [
      { "ref": "create-resourceindicator-component-ab12cd", "line": 1, "title": "Create ResourceIndicator component with variant props", "indent": 0, "done": false },
      { "ref": "add-getindicators-to-resourceservice-ef34ab", "line": 2, "title": "Add getIndicators() to ResourceService", "indent": 0, "done": false },
      { "ref": "create-indicatorcache-with-ttl-support-cd56ef", "line": 3, "title": "Create IndicatorCache with TTL support", "indent": 0, "done": false },
      { "ref": "extend-get-apiresources-id-response-78abcd", "line": 4, "title": "Extend GET /api/resources/:id response", "indent": 0, "done": false },
      { "ref": "add-unit-tests-for-all-new-code-9012ef", "line": 5, "title": "Add unit tests for all new code", "indent": 0, "done": false }
    ]
  },
  "guardrails": [
    { "id": "test-coverage-required", "description": "Every task must include test cases", "severity": "error" },
    { "id": "no-scope-creep", "description": "Tasks must only address stated requirements", "severity": "warning" }
  ],
  "errors": []
}
```

## OpenSpec Artifacts (simulated reads)

### proposal.md
Resource indicators feature — add visual status indicators to resource cards showing availability, health, and capacity. Scope: UI components, data layer, and API integration.

### design.md
Use a shared ResourceIndicator component with configurable thresholds. Data fetched via existing ResourceService with a new `getIndicators()` method. Color scheme follows design system tokens.

### specs/resource-indicator-ui.md
#### ADDED
- ResourceIndicator component with health, capacity, and availability variants
- Color-coded badges using design system tokens (green/yellow/red)

### specs/resource-indicator-data.md
#### ADDED
- ResourceService.getIndicators(resourceId) method returning indicator data
- IndicatorCache with 30-second TTL

### specs/resource-indicator-api.md
#### MODIFIED
- GET /api/resources/:id — add `indicators` field to response body

### tasks.md
- [ ] Create ResourceIndicator component with variant props
- [ ] Add getIndicators() to ResourceService
- [ ] Create IndicatorCache with TTL support
- [ ] Extend GET /api/resources/:id response
- [ ] Add unit tests for all new code
