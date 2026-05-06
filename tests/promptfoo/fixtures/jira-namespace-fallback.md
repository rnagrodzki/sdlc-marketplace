# Jira Project Context — namespace fallback

## Cache (from skill/jira.js)
```json
{
  "project": "PROJ",
  "cloudId": "abc-123",
  "siteUrl": "https://acme.atlassian.net",
  "issueTypes": ["Bug"],
  "fieldSchemas": {
    "Bug": { "summary": { "required": true, "type": "string" } }
  },
  "workflows": {},
  "linkTypes": [],
  "userMappings": {}
}
```

## Active MCP namespaces

Both namespaces are registered in the deferred-tools list:
- `mcp__atlassian__` (primary)
- `mcp__claude_ai_Atlassian__` (sibling)

## Simulated behavior

The primary namespace `mcp__atlassian__createJiraIssue` returns a cloudId
authorization error (`isn't explicitly granted`). The sibling namespace
`mcp__claude_ai_Atlassian__createJiraIssue` accepts the same payload.

## Expected behavior (spec R23)

After the cache-refresh retry from Step 3 fails (or before, if the user
indicates the primary namespace is broken), retry the operation under
`mcp__claude_ai_Atlassian__` once and persist the working namespace for
the rest of the session — do not re-probe per-call.
