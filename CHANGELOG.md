# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.12.1] - 2026-03-19

### Added
- New documentation pages

## [0.12.0] - 2026-03-19

### Added
- New planning skill for designing multi-step implementation plans before writing code

### Changed
- Plans directory location updated
- Execution mode simplified

## [0.11.5] - 2026-03-18

### Added
- Guardrails for skill execution to prevent unsafe automated behavior

### Changed
- Execution mode now propagates consistently across skill invocations
- Improved bypass permissions handling during skill execution

## [0.11.4] - 2026-03-18

### Changed
- Enabled changelog generation as part of the release workflow
- Improved versioning behavior and configuration

## [0.11.3] - 2026-03-16

### Added
- `commit-sdlc` skill for generating conventional commit messages from staged changes
- Model presets support in `execute-plan-sdlc` for configuring Claude model selection per task

## [0.11.2] - 2026-03-13

### Fixed
- `error-report-sdlc` now files issues in GitHub instead of Jira for broader compatibility

## [0.11.1] - 2026-03-13

### Added
- `error-report-sdlc` skill for proposing GitHub issues when actionable errors occur in SDLC skills
- Permanent Jira metadata cache in `jira-sdlc` to reduce redundant API calls

## [0.11.0] - 2026-03-13

### Added
- `jira-sdlc` skill for creating, editing, searching, transitioning, and linking Jira issues via Atlassian MCP

## [0.10.0] - 2026-03-12

### Added
- `execute-plan-sdlc` skill for adaptive parallel plan execution with wave dependency management
- `review-receive-sdlc` skill for responding to code review feedback with dual self-critique gate

## [0.9.0] - 2026-03-12

### Changed
- All skills renamed to action-first naming convention (e.g. `pr-sdlc`, `review-sdlc`, `version-sdlc`)
- Removed legacy `commands/` layer; all functionality now delivered through skills

## [0.8.1] - 2026-03-08

### Added
- Smarter review dimension suggestions for files not covered by existing dimensions in `review-init-sdlc`

## [0.8.0] - 2026-03-08

### Added
- `--hotfix` flag to `version-sdlc` for annotating releases with DORA metrics metadata

## [0.7.3] - 2026-03-08

### Added
- `test-report` and `promptfoo-results` skills for analyzing promptfoo BDD test results and generating evidence reports

## [0.7.2] - 2026-03-08

### Added
- `promptfoo` BDD test suite for automated SDLC skill behavior validation

## [0.7.1] - 2026-03-06

### Fixed
- Script resolution moved into skills to prevent path-dependent failures; simplified `find` commands

## [0.7.0] - 2026-03-06

### Added
- `plugin-check` command for validating plugin discovery and installation

## [0.6.3] - 2026-03-05

### Added
- Review scope options (`committed`, `staged`, `working`, `worktree`) for `review-sdlc`

## [0.6.2] - 2026-03-05

### Fixed
- Script resolution order corrected to prevent plugin scripts from shadowing project-local scripts
- Plugin consistency validation added to catch structural issues before they reach users

## [0.6.1] - 2026-03-05

### Added
- GitHub Copilot instructions generation in `review-init-sdlc`

## [0.6.0] - 2026-03-04

### Changed
- All skills renamed with `sdlc-` prefix for namespace clarity
- Added per-skill reference documentation

## [0.5.3] - 2026-03-04

### Fixed
- Git identity now configured correctly in the `retag-release` CI workflow
- Automated tag repair CI workflow now triggers correctly on push to main

## [0.5.2] - 2026-03-04

### Added
- `retag-release.yml` CI workflow to automatically repair orphaned tags after squash merges to main

## [0.5.1] - 2026-03-04

### Added
- `version-sdlc` skill for semantic version management (bump, tag, changelog, push)
- `pr-customize-sdlc` skill for creating and managing custom PR templates
- Review orchestrator now requires explicit user approval before executing review steps

### Fixed
- Script paths updated to use absolute resolution for cross-platform compatibility
- Portable glob patterns for script and agent references
