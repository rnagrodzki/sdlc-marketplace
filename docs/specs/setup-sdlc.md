# setup-sdlc Specification

> Unified setup skill: detect existing configuration, migrate legacy files, interactively configure missing sections, and delegate content creation (review dimensions, PR template, guardrails). Safe to re-run (idempotent).

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
- A12: Unnamed flag routing: `--dimensions`, `--pr-template`, `--guardrails`, `--execution-guardrails`, `--openspec-enrich` each bypass the main config builder flow and enter their sub-flow directly

## Core Requirements

- R1: 5-step workflow: Pre-flight → Status Report → Migration → Config Builder → Content Setup → Summary
- R2: Flag routing: `--dimensions`, `--pr-template`, `--guardrails`, `--execution-guardrails` each bypass main flow and enter their sub-flow directly after pre-flight
- R3: Migration logic: detect legacy config files (version.json, ship-config.json, review.json), offer merge into unified config, optionally delete originals
- R4: Config builder walks through missing sections interactively: version, ship, jira, review, commit patterns, PR title patterns
- R5: Idempotent: re-run safe via read-merge-write (`writeProjectConfig`, `writeLocalConfig` from `lib/config.js`)
- R6: Config writes go through `util/setup-init.js` which calls `lib/config.js` functions. The script deterministically creates `.sdlc/` directory, `.sdlc/.gitignore`, and config files — never use Edit/Write tools directly on config files
- R7: Early exit when everything is configured, no migration needed, and `--force` not passed
- R8: Ship config is developer-local (`.sdlc/local.json`, gitignored), not project-level
- R9: Content setup sub-flows: review dimensions (`setup-dimensions.md`), PR template (`setup-pr-template.md`), plan guardrails (`setup-guardrails.md`), execution guardrails (`setup-execution-guardrails.md`)
- R10: Project scan phase runs before content sub-flows to collect signals (dependencies, framework, CI, DB, tests, etc.)
- R11: Version section requires `mode` field (required by schema): `"file"` when version file detected, `"tag"` when not
- R12: Prepare script output is the single authoritative source for all contracted fields (P-fields) — script-provided values take unconditional precedence over skill-generated content, and all factual context (git state, config, flags, metadata) must originate from script output to ensure deterministic behavior
- R13: Content sub-flows (setup-dimensions, setup-pr-template, setup-guardrails) inherit the parent skill's permission mode. Sub-flows MUST NOT call ExitPlanMode, change permission settings, or exit any mode.
- R14: Scan phase (R10) MUST use the Glob tool for all file/directory existence checks. Bash MUST NOT be used with glob patterns — zsh errors on unmatched globs. Bash is permitted only for `git`, `gh`, and `which` commands.
- R15: Ship config field enumeration (Step 3b) is authoritative from prepare script output P7 (`shipFields`). The skill MUST iterate every entry in `shipFields` and dispatch one `AskUserQuestion` per field — it MUST NOT hand-enumerate the field list or short-circuit the loop. Ship config writes use answers collected in this loop plus defaults for any field the user explicitly deferred.
- R16: When `openspec/config.yaml` is detected during full-interactive setup (Step 4 content menu), prompt the user to apply managed-block enrichment (default: yes). Detection uses prepare script output field `openspecConfig.exists`.
- R17: Enrichment uses a string-delimited managed block (`# BEGIN MANAGED BY sdlc-utilities (vN)` … `# END MANAGED BY sdlc-utilities (vN)`) with a plugin-owned version marker. The block is appended, updated, or left unchanged by `scripts/util/openspec-enrich.js`.
- R18: Re-running setup on an already-enriched config at the current plugin version is a no-op (exit 0, action: `"unchanged"`)
- R19: Version mismatch between the in-file managed block and the plugin-shipped version triggers an `update` action (block text replaced in place)
- R20: `--openspec-enrich` flag provides direct entry to the openspec enrichment sub-flow, bypassing the main config builder (same pattern as `--dimensions`, `--pr-template`)
- R21: `--remove-openspec` flag removes the managed block (restores user-authored content verbatim) and exits
- R22: Content outside the managed block is never modified. If the config file lacks a section where the block would naturally fit, the managed block is appended at end-of-file with a preceding blank line.

## Workflow Phases

1. PRE-FLIGHT — run `skill/setup.js` to detect current config state, legacy files, content status
   - **Script:** `skill/setup.js`
   - **Params:** none
   - **Output:** JSON → P1-P6 (project config state/sections/path, local config state, legacy file detection, content counts, detected version file/tag prefix/default branch, migration flag)
2. STATUS REPORT — display what is configured vs missing
3. MIGRATION (conditional) — migrate legacy config files to unified format
   - **Script:** `lib/config.js` → `migrateConfig()` via inline Node.js
   - **Params:** project root, legacy config paths
   - **Output:** merged config written to `.claude/sdlc.json`
4. CONFIG BUILDER — interactively configure missing sections (version, ship, jira, review, commit, PR)
   - **Script:** `lib/config.js` → `writeProjectConfig()`, `writeLocalConfig()` via inline Node.js
   - **Params:** section name, config values (per interactive session)
   - **Output:** config files written to `.claude/sdlc.json` (project) and `.sdlc/local.json` (local/ship)
5. CONTENT SETUP — delegate to sub-flows for review dimensions, PR template, guardrails
6. SUMMARY — display what was created, updated, or migrated
   - **Script:** `skill/setup.js` (re-run for G2 validation)
   - **Params:** none
   - **Output:** JSON → P1-P6 (re-read to verify correctness of written config)

## Quality Gates

- G1: Pre-flight passed — `skill/setup.js` exits successfully
- G2: Config validation — re-run `skill/setup.js` after writing config to verify correctness
- G3: No direct file writes — all config writes go through `lib/config.js` functions
- G4: Version mode present — version section always includes `mode` field
- G5: Migration consent — legacy files only deleted after explicit user confirmation

## Prepare Script Contract

- P1: `projectConfig` (object) — `{ exists, sections, misplaced, path }` state of `.claude/sdlc.json`
- P2: `localConfig` (object) — `{ exists, path }` state of `.sdlc/local.json`
- P3: `legacy` (object) — `{ version, ship, review, reviewLegacy, jira }` each with `{ exists, path }`
- P4: `content` (object) — `{ reviewDimensions: { count, path }, prTemplate: { exists, path }, jiraTemplates: { count, path } }`
- P5: `detected` (object) — `{ versionFile, fileType, tagPrefix, defaultBranch }` auto-detected project settings
- P6: `needsMigration` (boolean) — true when any legacy file exists or any misplaced section found
- P7: `shipFields` (array) — authoritative list of interactive ship-config fields sourced from `scripts/lib/ship-fields.js`. Each entry: `{ name, label, type, options, default, description }`. `name` is the local-config key; `options` is an array of valid values; `default` is the value applied if the user accepts the default answer.
- P8: `openspecConfig` (object) — `{ exists: boolean, path: string, managedBlockVersion: number|null }` state of `openspec/config.yaml` and its managed block

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
- I2: `lib/config.js` — `writeProjectConfig`, `writeLocalConfig`, `migrateConfig` functions
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
