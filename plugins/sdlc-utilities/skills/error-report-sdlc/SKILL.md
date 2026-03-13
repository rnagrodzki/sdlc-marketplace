---
name: error-report-sdlc
description: "Internal skill invoked by other SDLC skills when they encounter an actionable error (script crash, CLI failure, persistent API error, build failure after retries). Proposes creating a Jira issue to track the error with full context capture, two-gate user consent, and pre-flight verification. NOT user-invocable — only dispatched from within another skill's error handling path. When dispatched, follow ./REFERENCE.md for the full procedure."
user-invocable: false
---

# Error-to-Jira Issue Proposal

Internal procedure invoked by SDLC skills when an actionable error occurs.
Captures error context, verifies Jira availability, gets user consent, and
creates a tracking issue using the jira-sdlc cache and Atlassian MCP tools.

## When This Skill Is Invoked

Another skill explicitly directs Claude here after encountering an issue-worthy
error. The calling skill provides:

- **Skill**: which skill encountered the error
- **Step**: which step/operation failed
- **Operation**: what was being attempted
- **Error**: full error details (exit code, message, HTTP status)
- **Suggested investigation**: skill-specific diagnostic hints

## Procedure

Follow `./REFERENCE.md` for the complete step-by-step procedure, including:

- Error classification (issue-worthy vs. not)
- Pre-flight verification (Jira availability, project key resolution)
- Two-gate consent flow
- Issue assembly from the `./templates/ToolingError.md` template
- Jira creation using the jira-sdlc cache and `mcp__atlassian__createJiraIssue`

## DO NOT

- Invoke this skill directly in response to user requests — it is internal only
- Create a Jira issue without both consent gates passing
- Block or replace the calling skill's normal error handling
- Initialize a new jira-sdlc cache — use the existing one or skip if absent
