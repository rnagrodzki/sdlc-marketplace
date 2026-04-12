# Jira Operations Reference

Per-operation execution procedures for the `jira-sdlc` skill. This file is loaded
conditionally after Step 2 classifies the operation type.

> **Universal rules — apply to EVERY MCP call:**
> - **Comments:** convert markdown to ADF via `scripts/lib/markdown-to-adf.js`, then pass `contentFormat: "adf"` with the ADF JSON body
> - **Descriptions/create:** pass `contentFormat: "markdown"` (no conversion needed)
> - Always pass `responseContentFormat: "markdown"` on calls that return content
> - Always use `cloudId` from cache — never call `getAccessibleAtlassianResources` again
> - Never guess field IDs, transition IDs, or user accountIds
> - Never fabricate field values — use only `allowedValues` from `fieldSchemas`

---

## Create Operation

```
1. Determine issue type from user request
   - Map user language ("bug", "feature", "task") to exact type name from cache.issueTypes
   - If ambiguous, ask: "Should I create a Bug, Task, or Story?"

2. Resolve description template:
   a. Check .claude/jira-templates/<issueTypeName>.md — if exists, read it (custom)
   b. Else, find templates/<issueTypeName>.md relative to the resolved $SCRIPT path
   c. If found: fill all {placeholder} markers from user context
      - Replace each {placeholder} with actual content from user's request
      - NEVER leave raw {placeholder} text in the final description
      - If a section has no applicable content, remove it entirely
   d. If no template: write a clean, structured description directly

3. Read cache.fieldSchemas[issueTypeName]:
   - List all required fields
   - For each required field not provided by user: ask before creating

4. Build MCP call using values from cache and user input:
   - issueTypeName: exact string from cache.issueTypes (e.g., "Task" NOT "task")
   - priority: { name: "..." } from cache fieldSchemas.priority.allowedValues
   - labels: flat string array
   - components: array of { name: "..." } objects
   - custom fields: use fieldId key (e.g., customfield_10016) with correct type shape
   - For Sub-task: include parent: "PROJ-123" as top-level parameter

5. Call mcp__atlassian__createJiraIssue with contentFormat: "markdown"
6. On success: report created issue key and URL
7. On 400 error: check fieldSchemas for the issue type; verify field shapes from REFERENCE.md Section 2
```

## Edit Operation

```
1. Parse: which issue key, which field(s), what new value(s)
2. For each field to update, resolve the correct JSON shape from REFERENCE.md Section 2:
   - Priority → { name: "..." }
   - Labels → flat string array (REPLACES existing labels entirely)
   - Components → array of { name: "..." } objects
   - Custom select → { value: "..." }
   - Assignee → { accountId: "..." } from cache.userMappings
3. Build fields object (flat — NOT nested under fields.fields)
4. Call mcp__atlassian__editJiraIssue with responseContentFormat: "markdown"
5. On 400: check field key spelling (customfield_XXXXX), field type, and value shape
```

## Search Operation

```
1. Build JQL from user intent using REFERENCE.md Section 3 patterns:
   - Always scope with "project = <KEY>" unless user explicitly wants cross-project
   - Apply escaping rules for values with spaces or special characters

2. Choose field list based on what info user needs:
   - Summary view: ["summary", "status", "assignee", "priority", "issuetype"]
   - Detailed view: ["summary", "status", "assignee", "priority", "created", "updated", "description"]

3. Call mcp__atlassian__searchJiraIssuesUsingJql:
   - maxResults: 25 for summary, 10 for detailed
   - responseContentFormat: "markdown"

4. Format results as a readable table
5. If total > maxResults: inform user, offer to paginate with startAt
```

## Transition Operation

