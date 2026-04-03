# setup-sdlc Specification

> Unified setup skill: detect existing configuration, migrate legacy files, interactively configure missing sections, and delegate content creation (review dimensions, PR template, guardrails). Safe to re-run (idempotent).

**User-invocable:** yes
**Model:** sonnet
**Prepare script:** `setup-prepare.js`

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
- A10: Unnamed flag routing: `--dimensions`, `--pr-template`, `--guardrails`, `--execution-guardrails` each bypass the main config builder flow and enter their sub-flow directly

## Core Requirements

- R1: 5-step workflow: Pre-flight → Status Report → Migration → Config Builder → Content Setup → Summary
- R2: Flag routing: `--dimensions`, `--pr-template`, `--guardrails`, `--execution-guardrails` each bypass main flow and enter their sub-flow directly after pre-flight
- R3: Migration logic: detect legacy config files (version.json, ship-config.json, review.json), offer merge into unified config, optionally delete originals
- R4: Config builder walks through missing sections interactively: version, ship, jira, review, commit patterns, PR title patterns
- R5: Idempotent: re-run safe via read-merge-write (`writeProjectConfig`, `writeLocalConfig` from `lib/config.js`)
- R6: Config writes go through `lib/config.js` functions via inline Node.js — never use Edit/Write tools directly on config files
- R7: Early exit when everything is configured, no migration needed, and `--force` not passed
- R8: Ship config is developer-local (`.sdlc/local.json`, gitignored), not project-level
- R9: Content setup sub-flows: review dimensions (`setup-dimensions.md`), PR template (`setup-pr-template.md`), plan guardrails (`setup-guardrails.md`), execution guardrails (`setup-execution-guardrails.md`)
- R10: Project scan phase runs before content sub-flows to collect signals (dependencies, framework, CI, DB, tests, etc.)
- R11: Version section requires `mode` field (required by schema): `"file"` when version file detected, `"tag"` when not
- R12: Prepare script output is the single authoritative source for all contracted fields (P-fields) — script-provided values take unconditional precedence over skill-generated content, and all factual context (git state, config, flags, metadata) must originate from script output to ensure deterministic behavior

## Workflow Phases

1. PRE-FLIGHT — run `setup-prepare.js` to detect current config state, legacy files, content status
   - **Script:** `setup-prepare.js`
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
   - **Script:** `setup-prepare.js` (re-run for G2 validation)
   - **Params:** none
   - **Output:** JSON → P1-P6 (re-read to verify correctness of written config)

## Quality Gates

- G1: Pre-flight passed — `setup-prepare.js` exits successfully
- G2: Config validation — re-run `setup-prepare.js` after writing config to verify correctness
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

## Error Handling

- E1: `setup-prepare.js` exit non-zero → display error, stop
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

## Integration

- I1: `setup-prepare.js` — detects current config state and legacy files
- I2: `lib/config.js` — `writeProjectConfig`, `writeLocalConfig`, `migrateConfig` functions
- I3: `setup-dimensions.md` — sub-flow for review dimension configuration
- I4: `setup-pr-template.md` — sub-flow for PR template creation
- I5: `setup-guardrails.md` — sub-flow for plan guardrail configuration
- I6: `setup-execution-guardrails.md` — sub-flow for execution guardrail configuration
- I7: `version-sdlc` — consumes version config written by this skill
- I8: `ship-sdlc` — consumes ship config written by this skill
- I9: `review-sdlc` — consumes review dimensions installed by this skill
- I10: `jira-sdlc` — consumes jira config written by this skill
