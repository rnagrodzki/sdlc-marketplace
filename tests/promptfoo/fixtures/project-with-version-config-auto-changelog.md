# Simulated Project Context: version-sdlc patch --auto with config.changelog=true (#219)

## Project Structure

Node.js package with semantic versioning configured. `config.changelog` is enabled
in `.claude/sdlc.json` but the user did not pass `--changelog` on the CLI — they
passed `--auto` only (typical sub-agent dispatch from ship-sdlc).

```
package.json         ← version: "0.17.43"
.claude/
  sdlc.json          ← versioning config (changelog: true)
CHANGELOG.md
src/
```

## Version Config (.claude/sdlc.json)

```json
{
  "version": {
    "mode": "file",
    "versionFile": "package.json",
    "tagPrefix": "v",
    "changelog": true,
    "changelogFile": "CHANGELOG.md"
  }
}
```

## Current Version

`package.json` version: **0.17.43**

## Git Tags

```
v0.17.43  (latest)
v0.17.42
v0.17.41
```

## Commits Since v0.17.43 (2 commits)

```
fix(scope): correct edge case in resolver
feat(scope): add new helper utility
```

## version-prepare.js Output (JSON)

```json
{
  "flow": "release",
  "config": {
    "mode": "file",
    "versionFile": "package.json",
    "tagPrefix": "v",
    "changelog": true,
    "changelogFile": "CHANGELOG.md"
  },
  "flags": {
    "changelog": true,
    "auto": true,
    "hotfix": false,
    "noPush": false,
    "init": false
  },
  "currentVersion": "0.17.43",
  "requestedBump": "patch",
  "detectedBump": "patch",
  "breakingChange": false,
  "commitCount": 2,
  "nextVersions": {
    "patch": "0.17.44",
    "minor": "0.18.0",
    "major": "1.0.0"
  },
  "tagConflicts": [],
  "remoteState": {
    "hasUpstream": true,
    "upstreamBranch": "origin/fix/some-branch"
  },
  "warnings": [],
  "errors": []
}
```

## Notes

- This fixture reproduces the issue #219 input path: `flags.changelog` resolved
  from config (no CLI flag), `flags.auto: true` (sub-agent dispatch context).
- The skill MUST gate on `flags.changelog` (not raw CLI args) per spec R18.
- Expected behavior: render "Changelog: yes" in release plan, present a draft
  CHANGELOG entry, and describe the Step 8.2 write action — even though the
  user did not type `--changelog` on the command line.
