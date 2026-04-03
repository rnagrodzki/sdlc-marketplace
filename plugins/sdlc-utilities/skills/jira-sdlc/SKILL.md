---
name: jira-sdlc
description: "Use this skill when creating, editing, searching, transitioning, commenting on, or linking Jira issues using Atlassian MCP tools. Caches project metadata (custom fields, workflows, transitions, user mappings) to eliminate redundant discovery calls. Uses per-issue-type description templates (customizable per project). Arguments: [--project <KEY>] [--force-refresh] [--init-templates]. Triggers on: create jira issue, edit jira ticket, search jira, transition jira, jira comment, link jira, assign jira, log work jira, bulk jira operations, manage jira, jira template."
user-invocable: true
argument-hint: "[--project <KEY>] [--force-refresh] [--init-templates]"
---

# Managing Jira Issues

Cache Jira project metadata on first use, then execute any Jira operation — create,
edit, search, transition, comment, link, assign, worklog — using only cached values.
Eliminate all redundant discovery calls after initialization.

**Announce at start:** "I'm using jira-sdlc (sdlc v{sdlc_version})." — extract the version from the `sdlc:` line in the session-start system-reminder. If no version is in context, omit the parenthetical.

## When to Use This Skill

- Creating, editing, or viewing Jira issues
- Transitioning issues through workflow statuses
- Adding comments to Jira issues
- Linking two issues (blocks, relates, duplicate)
- Assigning issues to team members
- Logging work on a Jira issue
- Searching for issues via JQL
- Initializing or refreshing the project cache
- When the user asks anything Jira-related

## How This Skill Works

On first use, this skill initializes a cache at `.sdlc/jira-cache/<PROJECT_KEY>.json`
containing the site's `cloudId`, issue type definitions, field schemas, workflow graphs,
link types, and user mappings. The cache is permanent by default — it does not expire
on a timer. After initialization, every subsequent operation reads exclusively from the
cache. The cache is rebuilt only when `--force-refresh` is passed or when operations
fail due to stale data (invalid transition IDs, changed field schemas).

Each issue type has a description template (shipped in the skill's `templates/` directory
and customizable per project at `.claude/jira-templates/<Type>.md`). Templates are filled
from user context before the MCP call, producing well-structured descriptions on the first
attempt. All `{placeholder}` markers must be replaced with real content or the section
removed entirely — the API call is never made with raw placeholder text.

---

## Step 0 — Parse Arguments and Check Cache

### Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--project <KEY>` | Jira project key (e.g., PROJ) | Auto-detected |
| `--force-refresh` | Rebuild cache even if fresh | false |
| `--init-templates` | Copy default templates to `.claude/jira-templates/` | false |

**Project key resolution (ordered fallback):**

1. `--project <KEY>` argument
2. Parse current git branch for `[A-Z]{2,10}-\d+` pattern (e.g., `feat/PROJ-123-fix` → `PROJ`)
3. Read `.claude/sdlc.json` → `jira.defaultProject`
4. Use AskUserQuestion to ask: "Which Jira project key should I use? (e.g., PROJ, TEAM)"

### Script Resolution Block

> **VERBATIM** — Run this bash block exactly as written. Do not modify, rephrase, or simplify the commands.

```bash
SCRIPT=$(find ~/.claude/plugins -name "jira.js" -path "*/sdlc*/scripts/skill/jira.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/skill/jira.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/skill/jira.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate skill/jira.js. Is the sdlc plugin installed?" >&2; exit 2; }

JIRA_CONTEXT_FILE=$(node "$SCRIPT" --output-file $ARGUMENTS --check)
EXIT_CODE=$?
```

Read and parse `JIRA_CONTEXT_FILE`. Clean up after skill completes or is cancelled:

```bash
rm -f "$JIRA_CONTEXT_FILE"
```

**On non-zero `EXIT_CODE`:**

- Exit code 1: JSON contains `errors[]`. Show each error and stop.
- Exit code 2: Show `Script error — see output above` and stop.

### Cache Status Evaluation

