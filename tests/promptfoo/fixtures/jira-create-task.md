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
      },
      "labels": { "required": false, "type": "array" },
      "components": { "required": false, "type": "array" }
    }
  },
  "workflows": {},
  "linkTypes": [],
  "userMappings": {}
}
```

## User Request Context
The user wants to create a Task in the PROJ project with:
- Summary: "Add rate limiting to API endpoints"
- Priority: High
- Labels: ["backend", "security"]
