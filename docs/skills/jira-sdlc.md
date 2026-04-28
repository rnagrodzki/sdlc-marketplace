# `/jira-sdlc` — Jira Issue Management

## Overview

Manages Jira issues via the Atlassian MCP with a project metadata cache that eliminates repeated discovery calls. Caches custom fields, workflow graphs, transition requirements, and user mappings on first use — keeping most operations to a single MCP call. Supports per-issue-type description templates (customizable per project) for consistent, well-structured issue content.

---

## Usage

```text
/jira-sdlc [--project <KEY>] [--force-refresh] [--init-templates] [--site <host>] [--skip-workflow-discovery]
```

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--project <KEY>` | Jira project key to use (e.g., `PROJ`). Auto-detected from git branch or `.claude/sdlc.json` → `jira.defaultProject`. When `jira.projects` is set (≥2 entries), values outside the list are rejected. | Auto |
| `--force-refresh` | Rebuild the project cache from scratch (cache is permanent by default; use when project metadata has changed) | — |
| `--init-templates` | Copy the skill's default issue type templates to `.claude/jira-templates/` for customization | — |
| `--site <host>` | Sanitized site host (lowercased, `.` → `_`, e.g., `acme_atlassian_net`). Disambiguates `--check`/`--load` when the same project key is cached under multiple site subdirectories. | Unset |
| `--skip-workflow-discovery` | Bypass Phase 5; cache marks each non-subtask issue type `{ unsampled: true }`. Transitions fall back to a live `getTransitionsForJiraIssue` per issue. Use in CI and other pre-seeded environments. | false |

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

The cache is stored at `~/.sdlc-cache/jira/<sanitizedSiteHost>/<PROJECT_KEY>.json` and is permanent by default — it does not expire on a timer. `sanitizedSiteHost` is the site URL host lowercased with `.` replaced by `_` (e.g., `acme.atlassian.net` → `acme_atlassian_net`). The cache lives outside the working tree so it is never committed, survives repo clones, and supports repos that map to multiple Jira tenants (one subdirectory per site). Refreshed when `--force-refresh` is passed or when an operation fails due to stale cached data (e.g., invalid transition IDs or changed field schemas), triggering an automatic rebuild and retry.

The cache contains:

- `cloudId` — Atlassian cloud instance identifier
- `siteUrl` — canonical form is the full origin URL (e.g., `https://acme.atlassian.net`); the prepare script also accepts a bare host (e.g., `acme.atlassian.net`) and will strip any trailing path. The `sanitizedSiteHost` subdirectory is always derived from the host portion only.
- Issue types and their field schemas (including custom fields)
- Workflow graphs with transition IDs and per-transition required fields (or `{ unsampled: true }` when Phase 5 was skipped)
- Available issue link types
- User account ID mappings (display name → accountId)

After initialization, most operations require a single MCP call instead of 4–8 discovery calls, significantly reducing latency and token usage.

### Legacy Cache Migration

Earlier versions of this skill stored the cache in-repo at `.sdlc/jira-cache/<KEY>.json` (and before that, `.claude/jira-cache/<KEY>.json`). On the next `--check`, the prepare script detects either legacy location, copies the file to the home layout using the `siteUrl` embedded in the JSON, and emits a warning. The legacy file is left in place for the user to clean up once confident. Migration is idempotent: subsequent runs find the home cache first and skip the legacy probe entirely.

### Multiple Projects

Repos that map to multiple Jira projects can enumerate the allowed keys in `.claude/sdlc.json`:

```json
{
  "jira": {
    "defaultProject": "FOO",
    "projects": ["FOO", "BAR", "BAZ"]
  }
}
```

When `jira.projects` is set with two or more entries:

- `--project <KEY>` arguments are validated against the list. Values outside the list are rejected (prepare script exits 1).
- When branch parsing, `defaultProject`, and `--project` all fail to resolve a key, the skill presents a closed-list AskUserQuestion restricted to the configured projects — no free-form input.
- Single-project repos (no `jira.projects`, or only one entry) retain the prior four-step fallback with a free-form prompt as the final step.

### CI Usage

