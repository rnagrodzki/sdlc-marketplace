# Simulated Project Context: Release with Jira Ticket References

## Project Structure

Node.js package with Jira ticket ID tracking enabled.

```
package.json         ← version: "2.0.0"
.claude/
  version.json       ← versioning config (changelog: true, ticketPrefix: "PROJ")
CHANGELOG.md         ← existing changelog
src/
```

## Version Config (.claude/version.json)

```json
{
  "mode": "file",
  "versionFile": "package.json",
  "fileType": "package.json",
  "tagPrefix": "v",
  "changelog": true,
  "changelogFile": "CHANGELOG.md",
  "ticketPrefix": "PROJ"
}
```

## Current Version

`package.json` version: **2.0.0**

## Git Tags

```
v2.0.0  (latest)
v1.9.0
v1.8.0
```

## Commits Since v2.0.0 (3 commits)

```
feat(api): add webhook delivery for all event types PROJ-123
fix(auth): resolve token refresh race condition (PROJ-456)
feat(notifications): add email digest scheduling
```

Commit bodies:
- `feat(api)`: "Implements webhook delivery. Closes PROJ-123. Supports retry with exponential backoff."
- `fix(auth)`: "Fixes PROJ-456. Token refresh now uses a mutex lock to prevent concurrent requests."
- `feat(notifications)`: No body, no ticket ID.

## version-prepare.js Output (JSON) — flow: "release"

```json
{
  "flow": "release",
  "errors": [],
  "warnings": [],
  "config": {
    "mode": "file",
    "versionFile": "package.json",
    "fileType": "package.json",
    "tagPrefix": "v",
    "changelog": true,
    "changelogFile": "CHANGELOG.md",
    "ticketPrefix": "PROJ"
  },
  "currentVersion": "2.0.0",
  "currentBranch": "feat/webhooks",
  "versionSource": {
    "relativePath": "package.json",
    "currentVersion": "2.0.0",
    "isValid": true
  },
  "requestedBump": "minor",
  "bumpOptions": {
    "major": "3.0.0",
    "minor": "2.1.0",
    "patch": "2.0.1"
  },
  "flags": {
    "noPush": false,
    "changelog": true,
    "preLabel": null,
    "hotfix": false
  },
  "tags": {
    "latest": "v2.0.0",
    "latestVersion": "2.0.0",
    "tagPrefix": "v",
    "conflictsWithNext": {
      "major": false,
      "minor": false,
      "patch": false,
      "preRelease": false
    }
  },
  "commits": [
    {
      "hash": "a1b2c3d4",
      "subject": "feat(api): add webhook delivery for all event types PROJ-123",
      "body": "Implements webhook delivery. Closes PROJ-123. Supports retry with exponential backoff.",
      "coAuthors": [],
      "type": "feat",
      "scope": "api",
      "breaking": false,
      "description": "add webhook delivery for all event types PROJ-123",
      "ticketIds": ["PROJ-123"]
    },
    {
      "hash": "e5f6g7h8",
      "subject": "fix(auth): resolve token refresh race condition (PROJ-456)",
      "body": "Fixes PROJ-456. Token refresh now uses a mutex lock to prevent concurrent requests.",
      "coAuthors": [],
      "type": "fix",
      "scope": "auth",
      "breaking": false,
      "description": "resolve token refresh race condition (PROJ-456)",
      "ticketIds": ["PROJ-456"]
    },
    {
      "hash": "i9j0k1l2",
      "subject": "feat(notifications): add email digest scheduling",
      "body": "",
      "coAuthors": [],
      "type": "feat",
      "scope": "notifications",
      "breaking": false,
      "description": "add email digest scheduling",
      "ticketIds": []
    }
  ],
  "conventionalSummary": {
    "feat": 2,
    "fix": 1,
    "hasBreakingChanges": false,
    "suggestedBump": "minor"
  },
  "changelog": {
    "exists": true,
    "filePath": "CHANGELOG.md",
    "currentContent": "# Changelog\n\n## [Unreleased]\n\n## [2.0.0] - 2026-01-15\n\n### Added\n- GraphQL API support\n"
  },
  "remoteState": {
    "hasUpstream": true,
    "remoteBranch": "origin/feat/webhooks",
    "isAhead": true
  }
}
```