**Hook context fast-path:** If the session-start system-reminder contains a `Jira cache:` line with `stale`, use it to skip the `skill/jira.js --check` cache status check and immediately prompt for `--force-refresh`. If the line shows the cache as current, proceed with `skill/jira.js` as normal — the prepare script validates more deeply than the hook's age check. The hook context is a session-start snapshot.

Read the check output:

- If `exists: false` → cache not initialized. Proceed to **Step 1**.
- If `missing` array contains required sections (`cloudId`, `project`, `issueTypes`, `fieldSchemas`) → cache incomplete. Proceed to **Step 1**.
- If `--force-refresh` passed → rebuild regardless of age. Proceed to **Step 1**.
- If `fresh: false` AND `maxAgeHours > 0` → TTL-based expiry exceeded. Proceed to **Step 1**.
- Otherwise (cache exists, complete, and either permanent or within TTL) → load cache via `--load`, skip to **Step 2**.

Load cache:

```bash
node "$SCRIPT" --project "$PROJECT_KEY" --load > "$JIRA_CONTEXT_FILE"
```

### Handle `--init-templates`

If `--init-templates` flag is present:

1. Run the init-templates script:
   ```bash
   INIT_RESULT=$(node "$SCRIPT" --output-file --project "$PROJECT_KEY" --init-templates)
   ```

2. Read and parse the output. Report: "N templates initialized (exact match), N skipped (already exist)."

3. If `unavailable` array is non-empty AND the cache is loaded:
   - Announce: "Found N issue types with no matching default template. I'll suggest a template for each based on its Jira hierarchy level."
   - For each unavailable type, look up its metadata in `cache.issueTypes[typeName]`:
     - Determine suggestion based on `hierarchyLevel`:
       - `hierarchyLevel === 1` → suggest "Epic"
       - `hierarchyLevel === 0` and `subtask === false` → suggest "Task"
       - `subtask === true` → suggest "Skip (subtask)"
       - No `hierarchyLevel` available → no suggestion, present all options equally
     - Use AskUserQuestion:
       > Issue type "[typeName]" (hierarchy level: [N]) has no matching template.
       > Which default template should I use?

       Options: [Suggested template (Recommended)], [other available default templates], [Skip — no template for this type]
   - For each user selection (not "Skip"), copy the template:
     ```bash
     node "$SCRIPT" --project "$PROJECT_KEY" --copy-template --type "<typeName>" --from "<selectedTemplate>"
     ```
   - Report final results: "N additional templates created from user selections."

4. Clean up:
   ```bash
   rm -f "$INIT_RESULT"
   ```

5. Stop. Do not proceed with any Jira operation.

---

## Step 1 — Deterministic Cache Initialization

> Run this phase only when the cache is missing, incomplete, `--force-refresh` is set,
> a TTL-based expiry was exceeded, or an operation error triggered an auto-refresh.
> After it completes, the skill never calls discovery endpoints again until the next refresh.

Announce: "Initializing Jira cache for project `[PROJECT_KEY]`…"

### Phase 1 — Identity (run BOTH in parallel)

```
mcp__atlassian__getAccessibleAtlassianResources()
→ Extract: sites[0].id → cloudId
           sites[0].url → siteUrl

mcp__atlassian__atlassianUserInfo()
→ Extract: accountId → currentUser.accountId
           displayName → currentUser.displayName
           emailAddress → currentUser.email
```

### Phase 2 — Project metadata (run BOTH in parallel, needs cloudId)

```
mcp__atlassian__getVisibleJiraProjects({ cloudId, searchString: PROJECT_KEY })
→ Extract: values[0].key, values[0].name, values[0].id → project object

mcp__atlassian__getIssueLinkTypes({ cloudId })
→ Extract: issueLinkTypes array → linkTypes (name, inward, outward per entry)
```

### Phase 3 — Issue types (needs project)

```
mcp__atlassian__getJiraProjectIssueTypesMetadata({ cloudId, projectKey: PROJECT_KEY })
→ Extract: for each issue type: name → key, id, subtask boolean, hierarchyLevel (integer)
→ Store as: issueTypes = { "Task": { "id": "10001", "subtask": false, "hierarchyLevel": 0 }, ... }
```

### Phase 4 — Field schemas (one call per issue type, run ALL in parallel)

