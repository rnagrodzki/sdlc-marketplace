---
name: release-consistency
description: "Reviews version and changelog changes for consistency across plugin.json, CHANGELOG.md, version.json, and git tag references"
triggers:
  - "plugins/sdlc-utilities/.claude-plugin/plugin.json"
  - "CHANGELOG.md"
  - ".claude/version.json"
  - ".claude-plugin/marketplace.json"
skip-when:
  - "**/node_modules/**"
  - "tests/**"
severity: high
model: haiku
requires-full-diff: true
---

# Release Consistency Review

Review version and changelog changes for consistency across all release artifacts. Version numbers must agree between `plugin.json`, `CHANGELOG.md`, and `marketplace.json`. The `version.json` configuration must reference valid paths and tag prefixes. A mismatch between any of these artifacts will cause release tooling to produce incorrect tags, publish the wrong version, or leave users with a broken changelog.

## Checklist

- [ ] The version string in `plugin.json` `"version"` field matches the most recent heading in `CHANGELOG.md` — e.g., `"version": "1.2.3"` corresponds to `## [1.2.3]`
- [ ] The CHANGELOG entry for the released version includes a date in `YYYY-MM-DD` format and that date is not in the future
- [ ] CHANGELOG follows Keep a Changelog format: sections use exactly the headings `### Added`, `### Changed`, `### Fixed`, or `### Removed` — no ad-hoc section names
- [ ] `marketplace.json` plugin `name` field matches the `name` field in `plugin.json` — they must reference the same plugin identity
- [ ] `.claude/version.json` `versionFile` path still resolves to the correct `plugin.json` (the file must exist at that path relative to the project root)
- [ ] `tagPrefix` in `version.json` is consistent with existing git tags — e.g., if existing tags are `sdlc-utilities-v1.0.0` then `tagPrefix` must be `sdlc-utilities-v`, not `v` or `sdlc-v`
- [ ] No version downgrade: the new version in `plugin.json` is greater than or equal to the previous version in semver terms — patch, minor, and major increments are valid; a lower version is not
- [ ] When `plugin.json` version changes, there must be a corresponding CHANGELOG entry for that exact version — a version bump without a changelog entry is incomplete

## Severity Guide

| Finding | Severity |
|---------|----------|
| Version in plugin.json and CHANGELOG heading don't match | critical |
| plugin.json version bumped but no CHANGELOG entry | high |
| CHANGELOG date missing or in the future | high |
| Version downgrade detected | high |
| versionFile path in version.json points to wrong file | high |
| marketplace.json name mismatch with plugin.json | medium |
| tagPrefix inconsistent with existing tags | medium |
| CHANGELOG section not following Keep a Changelog format | medium |
| Minor formatting deviation in CHANGELOG | low |
