# Jira Project Context — unsampled workflow for transition

## Cache (from jira-prepare.js)
```json
{
  "version": 1,
  "lastUpdated": "2026-04-01T10:00:00Z",
  "maxAgeHours": 0,
  "cloudId": "abc-123-def-456",
  "siteUrl": "https://example.atlassian.net",
  "currentUser": { "accountId": "u1", "displayName": "User One", "email": "u1@example.com" },
  "project": { "key": "PROJ", "name": "Example", "id": "10000" },
  "issueTypes": {
    "Task":     { "id": "10001", "subtask": false, "hierarchyLevel": 0 },
    "Sub-task": { "id": "10004", "subtask": true,  "hierarchyLevel": -1 }
  },
  "fieldSchemas": {
    "Task": {
      "summary":     { "required": true,  "type": "string" },
      "description": { "required": false, "type": "string" }
    }
  },
  "workflows": {
    "Task": { "unsampled": true }
  },
  "linkTypes": [],
  "userMappings": {}
}
```

## Flags (from check output)
```json
{ "skipWorkflowDiscovery": true, "site": null }
```

## User Request Context
The user wants to transition `PROJ-147` to "Done". Because `workflows.Task.unsampled`
is `true`, the cache has no transition IDs for this issue type. The skill must call
`mcp__atlassian__getTransitionsForJiraIssue` live for the specific issue to obtain
the transition ID before calling `mcp__atlassian__transitionJiraIssue`. It must NOT
guess a transition ID, NOT use a transition name string, and NOT treat `unsampled`
as a blocking cache-completeness failure.
