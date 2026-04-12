# Jira Project Context

## Cache (from jira-prepare.js)
```json
{
  "project": "PROJ",
  "cloudId": "abc-123-def-456",
  "issueTypes": ["Bug", "Story", "Task", "Sub-task", "Epic"],
  "fieldSchemas": {
    "Task": {
      "summary": { "required": true, "type": "string" },
      "description": { "required": false, "type": "string" },
      "priority": {
        "required": false,
        "type": "priority",
        "allowedValues": [
          { "name": "Highest" },
          { "name": "High" },
          { "name": "Medium" },
          { "name": "Low" },
          { "name": "Lowest" }
        ]
      }
    }
  },
  "workflows": {},
  "linkTypes": [],
  "userMappings": {}
}
```

## Issue Context
Issue PROJ-150 exists and is a Task currently in "In Progress" status.
The user wants to add a comment to this issue.