For each issueType from Phase 3:

```
mcp__atlassian__getJiraIssueTypeMetaWithFields({ cloudId, projectKey, issueTypeId: issueType.id })
→ Extract: ALL fields — standard AND custom
→ For each field: name, key (fieldId), required (boolean), schema.type, allowedValues
→ Field type mapping:
    API type "string"            → cache type "string"
    API type "number"            → cache type "number"
    API type "priority"          → cache type "priority" (has allowedValues)
    API type "option"            → cache type "option" (custom single-select)
    API type "array" of "option" → cache type "multi-option" (custom multi-select)
    API type "user"              → cache type "user"
    API type "date"              → cache type "date" (format: YYYY-MM-DD)
    API type "datetime"          → cache type "datetime" (ISO-8601)
→ Store allowedValues as flat string arrays (extract the name or value property)
→ Store in: fieldSchemas[issueTypeName] = { [fieldKey]: { required, type, name?, allowedValues? } }
```

### Phase 5 — Workflow discovery (per non-subtask issue type)

For each non-subtask issue type in `issueTypes`:

**5a** — Find all statuses in use:

```
mcp__atlassian__searchJiraIssuesUsingJql({
  cloudId,
  jql: `project = "${PROJECT_KEY}" AND issuetype = "${issueTypeName}" ORDER BY status ASC`,
  fields: ["status"],
  maxResults: 100
})
→ Extract unique status names from results
```

**5b** — For each unique status, find one issue in that status:

```
mcp__atlassian__searchJiraIssuesUsingJql({
  cloudId,
  jql: `project = "${PROJECT_KEY}" AND issuetype = "${issueTypeName}" AND status = "${statusName}"`,
  fields: ["status"],
  maxResults: 1
})
→ Get issues[0].key
```

**5c** — Get transitions from that status:

```
mcp__atlassian__getTransitionsForJiraIssue({ cloudId, issueKey })
→ Extract: for each transition: id, name, to.name (target status)
→ Extract requiredFields: if transition has a screen, extract field schemas for required fields
→ Store in: workflows[issueTypeName].transitions[currentStatusName] = [
    { "id": "21", "name": "...", "to": "...", "requiredFields": { ... } }
  ]
```

If no issues exist in a given status (5b returns empty), skip that status — note it in
`workflows[type].statuses` as known but unsampled.

### Phase 6 — Assemble and save cache

Assemble the full cache object:

```json
{
  "version": 1,
  "lastUpdated": "<current ISO timestamp>",
  "maxAgeHours": 0,
  "cloudId": "...",
  "siteUrl": "...",
  "currentUser": { "accountId": "...", "displayName": "...", "email": "..." },
  "project": { "key": "...", "name": "...", "id": "..." },
  "issueTypes": { "Task": { "id": "10001", "subtask": false, "hierarchyLevel": 0 }, "Bug": { "id": "10002", "subtask": false, "hierarchyLevel": 0 }, "Epic": { "id": "10005", "subtask": false, "hierarchyLevel": 1 }, "Sub-task": { "id": "10004", "subtask": true, "hierarchyLevel": -1 } },
  "fieldSchemas": { "Task": { "summary": { "required": true, "type": "string" }, "...": {} } },
  "workflows": { "Task": { "transitions": { "To Do": [ { "id": "21", "name": "...", "to": "...", "requiredFields": {} } ] } } },
  "linkTypes": [ { "name": "Blocks", "inward": "is blocked by", "outward": "blocks" } ],
  "userMappings": {}
}
```

Save:

```bash
echo '<cache_json>' | node "$SCRIPT" --project "$PROJECT_KEY" --save
```

Then load the cache:

```bash
node "$SCRIPT" --project "$PROJECT_KEY" --load > "$JIRA_CONTEXT_FILE"
```

Report: "Cache initialized for `[PROJECT_KEY]` — `[N]` issue types, `[N]` workflow states mapped."

---

## Step 2 — Classify Operation

Parse user intent into one of these operations:

