# Simulated Project Context: Hotfix Release (DORA Metrics)

## Project Structure

Node.js package with semantic versioning configured. A critical security bug
requires an urgent patch release marked as a hotfix for DORA metrics tracking.

```
package.json         ← version: "1.4.2"
.claude/
  version.json       ← versioning config
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

`package.json` version: **1.4.2**

## Git Tags

```
v1.4.2  (latest)
v1.4.1
v1.4.0
v1.3.0
```

## Commits Since v1.4.2 (2 commits)

```
fix(auth): patch critical session hijack vulnerability
test(auth): add regression test for session handling
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
  "currentVersion": "1.4.2",
  "requestedBump": "patch",
  "conventionalSummary": {
    "feat": 0,
    "fix": 1,
    "refactor": 0,
    "docs": 0,
    "chore": 0,
    "test": 1,
    "perf": 0,
    "other": 0,
    "hasBreakingChanges": false,
    "suggestedBump": "patch"
  },
  "bumpOptions": {
    "major": "2.0.0",
    "minor": "1.5.0",
    "patch": "1.4.3"
  },
  "flags": {
    "noPush": false,
    "changelog": false,
    "preLabel": null,
    "hotfix": true
  },
  "tags": {
    "all": ["v1.4.2", "v1.4.1", "v1.4.0", "v1.3.0"],
    "latest": "v1.4.2",
    "latestVersion": "1.4.2",
    "usesVPrefix": true,
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
      "hash": "a1b2c3d",
      "subject": "fix(auth): patch critical session hijack vulnerability",
      "body": null,
      "type": "fix",
      "scope": "auth",
      "breaking": false,
      "description": "patch critical session hijack vulnerability"
    },
    {
      "hash": "e4f5g6h",
      "subject": "test(auth): add regression test for session handling",
      "body": null,
      "type": "test",
      "scope": "auth",
      "breaking": false,
      "description": "add regression test for session handling"
    }
  ],
  "errors": [],
  "warnings": []
}
```
