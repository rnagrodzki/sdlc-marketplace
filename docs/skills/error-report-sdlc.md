# `error-report-sdlc` — Error-to-Jira Issue Proposal

## Overview

Internal skill that proposes creating a Jira issue when an SDLC skill encounters an actionable error. When invoked by another skill's error handling path, it verifies Jira availability, asks for user consent (two gates), assembles a structured issue from the error context, and creates the issue via the jira-sdlc cache and Atlassian MCP tools. Non-user-invocable — it only runs when explicitly dispatched from within another skill.

---

## Usage

This skill is not user-invocable. It is dispatched internally by other skills at specific error handling points. The calling skill provides error context; this skill handles the rest.

To add error-reporting to a skill, insert this block at each issue-worthy error point in the skill's SKILL.md:

```text
**Error-to-Jira proposal** (optional — requires jira-sdlc):

If this error is issue-worthy (see error classification in error-report-sdlc/REFERENCE.md),
locate the procedure: Glob for `**/error-report-sdlc/REFERENCE.md` under `~/.claude/plugins`,
then cwd fallback. If found, follow the procedure with this context:

- **Skill**: {this skill's name}
- **Step**: {current step number and name}
- **Operation**: {what was being attempted}
- **Error**: {full error details}
- **Suggested investigation**: {skill-specific diagnostic hint}

If the file is not found, skip — the capability is not installed.
```

---

## Flags

This skill has no flags. It is configured entirely by the context provided by the calling skill.

---

## Examples

### Skill author adopting the error proposal (pr-sdlc, exit code 2)

When `pr-prepare.js` crashes (exit code 2), pr-sdlc calls this skill with:

```text
- Skill: pr-sdlc
- Step: Step 0 — pr-prepare.js execution
- Operation: Running pr-prepare.js to pre-compute PR context
- Error: Exit code 2 — Script error (see output above)
- Suggested investigation: Check Node.js version, verify pr-prepare.js is not corrupted,
  inspect stderr for the stack trace
```

The skill then:
1. Verifies jira-prepare.js is available and a project key is resolvable
2. Offers: `This error may be worth tracking as a Jira issue. Create one? (yes / no)`
3. If yes: assembles and presents a draft issue for review
4. If confirmed: creates the issue and reports the key + URL

### User sees (on yes → yes)

```text
This error may be worth tracking as a Jira issue. Create one? (yes / no)
> yes

Proposed Jira Issue:
───────────────────────────────────────────
Title:    [pr-sdlc] pr-prepare.js crashed with exit code 2
Type:     Bug
Priority: High
Labels:   tooling-error, pr-sdlc

Description:
## Error Summary
pr-prepare.js crashed unexpectedly during PR context collection.
...
───────────────────────────────────────────
Create this issue? (yes / edit / cancel)
> yes

Jira issue created: PROJ-142 — https://your-org.atlassian.net/browse/PROJ-142
```

---

## Prerequisites

- **jira-sdlc installed**: The sdlc plugin must be installed and `jira-prepare.js` must be resolvable via `find ~/.claude/plugins -name "jira-prepare.js"`
- **Jira project key**: Resolvable from the git branch (pattern `[A-Z]{2,10}-\d+`) or `.claude/jira-config.json`
- **Atlassian MCP connected**: An Atlassian MCP server must be configured in the session

If any prerequisite is missing, the proposal is silently skipped — no error shown to the user.

---

## What It Creates or Modifies

| File / Artifact | Description |
|---|---|
| Jira issue (external) | A Bug-type issue in the resolved project, created only after explicit user confirmation |

No local files are created or modified by this skill.

---

## Related Skills

- [`/jira-sdlc`](jira-sdlc.md) — Full Jira issue management; error-report-sdlc reuses its cache and creation pattern
- [`/pr-sdlc`](pr-sdlc.md) — Adopts error reporting at Step 0 (script crash) and Step 6 (gh failure)
- [`/version-sdlc`](version-sdlc.md) — Adopts error reporting at Step 0 (script crash) and Step 8 (git failure)
- [`/review-sdlc`](review-sdlc.md) — Adopts error reporting at Step 0 (script crash) and Step 3 (orchestrator failure)
- [`/executing-plans-smartly`](executing-plans-smartly.md) — Adopts error reporting in the Escalation Protocol (after 2 retries)