Phase 5 workflow discovery fires an MCP call per non-subtask issue type (and several per type for transition sampling). In pre-seeded CI environments where the cache is bootstrapped ahead of time, or on cold runs where end-to-end latency matters more than transition coverage, pass `--skip-workflow-discovery`:

```bash
/jira-sdlc --project PROJ --force-refresh --skip-workflow-discovery
```

The resulting cache stores `workflows: { "<Type>": { "unsampled": true } }` for every non-subtask issue type. At runtime, any transition operation that encounters an `unsampled` marker routes through a live `getTransitionsForJiraIssue` per issue — the same auto-refresh path used when a cached transition ID stales out. Other cache sections (issue types, field schemas, link types, user mappings) are still populated normally.

---

## Prerequisites

- **Atlassian MCP** — must be configured and connected (`mcp__atlassian__*` tools available in your Claude Code session)
- **Jira project access** — the authenticated user must have read/write permission on the target project
- No additional CLI tools required

### Harness Configuration

| Field | Value |
|---|---|
| `argument-hint` | `[--project <KEY>] [--force-refresh] [--init-templates] [--site <host>] [--skip-workflow-discovery]` |
| Plan mode | Not adapted (writes to Jira) |

---

## Write Operation Safeguards

Every write operation (`create`, `edit`, `transition`, `comment`, `link`, `assign`, `worklog`, `bulk`) passes through a two-step gate before any MCP call is dispatched. Read operations (`search`, `view`) skip this gate entirely.

### Critique pass (R20)

Before presenting a proposal, the skill runs an internal critique against the assembled payload:

- **Template completeness** — every `## ` heading in `description` must come from the resolved template; no invented sections.
- **Placeholder resolution** — `[bracketed prose]` and `{name}` markers flagged as `low`-confidence must be resolved via `AskUserQuestion` before the payload is shown (R19). High-confidence auto-fills are surfaced as findings but do not block.
- **Field validity** — required fields for the selected transition are present; field values are within cache-validated enumerations.

The findings are surfaced as a three-line block before the approval prompt:

```
Initial: <one-line summary of the initial draft>
Critique: <findings, or "none">
Final: <one-line summary of the revised payload>
```

The critique artifact is written to `$TMPDIR/jira-sdlc/critique-<hash>.json`.

### Approval gate (R17)

After the critique block, the full final payload (the exact bytes the MCP call will dispatch) is printed. The user must respond with one of:

- **approve** — proceed to dispatch
- **change `<what>`** — describe the desired change; the skill loops back through the critique pass with a revised draft and new artifacts
- **cancel** — abort without dispatching

On `approve`, an approval token is written to `$TMPDIR/jira-sdlc/approval-<hash>.token`. No write MCP call is dispatched without this token.

### Hook enforcement (R21)

A `PreToolUse` hook (`hooks/pre-tool-jira-write-guard.js`) re-derives the payload hash from the tool input at dispatch time, verifies both artifacts exist and are under 10 minutes old, and **blocks dispatch** if either check fails. If dispatch is blocked, the hook's `permissionDecisionReason` is surfaced verbatim — the skill does not retry by guessing what changed.

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| `~/.sdlc-cache/jira/<site>/<KEY>.json` | Project metadata cache (home-keyed, outside the working tree): cloudId, issue types, field schemas, workflows, user mappings |
| `.claude/jira-templates/<Type>.md` | Project-level issue description templates (created only when `--init-templates` is run, or manually) |
| `$TMPDIR/jira-sdlc/critique-<hash>.json` | Per-operation critique artifact (write-ops only); contains initial/findings/final summary; verified by the PreToolUse hook |
| `$TMPDIR/jira-sdlc/approval-<hash>.token` | Per-operation approval token (write-ops only); created on `approve`; verified and deleted by the PreToolUse hook after dispatch |
| Jira issues | Created or updated via the Atlassian MCP |

## Related Skills

- [`/plan-sdlc`](plan-sdlc.md) — write an implementation plan from a Jira ticket
- [`/execute-plan-sdlc`](execute-plan-sdlc.md) — execute an existing plan