```
1. Determine target status from user ("move to Done", "start", "mark in review")

2. Get current status:
   - If current status is known from context: use it
   - Else: call mcp__atlassian__getJiraIssue({ cloudId, issueKey, fields: ["status", "issuetype"] })

3. Look up workflow in cache:
   - transitions = cache.workflows[issueTypeName].transitions[currentStatus]
   - Find the transition entry matching the target status
   - If no match: the target transition isn't available from this status;
     inform user of available transitions and ask which to use

4. Check requiredFields for the chosen transition:
   - If requiredFields is not empty: include them in the call
   - Example: { resolution: { name: "Done" } } when requiredFields.resolution.required = true

5. Call mcp__atlassian__transitionJiraIssue({
     cloudId, issueKey,
     transition: { id: "<id from cache>" },
     fields: { <requiredFields> }           // only if requiredFields is non-empty
   })

6. On success: report new status
7. On 400 with requiredFields: check that all required fields were included with correct shapes
8. On "transition not found": call mcp__atlassian__getTransitionsForJiraIssue for fresh list
```

## Comment Operation

```
1. Compose comment in markdown (use REFERENCE.md Section 4 safe syntax only)
2. Convert to ADF — resolve the lib directory and run the conversion script:
   SCRIPT=$(find ~/.claude/plugins -name "markdown-to-adf.js" -path "*/sdlc*/scripts/lib/markdown-to-adf.js" 2>/dev/null | head -1)
   [ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/lib/markdown-to-adf.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/lib/markdown-to-adf.js"
   [ -z "$SCRIPT" ] && { echo "ERROR: markdown-to-adf.js not found"; exit 2; }
   cat <<'COMMENT_MD' | node "$SCRIPT"
   <markdown text>
   COMMENT_MD
3. Call mcp__atlassian__addCommentToJiraIssue({
     cloudId, issueIdOrKey,
     commentBody: <ADF JSON from step 2>,
     contentFormat: "adf",
     responseContentFormat: "markdown"
   })
4. Never use HTML tags, task lists (- [ ]), or footnotes in source markdown
```

## Link Operation

```
1. Determine link direction from user intent:
   - "PROJ-A blocks PROJ-B" → outwardIssue = PROJ-A, inwardIssue = PROJ-B
   - "PROJ-A is blocked by PROJ-B" → outwardIssue = PROJ-B, inwardIssue = PROJ-A
   - "PROJ-A relates to PROJ-B" → either direction (symmetric)
   - Cross-reference cache.linkTypes for exact inward/outward label semantics

2. Find link type in cache.linkTypes by name
3. Call mcp__atlassian__createIssueLink({
     cloudId,
     linkType: { name: "Blocks" },
     inwardIssue: { key: "PROJ-123" },
     outwardIssue: { key: "PROJ-456" }
   })
```

## Assign Operation

```
1. If user mentions a name/email already in cache.userMappings:
   - Use cached accountId directly

2. If user mentions someone not in cache:
   - Call mcp__atlassian__lookupJiraAccountId({ cloudId, query: "<name or email>" })
   - If multiple results: show all and ask user to confirm which one
   - Once confirmed: save to cache via:
     echo '{"<displayName>":"<accountId>"}' | node "$SCRIPT" --project "$KEY" --save-field userMappings

3. Call mcp__atlassian__editJiraIssue({
     cloudId, issueKey,
     fields: { assignee: { accountId: "<confirmed accountId>" } },
     responseContentFormat: "markdown"
   })
```

## Worklog Operation

```
1. Parse time from user ("2 hours 30 minutes" → "2h 30m", "half a day" → "4h")
2. Call mcp__atlassian__addWorklogToJiraIssue({
     cloudId, issueKey,
     timeSpent: "<Jira duration string>",
     comment: "<optional work description>",
     adjustEstimate: "auto"
   })
```

## View Operation

```
1. Determine what detail level the user needs:
   - Quick summary: fields: ["summary", "status", "assignee", "priority", "issuetype", "labels"]
   - Full details: all fields including description, custom fields
2. Call mcp__atlassian__getJiraIssue({
     cloudId, issueKey, fields: [...], responseContentFormat: "markdown"
   })
3. Render response clearly; show description as formatted markdown
```

## Bulk Operation

```
1. Parse all items from user request into discrete operation specs
2. Identify dependencies (e.g., Epic must exist before Stories that link to it)
3. Execute independent operations in parallel; dependent operations sequentially
4. Report progress after each batch: "Created 3 of 5 issues..."
5. On partial failure: complete remaining independent operations, then report all failures
```
