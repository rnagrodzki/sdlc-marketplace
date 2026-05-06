# setup-sdlc Specification

> Unified setup skill: detect existing configuration, migrate legacy files, interactively configure missing sections, and delegate content creation (review dimensions, PR template, guardrails). Safe to re-run (idempotent).
>
> **Layout (issues #231, #232):** Project SDLC config lives at `<project>/.sdlc/config.json` (was `<project>/.claude/sdlc.json`). Local developer config remains at `<project>/.sdlc/local.json`. Review dimensions live at `<project>/.sdlc/review-dimensions/`. Learnings live at `<project>/.sdlc/learnings/log.md`. Both project and local config files carry a top-level `schemaVersion` integer (current value: `3`) verified on every skill load via `lib/config-version.js::verifyAndMigrate`. Legacy `.claude/sdlc.json` is read transparently as a fallback during the deprecation window with a single stderr deprecation warning per process.

**User-invocable:** yes
**Model:** sonnet
**Prepare script:** `skill/setup.js`

## Arguments

- A1: `--migrate` — force migration of legacy config files even if none auto-detected (default: false)
- A2: `--skip <section>` — skip a config section during setup; valid: version, ship, jira, review, commit, pr, content (default: none)
- A3: `--force` — reconfigure all sections even if already configured (default: false)
- A4: `--dimensions` — jump directly to review dimensions sub-flow (default: false)
- A5: `--pr-template` — jump directly to PR template sub-flow (default: false)
- A6: `--guardrails` — jump directly to plan guardrails sub-flow (default: false)
- A7: `--execution-guardrails` — jump directly to execution guardrails sub-flow (default: false)
- A8: `--add` — expansion mode, used with `--dimensions` or `--guardrails` (default: false)
- A9: `--no-copilot` — skip GitHub Copilot instructions, used with `--dimensions` (default: false)
- A10: `--openspec-enrich` — jump directly to openspec enrichment sub-flow (default: false)
- A11: `--remove-openspec` — remove the managed block from `openspec/config.yaml` and exit (default: false)
- A12: Flag routing: `--dimensions`, `--pr-template`, `--guardrails`, `--execution-guardrails`, `--openspec-enrich` are sugar for `--only <id>` (translated in Step 0 before the menu runs); they skip the menu and enter the corresponding sub-flow directly
- A13: `--only <ids>` — comma-separated section ids (matching `prepare.sections[].id`) configured non-interactively; skips the Step 1 menu (default: none). Legacy direct-entry flags (`--dimensions` etc.) are sugar for `--only <id>`.

## Core Requirements

- R1: 5-step workflow: Pre-flight → Status Report → Migration → Config Builder → Content Setup → Summary
- R2: Flag routing: `--dimensions`, `--pr-template`, `--guardrails`, `--execution-guardrails` each bypass main flow and enter their sub-flow directly after pre-flight
- R3: Migration logic: detect legacy config files (version.json, ship-config.json, review.json), offer merge into unified config, optionally delete originals
- R4: Config builder walks through missing sections interactively: version, ship, jira, review, commit patterns, PR title patterns
- R5: Idempotent: re-run safe via read-merge-write (`writeProjectConfig`, `writeLocalConfig` from `lib/config.js`)
- R6: Config writes go through `util/setup-init.js` which calls `lib/config.js` functions. The script deterministically creates `.sdlc/` directory, `.sdlc/.gitignore`, and config files — never use Edit/Write tools directly on config files
- R7: Early exit when everything is configured, no migration needed, and `--force` not passed
- R8: Ship config is developer-local (`.sdlc/local.json`, gitignored), not project-level
- R9: Content setup sub-flows: review dimensions (`setup-dimensions.md`), PR template (`setup-pr-template.md`), plan guardrails (`setup-guardrails.md`), execution guardrails (`setup-execution-guardrails.md`), PR labels (`setup-pr-labels.md`)
- R9a: PR labels sub-flow (`setup-pr-labels.md`, [issue #197](https://github.com/rnagrodzki/sdlc-marketplace/issues/197)) — section id `pr-labels`, configFile `.sdlc/config.json`, configPath `pr.labels`, `delegatedTo: 'setup-pr-labels'`. Writes a `pr.labels` block matching `schemas/sdlc-config.schema.json#$defs/prLabelsSection`: `mode: "off" | "rules" | "llm"`, optional `rules: { label, when }[]`. The sub-flow runs `gh label list` for the picker, presents an idempotency prompt (`keep`/`replace`/`append`) when the block already exists, and merges into the existing `pr` section without clobbering siblings (`titlePattern`, `allowedTypes`, etc.). The default state for projects that never run this sub-flow is "no `pr.labels` key" — `pr-sdlc` Step 2b interprets that as `mode = "off"`.
- R10: Project scan phase runs before content sub-flows to collect signals (dependencies, framework, CI, DB, tests, etc.)
- R11: Version section requires `mode` field (required by schema): `"file"` when version file detected, `"tag"` when not. Optional fields include `versionFile`, `fileType`, `tagPrefix`, `changelog`, `changelogFile`, `ticketPrefix`, and `preRelease`. The `preRelease` field, when set, is a string matching `^[a-z][a-z0-9]*$` that supplies a default pre-release label to version-sdlc when the user runs `version-sdlc` without an explicit base bump or `--pre`. Empty / skipped answers omit the field; the schema (`schemas/sdlc-config.schema.json`) does not require it.
- R12: Prepare script output is the single authoritative source for all contracted fields (P-fields) — script-provided values take unconditional precedence over skill-generated content, and all factual context (git state, config, flags, metadata) must originate from script output to ensure deterministic behavior
- R13: Content sub-flows (setup-dimensions, setup-pr-template, setup-guardrails) inherit the parent skill's permission mode. Sub-flows MUST NOT call ExitPlanMode, change permission settings, or exit any mode.
- R14: Scan phase (R10) MUST use the Glob tool for all file/directory existence checks. Bash MUST NOT be used with glob patterns — zsh errors on unmatched globs. Bash is permitted only for `git`, `gh`, and `which` commands.
- R15: Ship config field enumeration (Step 3b) is authoritative from prepare script output P7 (`shipFields`). The skill MUST iterate every entry in `shipFields` and dispatch one `AskUserQuestion` per field — it MUST NOT hand-enumerate the field list or short-circuit the loop. Ship config writes use answers collected in this loop plus defaults for any field the user explicitly deferred. The `shipFields` contract emits a `steps` multi-select field (canonical step list) and the resulting config write is persisted at top-level schema `version: 2`. The contract MUST NOT emit a `preset` field or a `skip` field — those are legacy CLI-only sugar handled at parse time, not config-level fields.
- R16: When `openspec/config.yaml` is detected during full-interactive setup (Step 4 content menu), prompt the user to apply managed-block enrichment (default: yes). Detection uses prepare script output field `openspecConfig.exists`.
- R17: Enrichment uses a string-delimited managed block (`# BEGIN MANAGED BY sdlc-utilities (vN)` … `# END MANAGED BY sdlc-utilities (vN)`) with a plugin-owned version marker. The block is appended, updated, or left unchanged by `scripts/util/openspec-enrich.js`.
- R18: Re-running setup on an already-enriched config at the current plugin version is a no-op (exit 0, action: `"unchanged"`)
- R19: Version mismatch between the in-file managed block and the plugin-shipped version triggers an `update` action (block text replaced in place)
- R20: `--openspec-enrich` flag provides direct entry to the openspec enrichment sub-flow, bypassing the main config builder (same pattern as `--dimensions`, `--pr-template`)
- R21: `--remove-openspec` flag removes the managed block (restores user-authored content verbatim) and exits
- R22: Content outside the managed block is never modified. If the config file lacks a section where the block would naturally fit, the managed block is appended at end-of-file with a preceding blank line.
- R23: Setup writes a managed gitignore block to the consumer project root `.gitignore` listing all transient skill artifact patterns (`*-context-*.json`, `*-manifest-*.json`, `*-prepare-*.json`). The block is delimited by `# >>> sdlc-utilities managed (do not edit) — transient skill artifacts` / `# <<< sdlc-utilities managed` markers and is idempotent — re-runs replace the contents in place rather than duplicating. Existing user-authored content in `.gitignore` is preserved; the block is appended (creating `.gitignore` if absent) or updated in place if already present. The block is project-agnostic and ships to every consumer of the plugin (issue #209). Implementation: `lib/config.js::ensureRootGitignore`, called from `util/setup-init.js`.
  - Acceptance: `ensureRootGitignore(<empty dir>)` returns `'created'` and writes a `.gitignore` containing all three patterns; a second call returns `'unchanged'`; calling against an existing `.gitignore` preserves user content (e.g., `node_modules/`) and appends the block; `git check-ignore commit-context-abc.json pr-context-x.json review-manifest-y.json ship-prepare-z.json` exits 0 in any consumer project that ran setup-sdlc.
- R-menu-1: Step 1 renders a single multi-select menu populated from `prepare.sections[]`. Every visible row, badge, and per-option description is sourced from `scripts/lib/setup-sections.js` — SKILL.md MUST NOT hardcode option labels.
- R-menu-2: Each menu row shows the section's state badge (`set` | `not-set` | `legacy`) computed from detection state (project config presence, local config, legacy file presence, `localIsV1`, openspec managed-block version).
- R-menu-3: Migration rows are auto-selected and locked when `needsMigration === true` AND the row's `state === 'legacy'`. Locked rows refuse uncheck and always proceed into Step 3.
- R-menu-4: Only sections present in the user's selection (from menu confirm OR `--only <ids>`) enter the Step 3 dispatch loop. Unselected sections are not configured.
- R-menu-5: Empty selection at the menu (when `--only` was not passed) exits cleanly with a "no changes" summary; no config files are written.
- R-verbose-1: Each section sub-flow in Step 3 prints a verbose header sourced from `prepare.sections[i]` BEFORE any AskUserQuestion: a `Purpose:` line, a `Files modified:` line, a `Consumed by:` line, a `Config file:` line, and a `Current value:` line. For sections with non-empty `fields[]`, the header is followed by an `Options:` block listing every field's name, type, default, and description.
- R-verbose-2: All option copy (purpose, per-field description, default, options) comes from `scripts/lib/setup-sections.js` (single source of truth). SKILL.md MUST NOT duplicate or paraphrase that copy.
- R-layout-1 (issue #231): Project config writes target `.sdlc/config.json`. Direct writes to `.sdlc/config.json` are obsolete. `util/setup-init.js` creates the `.sdlc/` directory if missing and writes `.sdlc/config.json`. The pre-existing requirement R6 ("Config writes go through `util/setup-init.js` which calls `lib/config.js` functions") is preserved; only the on-disk path target changes.
- R-layout-2 (issue #231): Initial project-config write stamps `schemaVersion: 3` (the current `CURRENT_SCHEMA_VERSION` exported from `scripts/lib/config-version.js`). Initial local-config write stamps `schemaVersion: 3` (replacing the legacy top-level `version: 2` integer; the field is renamed as part of the v2→v3 migration step).
- R-layout-3 (issue #231): During Phase 3 (Migration), setup-sdlc invokes `consolidateLegacyFiles()` (renamed from `migrateConfig()`) for legacy file consolidation, then invokes `scripts/skill/migrate-config.js` (which calls `verifyAndMigrate(projectRoot, 'project')` and `verifyAndMigrate(projectRoot, 'local')`) for schema migration. The two operations are distinct: `consolidateLegacyFiles()` merges historical separate config files (version.json, ship-config.json, review.json) into the unified config; `verifyAndMigrate()` walks the schema-version migration registry. They run in this order during setup; `verifyAndMigrate()` runs on every skill load thereafter.
- R-layout-4 (issue #231): `.sdlc/.gitignore` content is selective. The managed block lists explicit ignore patterns: `local.json`, `cache/`, `*.bak.*`, `.migration.lock`. Files committed to the repo (under `.sdlc/`): `config.json`, `review-dimensions/`. The historical `*\n` blanket-ignore content is replaced. Implementation: `lib/config.js::ensureSdlcGitignore`.
- R-layout-5 (issue #231): Root `.gitignore` managed block (existing R23) is extended with the following patterns alongside existing transient artifacts: `.sdlc/local.json`, `.sdlc/cache/`, `.sdlc/*.bak.*`, `.sdlc/.migration.lock`. The block version marker is bumped to `v2` so existing v1 blocks are replaced cleanly. Implementation: `lib/config.js::ensureRootGitignore`.
- R-layout-6 (issue #231): Backup files for the one-time legacy `.sdlc/config.json` → `.sdlc/config.json` relocation are written to `.sdlc/config.json.bak` (no timestamp suffix — single one-time backup). All other in-place migration backups are written to `.sdlc/<file>.bak.<filesystem-safe-ISO>` where the timestamp uses `T` and `-` separators (no `:`). Setup-sdlc sweeps `.sdlc/*.bak.*` and `.sdlc/config.json.bak.*`, sorts by mtime descending, and unlinks all entries past index 2 (retains the 3 newest backups per role).
- R-layout-7 (issue #231): `--migrate` flag (existing A1) dispatches `scripts/skill/migrate-config.js` for standalone migration without the full setup flow. The script returns a JSON manifest of the form `{ project: { schemaVersion, migrated, backupPath, stepsApplied }, local: { ... }, errors: [] }` and is idempotent (re-run after success is a no-op). The script supports `--dry-run` (no filesystem changes, no lock acquisition).
- R-version-1 (issue #232): The schemaVersion contract is uniform across project and local config: missing field on a project file means `schemaVersion: 0`; missing field on a local file means `schemaVersion: 1` (matches the historical pre-versioned local layout); a numeric `schemaVersion` is read verbatim. A file with `schemaVersion > CURRENT_SCHEMA_VERSION` is refused with `ConfigVersionTooNewError` carrying the plugin version and the maximum supported value.
- R-deprecation-1: Legacy `.sdlc/config.json` and `.claude/review-dimensions/` are read with fallback in read-only call sites (lib/config.js read paths, dimensions.js, hooks regex, CI scripts) for two minor versions (current 0.19.x, 0.20.x). The fallback emits a one-time stderr deprecation warning per process. Writes are always to the new `.sdlc/` location. The legacy alternation is dropped in 0.21.x.

## Workflow Phases

1. PRE-FLIGHT — run `skill/setup.js` to detect current config state, legacy files, content status
   - **Script:** `skill/setup.js`
   - **Params:** none
   - **Output:** JSON → P1-P8 plus P-sections (project config state/sections/path, local config state, legacy file detection, content counts, detected version file/tag prefix/default branch, migration flag, openspec block, joined `sections[]`)
2. SELECTIVE-SECTION MENU — render rows from `prepare.sections[]`; user selects which sections to configure (legacy rows auto-selected and locked); empty selection exits without changes
3. MIGRATION (conditional) — consolidate legacy config files and migrate config schema (issues #231, #232)
   - **Scripts:** `lib/config.js` → `consolidateLegacyFiles()` (renamed from `migrateConfig()`) for legacy file consolidation; then `scripts/skill/migrate-config.js` for schema migration via `lib/config-version.js::verifyAndMigrate`
   - **Params:** project root, legacy config paths
   - **Output:** merged config written to `.sdlc/config.json` (was `.sdlc/config.json`); `schemaVersion` stamp applied; backup written per R-layout-6
4. DISPATCH LOOP — for each selected section, print a verbose header (purpose, files-modified, consumed-by, config-file, current-value) sourced from `prepare.sections[i]`, then dispatch the appropriate branch:
   - `delegatedTo: null` → generic field loop (one AskUserQuestion per `section.fields[]` entry, optionally gated by `section.confirmDetected`)
   - `delegatedTo: 'inline-commit-builder' | 'inline-pr-builder'` → conditional inline pattern builders for `commit` / `pr` sections
   - `delegatedTo: 'setup-<sub>'` → invoke the sub-flow document (review-dimensions, pr-template, plan-guardrails, execution-guardrails, openspec-block)
   - **Output:** config files written to `.sdlc/config.json` and `.sdlc/local.json` via `lib/config.js::writeProjectConfig`/`writeLocalConfig` (each write stamps `schemaVersion: 3`); content artifacts written by sub-flows
5. SUMMARY — display what was created, updated, or migrated
   - **Script:** `skill/setup.js` (re-run for G2 validation)
   - **Params:** none
   - **Output:** JSON → P-fields re-read to verify correctness of written config

## Quality Gates

- G1: Pre-flight passed — `skill/setup.js` exits successfully
- G2: Config validation — re-run `skill/setup.js` after writing config to verify correctness
- G3: No direct file writes — all config writes go through `lib/config.js` functions
- G4: Version mode present — version section always includes `mode` field. Optional `preRelease` field, if collected, must match `^[a-z][a-z0-9]*$`; invalid values cause re-prompt before write.
- G5: Migration consent — legacy files only deleted after explicit user confirmation

## Prepare Script Contract

- P1: `projectConfig` (object) — `{ exists, sections, misplaced, path }` state of `.sdlc/config.json` (read with legacy fallback to `.sdlc/config.json` per R-deprecation-1)
- P2: `localConfig` (object) — `{ exists, path }` state of `.sdlc/local.json`
- P3: `legacy` (object) — `{ version, ship, review, reviewLegacy, jira }` each with `{ exists, path }`
- P4: `content` (object) — `{ reviewDimensions: { count, path }, prTemplate: { exists, path }, jiraTemplates: { count, path } }`
- P5: `detected` (object) — `{ versionFile, fileType, tagPrefix, defaultBranch }` auto-detected project settings
- P6: `needsMigration` (boolean) — true when any legacy file exists, any misplaced section found, OR `.sdlc/local.json` has a v1 ship section (`localIsV1` is true)
- P6a: `localIsV1` (boolean) — true when `.sdlc/local.json` ship section has legacy `preset`/`skip` keys, or lacks a top-level `version: 2` stamp
- P7: `shipFields` (array) — authoritative list of interactive ship-config fields sourced from `scripts/lib/ship-fields.js`. Each entry: `{ name, label, type, options, default, description }`. `name` is the local-config key; `options` is an array of valid values; `default` is the value applied if the user accepts the default answer.
- P8: `openspecConfig` (object) — `{ exists: boolean, path: string, managedBlockVersion: number|null }` state of `openspec/config.yaml` and its managed block
- P-sections: `sections` (array) — joined view of `SETUP_SECTIONS` (manifest) × `detect()` state. Drives the Step 1 selective menu and the Step 3 verbose dispatch loop. Each row has shape:
  - `id` (string) — canonical section id (used by `--only`); one of `version`, `ship`, `jira`, `review`, `commit`, `pr`, `pr-labels`, `review-dimensions`, `pr-template`, `plan-guardrails`, `execution-guardrails`, `openspec-block`
  - `label` (string) — human-readable section name
  - `state` (string) — `'set'` (configured) | `'not-set'` (no config) | `'legacy'` (legacy file present, `localIsV1`, or managed-block-version below current)
  - `summary` (string) — one-line summary of the current configuration (empty for `not-set`)
  - `locked` (boolean) — `true` when `needsMigration === true` and `state === 'legacy'`; locked rows are auto-selected in the menu and cannot be unchecked
  - `purpose` (string) — one-paragraph runtime explanation of what this section does
  - `configFile` (string) — `.sdlc/config.json` | `.sdlc/local.json` | `<delegated>` | `openspec/config.yaml` (legacy `.sdlc/config.json` may appear for legacy-detection rows during the deprecation window)
  - `configPath` (string|null) — dot-path within `configFile`, or `null` for delegated/content sections
  - `consumedBy` (string[]) — skill ids that read this section at runtime
  - `filesModified` (string[]) — workspace artifacts created or touched
  - `optional` (boolean) — `true` if the section is safe to leave unset
  - `delegatedTo` (string|null) — sub-skill id (`setup-dimensions`, `setup-pr-template`, `setup-guardrails`, `setup-execution-guardrails`, `setup-pr-labels`, `setup-openspec`), inline-builder id (`inline-commit-builder`, `inline-pr-builder`), or `null` for generic field-loop sections
  - `confirmDetected` (boolean) — `true` when the dispatcher must ask `yes` / `customize` / `skip` BEFORE iterating fields (currently only `version`)
  - `fields` (array) — entries with shape `{ name, label, type, options, default, description, validate? }` matching the `SHIP_FIELDS` shape; empty for delegated and inline-builder sections

## Error Handling

- E1: `skill/setup.js` exit non-zero → display error, stop
- E2: Config write fails → warn user, offer to retry
- E3: Migration conflict (unified config and legacy both have same section) → unified wins; report conflict to user
- E4: `lib/config.js` not found → show installation error

## Constraints

- C1: Must not delete legacy files without explicit user confirmation via AskUserQuestion
- C2: Must not invoke removed standalone skills (`/review-init-sdlc`, `/pr-customize-sdlc`, `/guardrails-init-sdlc`) — use sub-flow documents instead
- C3: Must not modify Jira templates directly — delegate to `/jira-sdlc`
- C4: Must not write config files using Edit/Write tools directly — always use `lib/config.js` functions
- C5: Must not skip AskUserQuestion for any user interaction
- C6: Must not assume `mode` for version section — always ask or detect
- C7: Must not skip, bypass, or defer prepare script execution — the script must run and exit successfully before any skill phase begins
- C8: Must not override, reinterpret, or discard prepare script output — for every P-field, the script return value is authoritative and final; the skill must not substitute LLM-generated alternatives
- C9: Must not independently compute, infer, or fabricate values for any field the prepare script is contracted to provide — if the script fails or a field is absent, the skill must stop rather than fill in data
- C10: Must not re-derive data the prepare script already computes via shell commands, tool calls, or LLM inference — script output is the sole source for all factual context, preserving deterministic behavior

## Step-Emitter Contract

> Added as foundation for step-emitter migration. P-TRANS-1 transition map to be defined during script migration.

- P-STEP-1: Script returns universal envelope with `status`, `step`, `llm_decision`, `state_file`, `progress`, and `ext` fields on every invocation
- P-STEP-2: Script accepts `--after <step_id> --result-file <path> --state <state_file>` for subsequent invocations after the initial call
- P-STEP-3: State file is created on first invocation, updated after each step, and cleaned up when status is `"done"`
- P-TRANS-1: Step transition map — TBD (to be defined during script migration)
- P-TRANS-2: Every `step.id` in the transition map has a corresponding `When step.id == X` section in SKILL.md
- C-STEP-1: The LLM MUST NOT skip steps or reorder the sequence — the script controls progression
- C-STEP-2: The LLM MUST NOT read or modify the state file directly — it passes the path back to the script via `--state`
- C-STEP-3: When `llm_decision` is null, the LLM executes the step without asking the user or making judgment calls
- C-STEP-4: When `llm_decision` is non-null, the LLM MUST resolve it (via domain knowledge or user interaction) before proceeding

## Integration

- I1: `skill/setup.js` — detects current config state and legacy files
- I2: `lib/config.js` — `writeProjectConfig`, `writeLocalConfig`, `consolidateLegacyFiles` (renamed from `migrateConfig`), `ensureRootGitignore`, `ensureSdlcGitignore` functions
- I2a (issue #232): `lib/config-version.js` — `CURRENT_SCHEMA_VERSION` (current value 3), `verifyAndMigrate(projectRoot, role, opts)` returning `{ schemaVersion, migrated, backupPath, stepsApplied }`. Throws `ConfigVersionTooNewError`, `ConfigMigrationError`, `ConfigMigrationLocked` on failure modes.
- I2b (issue #232): `lib/config-migrations.js` — `PROJECT_MIGRATIONS` and `LOCAL_MIGRATIONS` ordered arrays of `{ from, to, run, rollback? }` step objects.
- I2c (issue #231): `scripts/skill/migrate-config.js` — standalone wrapper around `verifyAndMigrate`, invoked by `setup-sdlc --migrate` and by setup-sdlc's migration phase. Accepts `--dry-run`. Returns 0 on success, non-zero on migration failure.
- I3: `setup-dimensions.md` — sub-flow for review dimension configuration
- I4: `setup-pr-template.md` — sub-flow for PR template creation
- I5: `setup-guardrails.md` — sub-flow for plan guardrail configuration
- I6: `setup-execution-guardrails.md` — sub-flow for execution guardrail configuration
- I7: `version-sdlc` — consumes version config written by this skill
- I8: `ship-sdlc` — consumes ship config written by this skill
- I9: `review-sdlc` — consumes review dimensions installed by this skill
- I10: `jira-sdlc` — consumes jira config written by this skill
- I11: `setup-openspec.md` — sub-flow for openspec config enrichment
- I12: `util/openspec-enrich.js` — deterministic script for managed-block operations on `openspec/config.yaml`
- I13: `setup-pr-labels.md` — sub-flow for PR label assignment policy ([issue #197](https://github.com/rnagrodzki/sdlc-marketplace/issues/197)); writes `pr.labels` (mode: off|rules|llm) into `.sdlc/config.json`
- I14: `lib/setup-sections.js` — single source of truth for the `SETUP_SECTIONS` manifest consumed by `skill/setup.js` to emit `prepare.sections[]` (P-sections) and by SKILL.md Step 1 / Step 3 to render menu rows and verbose headers
