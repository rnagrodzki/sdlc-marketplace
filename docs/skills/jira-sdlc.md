# `/jira-sdlc` — Jira Issue Management

## Overview

Manages Jira issues via the Atlassian MCP with a project metadata cache that eliminates repeated discovery calls. Caches custom fields, workflow graphs, transition requirements, and user mappings on first use — keeping most operations to a single MCP call. Supports per-issue-type description templates (customizable per project) for consistent, well-structured issue content.

---

## Usage

```text
/jira-sdlc [--project <KEY>] [--force-refresh] [--init-templates]
```

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--project <KEY>` | Jira project key to use (e.g., `PROJ`). Auto-detected from git branch or `.sdlc/jira-config.json` | Auto |
| `--force-refresh` | Rebuild the project cache from scratch (cache is permanent by default; use when project metadata has changed) | — |
| `--init-templates` | Copy the skill's default issue type templates to `.claude/jira-templates/` for customization | — |

---

## Examples

### Create a bug

```text
/jira-sdlc
Create a bug for the login page redirect issue on Firefox with SSO users. High priority, assign to Jane.
```

Creates PROJ-147 with a structured description using the Bug template.

### Transition an issue

```text
/jira-sdlc
Move PROJ-147 to Done
```

Transitions the issue using the cached transition ID, automatically including required fields (e.g., resolution).

### Search for open issues

```text
/jira-sdlc
Find all open high-priority bugs assigned to me in project PROJ
```

Returns a table of matching issues.

### Add a comment

```text
/jira-sdlc
Add a comment to PROJ-147 with the root cause analysis
```

Converts the markdown to Atlassian Document Format (ADF) via `markdown-to-adf.js` and posts the comment.

### Edit issue fields

```text
/jira-sdlc
Set PROJ-147 story points to 5 and add the label "backend"
```

Updates both fields in a single `editJiraIssue` call.

### Initialize cache for a project

```text
/jira-sdlc --project PROJ --force-refresh
```

Runs the 5-phase initialization, reports N issue types and M workflow states mapped.

### Customize issue templates

```text
/jira-sdlc --project PROJ --init-templates
```

Copies default templates for each issue type to `.claude/jira-templates/`. Edit them to match your team's conventions.

### Create with a specific project

```text
/jira-sdlc --project BACKEND
Create a story for the token refresh feature
```

Creates the story in the BACKEND project using the Story template.

---

## Custom Issue Templates

Default templates ship in `plugins/sdlc-utilities/skills/jira-sdlc/templates/` — one file per issue type:

- `Bug.md`
- `Story.md`
- `Task.md`
- `Epic.md`
- `Sub-task.md`
- `Spike.md`

Project-level overrides live at `.claude/jira-templates/<IssueTypeName>.md`. File names must match Jira issue type names exactly (case-sensitive).

Resolution order:

1. **Project custom** — `.claude/jira-templates/<IssueTypeName>.md`
2. **Skill default** — `plugins/sdlc-utilities/skills/jira-sdlc/templates/<IssueTypeName>.md`
3. **No template** — description is generated without structure

Run `/jira-sdlc --init-templates` to export the skill defaults to `.claude/jira-templates/` as a starting point, then edit them to match your team's conventions.

> **Tip:** On non-English Jira instances, `--init-templates` detects unmapped issue types and interactively asks which default template to use for each.

### Non-English Jira Locales

When Jira uses a non-English language, issue type names are localized (e.g., "Zadanie" for Task in Polish). Running `--init-templates` detects unmapped types and interactively asks which default template to use for each, with suggestions based on the Jira hierarchy level (Epic for top-level types, Task for standard types).

After interactive setup, template files are created with your locale's names (e.g., `.claude/jira-templates/Zadanie.md`) containing the selected template content as a starting point. Edit them to match your team's conventions.

**Example custom Bug template** (`.claude/jira-templates/Bug.md`):

```markdown
## Summary
[One sentence: what is broken and where]

## Steps to Reproduce
1.
2.
3.

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- Browser / OS:
- Version / build:

## Root Cause (if known)
[Leave blank if unknown]
```

---

## How the Cache Works

The cache is stored at `.sdlc/jira-cache/<PROJECT_KEY>.json` and is permanent by default — it does not expire on a timer. It is refreshed when `--force-refresh` is passed or when an operation fails due to stale cached data (e.g., invalid transition IDs or changed field schemas), triggering an automatic rebuild and retry.

The cache contains:

- `cloudId` — Atlassian cloud instance identifier
- Issue types and their field schemas (including custom fields)
- Workflow graphs with transition IDs and per-transition required fields
- Available issue link types
- User account ID mappings (display name → accountId)

After initialization, most operations require a single MCP call instead of 4–8 discovery calls, significantly reducing latency and token usage.

---

## Prerequisites

- **Atlassian MCP** — must be configured and connected (`mcp__atlassian__*` tools available in your Claude Code session)
- **Jira project access** — the authenticated user must have read/write permission on the target project
- No additional CLI tools required

### Harness Configuration

| Field | Value |
|---|---|
| `argument-hint` | `[--project <KEY>] [--force-refresh] [--init-templates]` |
| Plan mode | Not adapted (writes to Jira) |

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| `.sdlc/jira-cache/<KEY>.json` | Project metadata cache: cloudId, issue types, field schemas, workflows, user mappings |
| `.sdlc/jira-cache/.gitignore` | Git-ignore file preventing cache contents from being committed; created automatically on first use |
| `.claude/jira-templates/<Type>.md` | Project-level issue description templates (created only when `--init-templates` is run, or manually) |
| Jira issues | Created or updated via the Atlassian MCP |

## Related Skills

- [`/plan-sdlc`](plan-sdlc.md) — write an implementation plan from a Jira ticket
- [`/execute-plan-sdlc`](execute-plan-sdlc.md) — execute an existing plan
