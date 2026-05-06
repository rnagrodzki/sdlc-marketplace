# Jira Project Context — cloudId authorization error

## Cache (from skill/jira.js)
```json
{
  "project": "PROJ",
  "cloudId": "stale-cloud-id-123",
  "siteUrl": "https://acme.atlassian.net",
  "issueTypes": ["Bug", "Task"],
  "fieldSchemas": {
    "Bug": { "summary": { "required": true, "type": "string" } }
  },
  "workflows": {},
  "linkTypes": [],
  "userMappings": {}
}
```

## Active MCP namespaces
- `mcp__atlassian__` (registered, primary)

## Simulated MCP error response

When the next write call fires (e.g., `mcp__atlassian__createJiraIssue`),
the MCP returns:

```
HTTP 403 — The cloud id "stale-cloud-id-123" isn't explicitly granted to
this client. Re-fetch accessible resources and retry.
```

## Expected behavior (spec R23)

1. Detect the cloudId-error substring (`isn't explicitly granted`).
2. Call `getAccessibleAtlassianResources` exactly once.
3. The returned cloudId is `fresh-cloud-id-456` (different from cache).
4. Run `/jira-sdlc --force-refresh` and reload the cache.
5. Retry the original operation exactly once. If it still fails, surface
   the error and stop — do not loop.
