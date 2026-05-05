---
description: Fix the github issue(s)
---

# /fix Command

Fetch one or more GitHub issues and create an implementation plan to resolve them.

## Usage

- `/fix 130` — plan a fix for issue #130
- `/fix 130 144` — plan fixes for issues #130 and #144

`$ARGUMENTS` contains the space-separated issue numbers.

## Workflow

1. **Parse issue numbers** from `$ARGUMENTS` (split on whitespace; each token is an integer issue number).

2. **Fetch each issue** with:
   ```
   gh issue view <number> --json number,title,body,labels,comments
   ```
   Collect title, body, and any clarifying comments for each issue.

3. **Invoke the `plan-sdlc` skill**, passing the aggregated issue context as requirements.
   The plan must cover every issue in the list and reference each by number (e.g., "fixes #130").
