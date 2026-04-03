# jira-sdlc Specification

> Cache Jira project metadata on first use, then execute any Jira operation (create, edit, search, transition, comment, link, assign, worklog) using only cached values. Eliminates redundant discovery calls after initialization.

**User-invocable:** yes
**Model:** sonnet
**Prepare script:** `jira-prepare.js`

## Arguments

- A1: `--project <KEY>` — Jira project key (default: auto-detected via 4-step fallback)
- A2: `--force-refresh` — rebuild cache regardless of current state (default: false)
- A3: `--init-templates` — copy default description templates to `.claude/jira-templates/` (default: false)

## Core Requirements

- R1: Initialize a deterministic cache at `.sdlc/jira-cache/<PROJECT_KEY>.json` containing cloudId, issue types, field schemas, workflow graphs, link types, and user mappings
- R2: Cache is permanent by default (no timer-based expiry); rebuilt only on `--force-refresh` or operation failure due to stale data
- R3: After initialization, all operations read exclusively from cache — no discovery endpoint calls
- R4: Project key resolution follows 4-step ordered fallback: (1) `--project` argument, (2) branch name pattern `[A-Z]{2,10}-\d+`, (3) `.claude/sdlc.json` → `jira.defaultProject`, (4) AskUserQuestion
- R5: Cache initialization runs 6 phases: identity, project metadata, issue types, field schemas (parallel per type), workflow discovery (per non-subtask type), assemble and save
- R6: Classify user intent into one of 10 operation types: create, edit, search, transition, comment, link, assign, worklog, view, bulk
- R7: Per-issue-type description templates are filled from user context before MCP calls; all `{placeholder}` markers must be replaced or the section removed — never send raw placeholders
- R8: Custom templates at `.claude/jira-templates/<Type>.md` override default templates when present
- R9: On stale cache errors (invalid transition IDs, changed field schemas), auto-refresh cache and retry once
- R10: When `--init-templates` is passed, initialize templates and stop — do not execute any Jira operation

## Workflow Phases

1. CONSUME — parse arguments, resolve project key, run prepare script to check cache status
2. INIT (conditional) — deterministic 6-phase cache initialization when cache is missing, incomplete, or refresh requested
3. CLASSIFY — parse user intent into an operation type
4. DO — execute the classified operation using cached metadata
5. UPDATE — incrementally update cache with newly discovered data (user mappings, workflow states)

## Quality Gates

- G1: Cache loaded — `cloudId`, `project`, `issueTypes`, `fieldSchemas` all present before any operation
- G2: Content format — every description/comment call uses `contentFormat: "markdown"`
- G3: Response format — every content-returning call uses `responseContentFormat: "markdown"`
- G4: No raw placeholders — all `{placeholder}` markers in templates filled or section removed
- G5: Required fields — all required fields per `fieldSchemas` have values before create
- G6: Transition safety — transition `id` from cache or fresh API call, never guessed
- G7: User disambiguation — `lookupJiraAccountId` results always disambiguated if multiple matches
- G8: No fabricated values — all field values derived from cache `allowedValues` or user input

## Prepare Script Contract

- P1: `exists` (boolean) — whether cache file exists
- P2: `missing` (string[]) — required cache sections that are absent
- P3: `fresh` (boolean) — whether cache is within TTL (when `maxAgeHours > 0`)
- P4: Cache load output (full JSON) — the complete cache object when `--load` is used

## Error Handling

- E1: `jira-prepare.js` exit 1 → show `errors[]`, stop (no error report)
- E2: `jira-prepare.js` exit 2 (crash) → show stderr, invoke error-report-sdlc
- E3: HTTP 400 on create/edit → verify field key/shape against cached `fieldSchemas`; auto-refresh and retry once; invoke error-report-sdlc if still failing
- E4: HTTP 400 on transition → check `requiredFields` in cached workflows; auto-refresh and retry once
- E5: HTTP 401 → report auth token expired; cannot recover programmatically
- E6: HTTP 403 → report insufficient permission; cannot fix
- E7: HTTP 404 issue → ask user to verify issue key
- E8: HTTP 404 project → re-run cache check; verify cloudId matches correct site
- E9: HTTP 409 → retry the operation once (concurrent edit conflict)
- E10: Stale transition ID → auto-refresh cache, retry with new IDs

## Constraints

- C1: Must not use ADF format — always `contentFormat: "markdown"` and `responseContentFormat: "markdown"`
- C2: Must not call discovery endpoints after cache initialization (getAccessibleAtlassianResources, getJiraIssueTypeMetaWithFields, getIssueLinkTypes)
- C3: Must not pass transition name to `transitionJiraIssue` — requires `{ id: "..." }` object
- C4: Must not pass display name as assignee — requires `{ accountId: "..." }`
- C5: Must not guess field IDs, custom field keys, or transition IDs
- C6: Must not use values not in cache `allowedValues` — never fabricate enum values
- C7: Must not retry a failed operation more than once without diagnosing the cause first
- C8: Must not leave raw `{placeholder}` syntax in issue descriptions

## Integration

- I1: `jira-prepare.js` — manages cache file operations (check, load, save, init-templates)
- I2: Atlassian MCP tools — all Jira API calls go through the MCP tool layer
- I3: `error-report-sdlc` — invoked on script crashes and persistent API failures after auto-refresh
- I4: `plan-sdlc` — common follow-up to plan work from a Jira ticket
- I5: `execute-plan-sdlc` — common follow-up to execute a plan
