# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.15.1] - 2026-03-26

### Added
- Final holistic spec completeness check (Step 8-bis) in execute-plan-sdlc — verifies cross-wave OpenSpec requirements coverage after all waves complete (#49)
- OpenSpec completion handoff in execute-plan-sdlc — suggests `/opsx:verify` and `/opsx:archive` after plan execution (#49)
- Post-merge OpenSpec guidance in pr-sdlc — suggests verification and archival steps in What's Next (#49)
- `OpenSpec-Change` commit trailer in commit-sdlc for spec-to-commit traceability (#49)

## [0.15.0] - 2026-03-26

### Added
- PR thread reply and resolve workflow in received-review-sdlc — posts replies to addressed comments and resolves threads after user consent (#50)
- Pre-compute script (`received-review-prepare.js`) for incremental review processing — skips resolved, self-replied, and stale threads (#50)
- Shared git helper library (`scripts/lib/git.js`) for PR and review data retrieval (#50)
- Interactive template suggestion in jira-sdlc `--init-templates` — proposes default templates for unmapped issue types based on Jira hierarchy level (#46)
- Unit tests for jira-prepare.js (#47)

### Changed
- jira-sdlc now captures `hierarchyLevel` in issue type metadata for hierarchy-aware template matching (#46)
- review-init-sdlc detects GitHub hosting before prompting for Copilot instructions — skips the prompt entirely for non-GitHub repos (#48)

## [0.14.7] - 2026-03-26

### Fixed
- Workspace isolation check in execute-plan-sdlc no longer relies on stale session-level branch snapshot — always detects the current branch via live git state (#55)

## [0.14.6] - 2026-03-26

### Added
- Auto-label inference in PR creation — analyzes branch name, commit messages, changed file paths, and diff size to suggest repository labels, with mandatory user approval before applying

## [0.14.5] - 2026-03-26

### Added
- Workspace isolation check in execute-plan-sdlc — detects when execution starts on the default branch and offers to create a feature branch or worktree before proceeding

### Changed
- Removed references to non-existent `plugin-check-sdlc` skill from consistency validation
- Added Github Issue section to the PR description template

## [0.14.4] - 2026-03-22

### Changed
- Updated Jira issue description templates

## [0.14.3] - 2026-03-21

### Added
- New review dimension for expanded code analysis coverage
- Autonomous detection in PR creation workflow

### Changed
- Updated GitHub Pages documentation to cover openspec workflows
- Refined openspec skill integration
- Optimized review skill performance

## [0.14.2] - 2026-03-21

### Added
- OpenSpec CLI integration for spec-driven development workflows

### Changed
- Improved skill descriptions and interaction patterns
- Updated plan skill decomposition and output

## [0.14.1] - 2026-03-20

### Added
- `argument-hint` frontmatter field across all user-invocable skills for autocomplete hints in the `/` menu
- Plan Mode detection in skills that require write operations — stops and instructs to exit plan mode before proceeding

### Changed
- User approval prompts now use `AskUserQuestion` for structured interaction
- Replaced interactive "Workflow Continuation" menus with static "What's Next" reference sections
- Improved plan-sdlc task decomposition and reviewer prompt
- Added harness integration fields documentation to the adding-skills guide

## [0.14.0] - 2026-03-20

### Added
- Consent gate in `received-review-sdlc` requiring explicit user approval before any PR changes or code modifications
- Full codebase context verification in `received-review-sdlc` — traces callers, dependents, and architectural intent instead of only checking the change diff

### Changed
- Renamed `review-receive-sdlc` to `received-review-sdlc` across all documentation, tests, and site pages
- Internal critique steps in `received-review-sdlc` no longer produce user-visible output

## [0.13.2] - 2026-03-20

### Fixed
- Fixed build configuration

## [0.13.1] - 2026-03-20

### Changed
- Refactored jira-sdlc, version-sdlc, and review-init-sdlc to use conditional loading for operation-specific content, reducing initial prompt size
- Added Gotchas, DO NOT, Error Recovery, and Workflow Continuation sections to pr-customize-sdlc and review-init-sdlc
- Added DO NOT section to review-sdlc
- Updated plan-sdlc Workflow Continuation menu to include commit option
- Added skill best practices documentation guide and removed guides section from site

## [0.13.0] - 2026-03-19

### Added
- Skills now present an interactive "what next?" menu after completing, enabling automatable chains (jira → plan → execute → commit → pr → version)
- Added `--preset` flag to `execute-plan-sdlc` to skip the A/B/C model selection prompt
- Normalized `See Also` cross-skill links and added `Related Skills` sections across all SKILL.md and docs/skills/*.md files
- Added promptfoo test datasets and fixtures for workflow continuation behavior

### Changed
- `execute-plan-sdlc` no longer shows a confirmation prompt before executing a plan (removed the "yes" confirmation gate)
- Removed duplicate skill references in nav bar

### Fixed
- Fixed skill navigation links in the site
- Fixed GitHub Pages deployment

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
- `received-review-sdlc` skill for responding to code review feedback with dual self-critique gate

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