| Operation | Trigger Phrases | Calls with cache |
|-----------|----------------|-----------------|
| `create` | create issue, new ticket, add bug/story/task | 1 |
| `edit` | update, change, set priority/label/assignee | 1 |
| `search` | find, list, show, search, which issues | 1 |
| `transition` | move to, start, close, complete, done, in progress | 1–2 |
| `comment` | comment on, add note, reply | 1 |
| `link` | link to, blocks, relates to, duplicate | 1 |
| `assign` | assign to, give to, ownership | 1–2 |
| `worklog` | log time, log work, spent time | 1 |
| `view` | show, get, display, details of | 1 |
| `bulk` | create N issues, multiple operations | N |

For ambiguous requests, use AskUserQuestion to ask one clarifying question before classifying.

---

## Step 3 — Execute Operation

After Step 2 classifies the operation type, read `./operations-reference.md` and follow the procedure for the matching operation type.

| Classified Operation | Section in operations-reference.md |
|---------------------|------------------------------------|
| `create` | Create Operation |
| `edit` | Edit Operation |
| `search` | Search Operation |
| `transition` | Transition Operation |
| `comment` | Comment Operation |
| `link` | Link Operation |
| `assign` | Assign Operation |
| `worklog` | Worklog Operation |
| `view` | View Operation |
| `bulk` | Bulk Operation |

---

## Step 4 — Post-Operation Cache Updates

After operations that reveal new information, update the cache incrementally:

| Trigger | Cache update command |
|---------|---------------------|
| New user resolved via lookupJiraAccountId | `echo '{"<name>":"<id>"}' \| node "$SCRIPT" --project "$KEY" --save-field userMappings` |
| Transition from a status not in workflow cache | `echo '<workflows_json>' \| node "$SCRIPT" --project "$KEY" --save-field workflows` |
| Cache returned stale transition ID (404/400) | **Auto-refresh**: run `--force-refresh`, reload cache, retry operation once |
| Operation fails with field key or value not in cache | **Auto-refresh**: run `--force-refresh`, reload cache, retry operation once |

---

## Error Recovery

| Error | Diagnosis | Recovery |
|-------|-----------|----------|
| 400 on create | Missing required field or wrong field shape | Verify field key/shape against the cached `fieldSchemas` object. If the field doesn't match, run `--force-refresh`, reload cache, retry once. If still failing after refresh, invoke `error-report-sdlc` |
| 400 on transition | Missing required transition field (e.g., resolution) | Check `workflows[type].transitions[status][n].requiredFields`; include required fields. If transition ID is not recognized, **auto-refresh**: run `--force-refresh`, reload cache, retry once |
| 400 on edit | Wrong field shape or incorrect custom field key | Verify field key/shape against the cached `fieldSchemas` object. If the field doesn't match, run `--force-refresh`, reload cache, retry once. If field format details are needed, Read `./REFERENCE.md` Section 2 only |
| 401 | Auth token expired | Reconnect Atlassian MCP; cannot recover programmatically |
| 403 | Insufficient permission | Report to user — cannot fix |
| 404 issue | Issue key wrong or issue deleted | Ask user to verify the issue key |
| 404 project | Wrong project key or no access | Re-run `--check`; verify cloudId matches the correct site |
| 409 | Concurrent edit conflict | Retry the operation once |
| Stale transition | Transition ID no longer valid | **Auto-refresh**: run `--force-refresh`, reload cache, retry with new IDs |
| Repeated 400 (2+ attempts) | Cache may have incorrect schema data | **Auto-refresh**: run `--force-refresh`, reload cache, retry once. If still failing after refresh, invoke `error-report-sdlc` |

When invoking `error-report-sdlc` for a persistent Jira API failure, provide:
- **Skill**: jira-sdlc
- **Step**: Step 3 — Execute Operation (operation name)
- **Operation**: MCP call that failed (e.g., `createJiraIssue`, `transitionJiraIssue`)
- **Error**: HTTP status + error message from the MCP response
- **Suggested investigation**: Check if Jira project schema changed; verify cloudId is still valid; confirm the MCP prefix matches the active session

---

## Quality Gates

