# Jira Project Context

## Cache (from jira-prepare.js)
```json
{
  "project": "PROJ",
  "cloudId": "abc-123-def-456",
  "issueTypes": ["Bug", "Story", "Task", "Sub-task", "Epic", "Test Case", "Test Plan"],
  "fieldSchemas": {
    "Test Case": {
      "summary": { "required": true, "type": "string" },
      "description": { "required": false, "type": "string" },
      "labels": { "required": false, "type": "array" }
    },
    "Test Plan": {
      "summary": { "required": true, "type": "string" },
      "description": { "required": false, "type": "string" },
      "labels": { "required": false, "type": "array" }
    }
  },
  "workflows": {},
  "linkTypes": [],
  "userMappings": {}
}
```

## Shipped templates available

The jira-sdlc plugin ships default templates for these issue types under
`plugins/sdlc-utilities/skills/jira-sdlc/templates/`:

- `Bug.md`, `Story.md`, `Task.md`, `Spike.md`, `Epic.md`, `Sub-task.md`
- `Test Case.md` — sections: Preconditions, Steps (Gherkin), Expected Results, Test Data, Notes
- `Test Plan.md` — sections: Objective, Scope (In/Out), Test Types, Entry Criteria, Exit Criteria, Risks and Mitigations, Notes

No project-level overrides exist at `.claude/jira-templates/` for these types,
so the skill must resolve to the shipped defaults (R18).
