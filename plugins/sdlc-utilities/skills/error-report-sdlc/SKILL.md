---
name: error-report-sdlc
description: "Internal skill invoked by other SDLC skills when they encounter an actionable error (script crash, CLI failure, persistent API error, build failure after retries). Proposes creating a GitHub issue in rnagrodzki/sdlc-marketplace to track the error with full context capture, two-gate user consent, and pre-flight verification. NOT user-invocable — only dispatched from within another skill's error handling path. When dispatched, follow ./REFERENCE.md for the full procedure."
user-invocable: false
---

# Error-to-GitHub Issue Proposal

Internal procedure invoked by SDLC skills when an actionable error occurs.
Captures error context, verifies gh CLI availability, gets user consent, and
creates a tracking issue in rnagrodzki/sdlc-marketplace using the gh CLI.

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
- Pre-flight verification (gh CLI availability, GitHub remote)
- Two-gate consent flow
- Issue assembly from the `./templates/ToolingError.md` template
- GitHub issue creation using `gh issue create`

## DO NOT

- Invoke this skill directly in response to user requests — it is internal only
- Create a GitHub issue without both consent gates passing
- Block or replace the calling skill's normal error handling
- Create issues in a repository other than rnagrodzki/sdlc-marketplace
