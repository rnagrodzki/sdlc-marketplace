# `/pr-customize-sdlc` — PR Template Setup

## Overview

Guides you through creating or editing a project-specific PR description template. Scans your project for conventions (existing GitHub PR templates, recent PR patterns, JIRA usage), proposes a tailored starter, then lets you customize it interactively. The result is saved to `.claude/pr-template.md` and used automatically by `/pr-sdlc`.

---

## Usage

```text
/pr-customize-sdlc
```

No flags.

---

## Examples

### Create a template for the first time

```text
/pr-customize-sdlc
```

```text
Scanning project for PR conventions...
  ✓ Found: .github/pull_request_template.md
  ✓ Found: JIRA references in recent commits (project key: PAY)

Proposed template based on your project:

## Summary
[1-3 sentence overview of the change]

## JIRA Ticket
[PAY-XXX link or "N/A"]

## What Changed
[Key changes grouped by concern]

## Testing
[How was this verified?]

Does this look right? (yes / edit sections / start fresh)
> yes

✓ Written: .claude/pr-template.md
  /pr-sdlc will use this template for all future PRs on this project.
```

### Edit an existing template

Running `/pr-customize-sdlc` again when `.claude/pr-template.md` exists opens the existing template for editing rather than starting over.

---

## Prerequisites

- **Git repository** — the skill scans commits and project files.
- No additional tools required.

### Harness Configuration

| Field | Value |
|---|---|
| Plan mode | Not adapted (interactive template creation) |

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| `.claude/pr-template.md` | Project PR template used by `/pr-sdlc` |

---

## Template Format

A PR template is a plain markdown file with `## Section` headings. Text under each heading is a fill instruction for the LLM — describe what should go there, not the content itself:

```markdown
## Summary
[1-3 sentence plain-language overview of the change]

## What Changed
[Describe what was changed, grouped by logical concern. No file paths.]

## Why
[Business or technical reason for this change]

## Testing
[How was this verified? Manual steps, automated tests, edge cases.]
```

## Related Skills

- [`/pr-sdlc`](pr-sdlc.md) — uses the custom template this skill creates
