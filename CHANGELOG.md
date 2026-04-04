# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.17.12] - 2026-04-04

### Fixed
- Guardrails detection expanded to cover Lambda HTTP APIs (via @middy/ dependencies), NoSQL databases (DynamoDB, MongoDB, Redis), and framework signals (zod, sentry, datadog, esbuild) (#137, #138, #139)

## [0.17.11] - 2026-04-04

### Added
- Step-emitter architecture with shared `lib/stepper.js` module that inverts control between SDLC skill scripts and the LLM (#143)
- P-STEP, P-TRANS, and C-STEP requirement fields added to all 9 skill specifications (#143)

## [0.17.10] - 2026-04-04

### Added
- Specification files for all SDLC skills as authoritative source of truth for workflows and requirements (#133)
- Spec-compliance review dimension and plan guardrail enforcing spec-first development (#133)

### Changed
- Scripts reorganized from flat `scripts/` directory into logical subdirectories (`skill/`, `ci/`, `state/`, `util/`) with backward-compatible installation paths (#141)

## [0.17.9] - 2026-04-03

### Fixed
- received-review-sdlc now supports `--auto` flag to skip consent gate and auto-implement review fixes in the ship pipeline (#117)

## [0.17.8] - 2026-04-03

### Added
- OpenSpec documentation section on the site — landing page, overview, integration guide, and handover workflow pages with navigation dropdown and cross-linking (#127)

## [0.17.7] - 2026-04-02

### Added
- OpenSpec integration bridge with stage hints for bidirectional workflow between OpenSpec specification and SDLC planning (#125)

### Fixed
- plan-sdlc now correctly captures plan-prepare.js exit code in VERBATIM block (#125)

## [0.17.6] - 2026-04-01

### Changed
- Execution presets renamed from A/B/C to full/balanced/minimal with backward compatibility for legacy values (#114)
- YAGNI added as a default guardrail proposal alongside existing DRY and KISS (#120)

## [0.17.5] - 2026-04-01

### Fixed
- Atomic state file writes to prevent corruption from parallel worktree access (#109)
- Ship pipeline sub-skills dispatched as Agents to eliminate context pollution in later steps (#119)
- `skipSource` field added to ship-prepare.js step output for skip-flag provenance tracking (#118)
- Network-dependent commands gain retry logic via `retryExec` helper with exponential backoff (#116)

## [0.17.4] - 2026-04-01

### Fixed
- commit-sdlc "Prompt is too long" error when staging large diffs — truncates diffs to an 8000-character budget, keeping the largest file diffs and using diffstat for the rest (#115)

## [0.17.3] - 2026-04-01

### Added
- Execution guardrails evaluation (pre-wave and post-wave checks) with separate `execute.guardrails[]` config section (#103)
- `/setup-sdlc --execution-guardrails` sub-flow for configuring runtime guardrails (#103)

### Fixed
- Guardrail proposal generation for execute context now uses execution-specific descriptions (#103)

## [0.17.2] - 2026-04-01

### Fixed
- Script resolution `find` patterns now scoped to `*/sdlc*` to prevent cross-plugin collisions (#111)
- Auto mode execution no longer resumes from stale state files without explicit `--resume` (#110)
- Synced plan-sdlc and execute-plan-sdlc docs with SKILL.md changes (#107, #108, #110)
- received-review-sdlc fallback pattern aligned with other skills (#111)

### Changed
- Plan handoff menu now offers ship (full pipeline) as the primary option (#108)
- Ship pipeline includes context budget awareness guidance for inter-step compaction (#105)
- Plan approval output no longer includes wave preview (#107)

### Added
- DRY and KISS plan guardrails

## [0.17.1] - 2026-03-31

### Fixed
- False gitignore warning when `.sdlc/.gitignore` exists instead of root `.gitignore` entry (#99)
- `mktemp` collision in prepare script invocations — replaced with script-driven `--output-file` flag using crypto-random temp filenames (#101)
- `execute-plan-sdlc` interactive prompts when config provides all answers — added `--auto` flag for non-interactive execution (#104)
- Auto-mode workspace default now overrides from `prompt` to `branch` in ship-prepare.js (#104)
- Missing prefix argument in `jira-prepare.js` `writeOutput` call causing wrong exit code

### Changed
- Migrated legacy unit tests to promptfoo exec datasets (#100)
- `validate-plugin-consistency` now checks for `--output-file` instead of `mktemp`

## [0.17.0] - 2026-03-31

### Changed
- Consolidated review-init-sdlc, pr-customize-sdlc, and guardrails-init-sdlc into setup-sdlc as internal sub-flows with `--dimensions`, `--pr-template`, and `--guardrails` flags (#94)

## [0.16.13] - 2026-03-31

### Added
- Custom plan guardrails support — configurable `plan.guardrails[]` in sdlc.json with interactive `/guardrails-init-sdlc` skill for project-aware proposal generation (#91)

### Fixed
- Review dimension detection in guardrails-prepare.js now correctly identifies `.md` dimension files

## [0.16.12] - 2026-03-31

### Fixed
- Ship pipeline LLM now uses computed `invocation` field from ship-prepare.js output instead of copying hardcoded example args from SKILL.md (#97)

## [0.16.11] - 2026-03-31

### Added
- Configurable message patterns for commit and PR skills
- New review dimensions: dependency-management and ui-review

## [0.16.10] - 2026-03-31

### Fixed
- Worktree PRs no longer fail CI version check — `pr-sdlc` now accepts `--label` flag for forced labels, and `ship-sdlc` auto-applies `skip-version-check` when workspace is worktree (#88)

## [0.16.9] - 2026-03-31

### Fixed
- `setup-sdlc` now detects stale `ship` sections left in project config after migration and triggers cleanup automatically (#90)

## [0.16.8] - 2026-03-31

### Added
- Unified configuration: consolidates 4 config files into 2 (`sdlc.json` + `local.json`) with centralized `lib/config.js` and `/setup-sdlc` skill for one-step project initialization (#86)
- Hook-based context injection: session-start hook detects pipeline resume, OpenSpec context, git status, Jira cache staleness, and ship config; adds PostToolUse and PreCompact hooks for workflow awareness (#85)

### Fixed
- Ship config section moved from project config to local config; legacy fallback now resolves review and ship sections independently instead of returning early on first match (#87)

## [0.16.7] - 2026-03-30

### Added
- JSON Schema definitions for all SDLC configuration files — enables IDE autocompletion and inline validation for ship-config, review-config, version-config, jira-config, plugin.json, ship-state, execute-state, and review-dimension frontmatter (#80)

### Changed
- User-local SDLC state (review.json, jira-cache/) migrated from `.claude/` to `.sdlc/` with backward-compatible fallback reads and deprecation warnings (#81)
- `$schema` references in ship-config.json and version.json updated from placeholder labels to resolvable raw GitHub URLs

## [0.16.6] - 2026-03-30

### Added
- SessionStart hook that outputs plugin version and skill count into every session's system-reminder context (#82)
- Per-skill version announcement for all 11 user-invocable skills — extracts version from session-start hook output at runtime (#82)

## [0.16.5] - 2026-03-29

### Fixed
- `--workspace worktree` flag now creates actual git worktrees via `worktree-create.js` instead of falling back to branch checkout (#78)
- State file I/O moved from LLM instructions to deterministic scripts (`ship-state.js`, `execute-state.js`, `lib/state.js`)
- Branch name validation in worktree creation prevents command injection via shell metacharacters
- State file slug matching uses delimiter-aware patterns to prevent partial branch name collisions
- Missing flags restored in argument-hint frontmatter: ship-sdlc (`--resume`, `--bump`, `--workspace`, `--init-config`) and execute-plan-sdlc (`--workspace`, `--rebase`)

## [0.16.4] - 2026-03-29

### Added
- `--auto` flag for version-sdlc — skips interactive release approval prompt while retaining critique gates and pre-condition checks (#73)
- `ship-sdlc` now forwards `--auto` to version-sdlc, removing the last mandatory pause point in fully automated pipelines

## [0.16.3] - 2026-03-29

### Fixed
- GitHub hosting detection in `review-init-sdlc` now handles custom SSH aliases via multi-signal cascade (#70)

## [0.16.2] - 2026-03-29

### Added
- New review dimensions for expanded code analysis coverage

### Fixed
- Resolved issues #66 and #68

## [0.16.1] - 2026-03-28

### Added
- Pause/resume support for `execute-plan-sdlc` — writes execution state to `.sdlc/execution/` after each wave, enabling cross-session resume via `--resume` flag (#67)
- `ship-sdlc` forwards `--resume` to `execute-plan-sdlc` when resuming a pipeline with an in-progress execute step

## [0.16.0] - 2026-03-27

### Added
- `ship-sdlc` skill for end-to-end feature shipping — chains execute, commit, review, fix, version, and PR creation in a single pipeline (#60)
- Full orchestration workflow page on the documentation site
- Ship pipeline visualization component for the docs site

### Changed
- Redesigned documentation site skill pages and workflow navigation

## [0.15.2] - 2026-03-27

### Added
- `--auto` flag for commit-sdlc — skips interactive approval prompt while retaining all critique gates (#58)
- `--auto` flag for pr-sdlc — skips interactive approval prompt and auto-applies inferred labels (#59)

### Changed
- PR description "Changes Overview" section now requires concept-level bullets describing behavior changes instead of file-path listings (#62)
- Auto-label inference in pr-sdlc applies labels directly without a separate approval prompt in auto mode (#61)
- Reordered "What's Next" suggestions in commit-sdlc and execute-plan-sdlc to list review before PR creation

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
