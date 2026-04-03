# version-sdlc Specification

> Execute a semantic release workflow: version bump, annotated git tag, optional CHANGELOG entry, release commit, and push to origin. Also supports one-time init setup and standalone changelog updates.

**User-invocable:** yes
**Model:** sonnet
**Prepare script:** `version-prepare.js`

## Arguments

- A1: `major|minor|patch` — explicit bump type (default: auto-detected from conventional commits)
- A2: `--pre <label>` — create or increment a pre-release version with the given label (e.g., beta, rc) (default: none)
- A3: `--changelog` — generate or update a CHANGELOG entry; without a bump type, enters changelog-update workflow (default: from config)
- A4: `--hotfix` — mark release as a hotfix for DORA metrics tracking (default: false)
- A5: `--auto` — skip interactive approval prompts; critique gates still run (default: false)
- A6: `--init` — run one-time init workflow to scaffold versioning infrastructure (default: false)
- A7: `--no-push` — skip pushing to remote after release (default: false)

## Core Requirements

- R1: Three distinct workflow branches determined by `flow` field: init, release, changelog-update
- R2: Determine bump type from explicit argument, or auto-detect from conventional commit summary; inform user of auto-selection rationale
- R3: When `hasBreakingChanges` is true and chosen bump is not major (and not pre-release), warn the user and suggest major bump
- R4: Pre-release handling: `--pre` with bump type computes from base version; `--pre` alone increments existing pre-release counter
- R5: CHANGELOG entry uses Keep a Changelog format with today's date, mapping commit types to sections (feat→Added, fix→Fixed, refactor/perf→Changed)
- R6: Skip non-user-facing commit types in CHANGELOG (chore, docs, test, ci, build, style) unless clearly user-facing
- R7: When `config.ticketPrefix` is set, append extracted ticket IDs to changelog entries
- R8: Version file update uses targeted Edit (not full rewrite) for TOML/YAML files
- R9: Annotated tag includes hotfix type annotation when `flags.hotfix` is true
- R10: Release commit message includes `[hotfix]` suffix when `flags.hotfix` is true
- R11: Push requires both `git push` and `git push --tags` (two separate commands)
- R12: When `--auto` is set, skip AskUserQuestion prompts but display the release plan and run all critique gates
- R13: Verify pre-conditions before execution: version file exists (file mode), tag does not conflict, no uncommitted changes, git identity configured

## Workflow Phases

1. CONSUME — read pre-computed context from `version-prepare.js` output (current version, commits, config, flags, bump options)
2. PLAN — determine bump type, compute new version, draft CHANGELOG entry if enabled
3. CRITIQUE — self-review against all 7 quality gates
4. IMPROVE — fix failing gates (max 2 iterations per gate)
5. DO — present release plan, obtain approval (or auto-approve), verify pre-conditions, execute release sequence (version file update, changelog, stage, commit, tag, push)
6. CRITIQUE — verify release completed (commit exists, tag exists, push succeeded)

## Quality Gates

- G1: Semver correctness — new version is valid semver (`major.minor.patch[-pre]`, no leading zeros)
- G2: Breaking change bump — if `hasBreakingChanges`, bump is major or is a pre-release (warn otherwise)
- G3: Tag conflict — new tag does not already exist (`conflictsWithNext[bumpType]` is false)
- G4: Changelog completeness — all user-facing commits (feat/fix) are represented (when changelog enabled)
- G5: No fabricated entries — every CHANGELOG entry traces to a real commit (when changelog enabled)
- G6: Commit count — there are commits to release (`commits.length > 0`), or this is a pre-release
- G7: Version file writable — file type is in the known supported list

## Prepare Script Contract

- P1: `versionSource.currentVersion` (string) — current version string
- P2: `config.mode` (string: "file" | "tag") — version storage mode
- P3: `config.changelog` (boolean) — whether changelog is enabled by default
- P4: `config.ticketPrefix` (string | null) — Jira/project key prefix for ticket ID extraction
- P5: `requestedBump` (string | null: "major" | "minor" | "patch") — explicitly requested bump type
- P6: `conventionalSummary.suggestedBump` (string) — auto-detected bump type from commits
- P7: `conventionalSummary.hasBreakingChanges` (boolean) — whether any commit is a breaking change
- P8: `bumpOptions` (object: `{ major, minor, patch, preRelease }`) — pre-computed next versions
- P9: `tags.latest` (string) — most recent tag
- P10: `commits` (array) — commits since last tag, each with optional `ticketIds`
- P11: `flags` (object: `{ preLabel, noPush, changelog, hotfix, auto }`) — parsed CLI flags
- P12: `conflictsWithNext` (object: `{ major, minor, patch }`) — whether each tag already exists

## Error Handling

- E1: `version-prepare.js` exit 1 → show `errors[]`, stop (no error report)
- E2: `version-prepare.js` exit 2 (crash) → show stderr, invoke error-report-sdlc
- E3: Tag already exists → suggest next available version, let user choose (no error report)
- E4: `git commit` fails → show error, invoke error-report-sdlc if non-hook failure
- E5: `git tag` fails → show error, invoke error-report-sdlc if non-duplicate failure
- E6: `git push --tags` fails → show error, invoke error-report-sdlc if non-auth failure
- E7: Uncommitted changes warning → use AskUserQuestion (proceed / commit first / cancel)

## Constraints

- C1: Must not execute any git command before explicit approval or auto-mode implicit approval
- C2: Must not fabricate commit descriptions or changelog entries not backed by real commits
- C3: Must not skip the critique step
- C4: Must not push to remote when `--no-push` is set
- C5: Must not modify the version file when `config.mode === "tag"` (version lives in git only)
- C6: Must not omit pre-condition verification before execution

## Integration

- I1: `version-prepare.js` — provides all pre-computed version context
- I2: `error-report-sdlc` — invoked on script crashes and persistent git failures
- I3: `commit-sdlc` — can be invoked when uncommitted changes need committing first
- I4: `jira-sdlc` — common follow-up to update ticket status after release
- I5: `retag-release.yml` — CI workflow scaffolded during init to handle squash-merge tag relocation
- I6: `check-changelog.js` — CI script scaffolded during init to validate changelog presence