| Gate | Check |
|------|-------|
| Cache loaded | `cloudId`, `project`, `issueTypes`, `fieldSchemas` all present before any operation |
| Content format | Every description/comment call uses `contentFormat: "markdown"` |
| Response format | Every content-returning call uses `responseContentFormat: "markdown"` |
| No raw placeholders | All `{placeholder}` markers in templates filled or section removed |
| Required fields | All required fields per `fieldSchemas` have values before create |
| Transition safety | Transition `id` from cache or fresh `getTransitionsForJiraIssue`, never guessed |
| User disambiguation | `lookupJiraAccountId` results always disambiguated if multiple matches |
| No fabricated values | All field values derived from cache `allowedValues` or user input |

---

## DO NOT

- Use ADF format — always `contentFormat: "markdown"` and `responseContentFormat: "markdown"`
- Call `getAccessibleAtlassianResources` after cache init — use cached `cloudId`
- Call `getJiraIssueTypeMetaWithFields` after cache init — use cached `fieldSchemas`
- Call `getIssueLinkTypes` after cache init — use cached `linkTypes`
- Pass transition name to `transitionJiraIssue` — requires `{ id: "..." }` object
- Pass display name as assignee — requires `{ accountId: "..." }`
- Guess field IDs, custom field keys, or transition IDs
- Skip required fields for transitions (e.g., resolution when closing)
- Use values not in cache `allowedValues` — never fabricate enum values
- Retry a failed operation more than once without diagnosing the cause first
- Leave raw `{placeholder}` syntax in issue descriptions
- Ignore custom templates at `.claude/jira-templates/<Type>.md` when they exist
- Generate unstructured descriptions when a template is available

---

## Gotchas

- `createJiraIssue` uses `issueTypeName` (string `"Task"`), NOT `issueTypeId` (`"10001"`)
- `editJiraIssue.fields` is a flat object — do NOT nest under `fields.fields`
- `additional_fields` on create is for everything beyond summary/description/assignee/parent
- Priority values are `{ name: "High" }` — NOT `{ id: "2" }` or bare `"High"`
- Labels are flat strings `["label1"]` — NOT `[{ name: "label1" }]`
- Components are objects `[{ name: "API" }]` — NOT flat strings `["API"]`
- Custom single-select uses `{ value: "Option" }` — NOT `{ name: "Option" }`
- Sprint field is a number (sprint ID integer) — NOT the sprint name or an object
- `lookupJiraAccountId` may return multiple results — always disambiguate with the user
- JQL values with special characters need escaping: `summary ~ "can\\'t"` not `"can't"`
- Sub-task creation requires `parent: "PROJ-123"` as a string parameter AND the exact subtask type name from `cache.issueTypes` (may be `"Sub-task"`, `"Subtask"`, or custom)
- When a transition is absent from `getTransitionsForJiraIssue` results, it means transition conditions aren't met (e.g., all subtasks must be closed) — missing transitions are intentional, not a bug
- Transition `requiredFields` may include screen-only fields not in `fieldSchemas` — if a required field is absent from the schema, try the transition without it first; screen fields sometimes only block the Jira UI, not the API
- `getVisibleJiraProjects` uses `searchString` (not `query`) for filtering — check parameter name before calling
- When Phase 5 workflow sampling finds no issues at all for a type, skip workflow discovery for that type entirely and note it in the cache as `"workflows": { "Story": { "unsampled": true } }`
- The `mcp__atlassian__` prefix is the default; if the user's MCP is registered under a different prefix (e.g., `mcp__claude_ai_Atlassian__`), use the active prefix consistently across all calls in the session

---

## Learning Capture

When executing Jira operations, capture discoveries by appending to `.claude/learnings/log.md`.
Record entries for: field formats that differ from the defaults documented here, workflow
quirks discovered in specific projects, issue type names that aren't standard (e.g., custom
subtask type names), user lookup disambiguation patterns, and transition required fields not
captured by the workflow sampling.

## What's Next

After completing a Jira operation, common follow-ups include:
- `/plan-sdlc` — write an implementation plan for a ticket
- `/execute-plan-sdlc` — execute an existing plan

## See Also

- [`/plan-sdlc`](../plan-sdlc/SKILL.md) — write an implementation plan from a Jira ticket
- [`/execute-plan-sdlc`](../execute-plan-sdlc/SKILL.md) — execute an existing plan
