# Simulated Project Context: Project with Version Config and Breaking Change

## Project Structure

Node.js package with semantic versioning configured.

```
package.json         ← version: "2.1.0"
.claude/
  version.json       ← versioning config
CHANGELOG.md
src/
```

## Version Config (.claude/version.json)

```json
{
  "mode": "file",
  "versionFile": "package.json",
  "tagPrefix": "v",
  "changelog": false
}
```

## Current Version

`package.json` version: **2.1.0**

## Git Tags

```
v2.1.0  (latest)
v2.0.0
v1.5.2
v1.0.0
```

## Commits Since v2.1.0 (4 commits)

```
feat!: remove deprecated /api/v1 endpoints (BREAKING CHANGE: v1 API removed)
feat(api): add bulk operations endpoint
fix(auth): correct token validation edge case
chore(deps): bump express from 4.18 to 4.19
```

## version-prepare.js Output (JSON)

```json
{
  "flow": "release",
  "config": {
    "mode": "file",
    "versionFile": "package.json",
    "tagPrefix": "v",
    "changelog": false
  },
  "currentVersion": "2.1.0",
  "requestedBump": "patch",
  "detectedBump": "major",
  "breakingChange": true,
  "breakingChangeDetails": "feat!: remove deprecated /api/v1 endpoints",
  "commitCount": 4,
  "nextVersions": {
    "patch": "2.1.1",
    "minor": "2.2.0",
    "major": "3.0.0"
  },
  "tagConflicts": [],
  "warnings": ["Breaking change detected in commits. A major bump (3.0.0) is strongly recommended over the requested patch (2.1.1)."],
  "errors": []
}
```
