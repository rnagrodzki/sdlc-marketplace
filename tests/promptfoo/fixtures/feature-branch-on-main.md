# Simulated Project Context: Attempted PR from Main Branch

## Git State

- **Current branch:** `main`
- **Base branch:** (none — this IS main)
- **Remote state:** up to date with origin/main

## pr-prepare.js Output (JSON)

```json
{
  "mode": "create",
  "baseBranch": "main",
  "currentBranch": "main",
  "isDraft": false,
  "existingPr": null,
  "jiraTicket": null,
  "commits": [],
  "diffStat": "",
  "remoteState": "up-to-date",
  "customTemplate": null,
  "warnings": [],
  "errors": [
    "Cannot create a PR from the 'main' branch. Switch to a feature branch first."
  ]
}
```

## Context

The user attempted to run `/pr-sdlc` while on the `main` branch. The script detected this
protected branch and returned an error. No diff or commit data is available because
the operation was blocked before any git queries were made.
