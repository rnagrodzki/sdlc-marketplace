# ship-sdlc Specification

> End-to-end feature shipping pipeline: execute plan, commit, review, fix critical issues, version, and open a PR. Chains six sub-skills sequentially with conditional review-fix loop, state persistence, and resume support.

**User-invocable:** yes
**Model:** opus
**Prepare script:** `skill/ship.js`

## Arguments

- A1: `--auto` — run pipeline non-interactively; forwarded to sub-skills that support it (default: false)
- A2: `--steps <csv>` — comma-separated steps to run; valid: execute, commit, review, received-review, commit-fixes, version, pr, archive-openspec. When passed, fully replaces the resolved step list (config `ship.steps[]` and built-in defaults are ignored). The single source of truth for pipeline composition is config `ship.steps[]`; CLI `--steps` is a one-shot override.
- A3: `--quality full|balanced|minimal` — execution quality (model tier) forwarded to execute-plan-sdlc; only forwarded when explicitly passed via CLI (default: not forwarded; execute-plan-sdlc applies its own selection)
- A4: `--bump patch|minor|major|<label>` — version bump type forwarded to version-sdlc; `<label>` is any pre-release label matching `^[a-z][a-z0-9]*$` (e.g., `rc`, `beta`, `alpha`, custom). A label-form value is forwarded verbatim to version-sdlc, where it is interpreted as `--bump patch --pre <label>` (default: from config or patch)
- A5: `--draft` — create PR as draft (default: from config or false)
- A6: `--dry-run` — display pipeline plan without executing (default: false)
- A7: `--resume` — resume pipeline from saved state file (default: false)
- A8: `--workspace branch|worktree|prompt` — workspace isolation mode (default: from config or prompt)
- A8a: In `--auto` mode, `workspace: "prompt"` is overridden to `"branch"` when the source is not `'cli'`. Explicit CLI `--workspace prompt` with `--auto` is preserved (intentional override).
- A9: `--init-config` — run interactive config wizard, no pipeline execution (default: false)
- A10: `--openspec-change <name>` — explicitly select the OpenSpec change to archive, overriding branch matching (default: null)

## Core Requirements

- R1: 7-step pipeline sequence: execute-plan-sdlc → commit-sdlc → review-sdlc → received-review-sdlc (conditional) → commit-sdlc fixes (conditional) → version-sdlc → pr-sdlc
- R2: All sub-skills dispatched as Agents (never Skill tool) to maintain context isolation — each Agent loads its SKILL.md independently
- R3: Pipeline plan is a binding contract: steps with `status: "will_run"` must execute; LLM cannot override
- R4: Step statuses computed by `skill/ship.js`: `will_run`, `skipped`, `conditional`
- R5: Skip set provenance tracked via `skipSource`: `cli`, `config`, `auto`, `condition`, `none`; fabrication guard blocks (error, exit code 1) on `default` source
- R6: Review verdict conditional logic: CHANGES REQUESTED (critical or ≥3 high) → pause, invoke received-review; APPROVED WITH NOTES (high or ≥5 medium) → invoke received-review if high exists; APPROVED → continue
- R7: `--auto` forwarding audit: only forwarded to commit-sdlc, received-review-sdlc, version-sdlc, pr-sdlc (not execute-plan-sdlc, not review-sdlc)
- R8: Staging gap between execute and commit: `git add -A -- ':!.sdlc/'` required
- R9: Rebase onto default branch after all commits, before version step; abort and pause on conflict
- R10: State persistence after each step via `state/ship.js`; cleanup validates pipeline contract before deleting state; state preserved on validation failure
- R11: Resume via `--resume`: re-enter worktree if applicable, continue from first incomplete step
- R12: Version step auto-skipped in worktree mode (tags are repo-global); advisory printed post-pipeline
- R13: Worktree PRs auto-label `skip-version-check` when version auto-skipped
- R14: Double commit intentional: feature commit (step 2) and review fix commit (step 5) kept separate
- R15: `--dry-run` displays pipeline table and stops without executing
- R16: `--init-config` redirects to `/setup-sdlc`; runs interactive wizard if user insists
- R17: Deferred review findings (medium/low) collected and displayed in final summary
- R18: Ship config is optional and developer-local (`.sdlc/local.json`); pipeline runs with built-in defaults
- R19: Prepare script output is the single authoritative source for all contracted fields (P-fields) — script-provided values take unconditional precedence over skill-generated content, and all factual context (git state, config, flags, metadata) must originate from script output to ensure deterministic behavior
- R20: `--auto` suppresses pipeline pauses: when `--auto` is active, `pause` must be `false` for every step that accepts `--auto` (per R7 forwarding audit: commit-sdlc, received-review-sdlc, version-sdlc, pr-sdlc). The sub-skill's consent gate is skipped via the forwarded flag, so the pipeline has no reason to pause at that step.
- R21: When `openspec/config.yaml` exists (as reported by `skill/ship.js` via `context.openspecDetected` or the authoritative field) AND the injected session-start `<system-reminder>` contains a contradictory signal (regex matching `not initialized` together with `openspec`), the skill MUST emit a single audit line naming the authoritative file path and note that the contradictory signal is being ignored. The override line is informational only — pipeline flow continues. (Rationale: #164 — defensive hardening against co-installed plugins emitting false-negative OpenSpec detection.)
- R22: The pipeline includes a conditional `archive-openspec` step between `commit-fixes` and `version`. The step has no dedicated sub-skill — it is dispatched inline via bash (validation + archive + commit).
- R23: Trigger conditions for `archive-openspec` (all must hold): `openspec/config.yaml` exists; an active non-archived change matches the current branch (`openspec.branchMatch`) OR `--openspec-change <name>` is passed; prior steps completed without halting.
- R24: The `archive-openspec` step calls `openspec validate <name> --strict` via `lib/openspec.js::validateChangeStrict`; on failure, halts the pipeline and surfaces validation output.
- R25: On validation success: prompts the user (non-interactive in `--auto`); on approval (or `--auto`), runs `openspec archive <name> --yes` via `lib/openspec.js::runArchive`, then creates a commit `chore(openspec): archive <name>`.
- R26: To disable the `archive-openspec` step, omit it from `ship.steps[]` in config or from CLI `--steps`. The value `archive-openspec` is recognized in `VALID_STEPS` (`lib/ship-fields.js`).
- R27: The step is idempotent — if `lib/openspec.js::isArchived(projectRoot, changeName)` returns true, the step is skipped with reason "already archived".
- R28: `--openspec-change <name>` flag explicitly selects the change to archive, overriding branch matching.
- R29: The ship config schema MUST NOT contain a `preset` field. The decorative `preset` (`full|balanced|minimal`) is replaced by an explicit `steps[]` list in `.sdlc/local.json`. CLI flag `--preset` is hard-removed: passing `--preset` to ship-sdlc produces a clear error pointing the user at `--steps <csv>`. Migration of legacy on-disk v1 configs (with `ship.preset`) continues to be handled by `lib/config.js` v1→v2 migration (R32).
  - Acceptance: `schemas/sdlc-local.schema.json` `shipSection` contains no `preset` property; `lib/ship-fields.js` `SHIP_FIELDS` contains no `preset` field; `BUILT_IN_DEFAULTS` contains no `preset` key; `skill/ship.js parseArgs` rejects `--preset` with an error written to `errors[]`.
- R30: The ship config schema MUST NOT contain a `skip` field. The single source of truth for which steps run is `steps[]`. CLI flag `--skip` is hard-removed: passing `--skip` to ship-sdlc produces a clear error pointing the user at `--steps <csv>`. Migration of legacy on-disk v1 configs (with `ship.skip`) continues to be handled by `lib/config.js` v1→v2 migration (R32).
  - Acceptance: `schemas/sdlc-local.schema.json` `shipSection` contains no `skip` property; `lib/ship-fields.js` `SHIP_FIELDS` contains no `skip` field; `BUILT_IN_DEFAULTS` contains no `skip` key; `skill/ship.js parseArgs` rejects `--skip` with an error written to `errors[]`.
- R31: Top-level local config files (`.sdlc/local.json`) MUST carry an integer `version` field. Current schema version is `2`. The schema declares `"version": {"type": "integer", "const": 2}` at the top level. Files lacking `version` are treated as v1 and auto-migrated on read.
  - Acceptance: `schemas/sdlc-local.schema.json` declares top-level `version` with `const: 2`; new configs written via `writeLocalConfig`/`util/ship-init.js` include `version: 2` at the top level (not nested in `ship`).
- R32: `lib/config.js::readLocalConfig` MUST auto-migrate v1 → v2 on read. Migration steps: (a) expand legacy `ship.preset` to `steps[]` via `PRESET_TO_STEPS` (full/balanced/minimal and legacy A/B/C aliases); (b) subtract any legacy `ship.skip[]` members from the expanded steps; (c) delete `ship.preset` and `ship.skip` from the in-memory object; (d) set `ship.steps = <result>` and top-level `version: 2`; (e) persist the migrated config back atomically; (f) emit a single stderr deprecation notice on first migration. Migration MUST be idempotent — reading a v2 config does not rewrite or re-emit. The `migrateConfig` (--migrate) flow also triggers the v1→v2 ship migration.
  - Acceptance: passing `{$schema, ship:{preset:"balanced", skip:[]}}` (no version) to `readLocalConfig` returns `{version:2, ship:{steps:[execute,commit,review,pr,archive-openspec], …}}` and rewrites disk; passing the migrated result back to `readLocalConfig` returns identical content with no disk write and no second notice.
- R33: The setup-sdlc questionnaire (`shipFields` from `lib/ship-fields.js`) MUST emit a `steps` field (multi-select; options enumerate the six canonical steps `execute, commit, review, version, pr, archive-openspec`; default = all six). It MUST NOT emit `preset` or `skip` fields. `util/ship-init.js` MUST consume `--steps <csv>` (validated against `VALID_STEPS`) and write a config whose top level carries `version: 2`. The `--preset` flag MUST be removed from `ship-init.js` and rejected with a clear migration-pointer error if passed.
  - Acceptance: `SHIP_FIELDS[0].name === 'steps'`; `ship-init.js --steps execute,commit,pr` produces a `.sdlc/local.json` whose top level has `version: 2` and `ship.steps: ["execute","commit","pr"]`, no `preset`/`skip` keys.
- R34: When no ship config exists and no `--steps` flag is passed, `BUILT_IN_DEFAULTS.steps` in `ship-fields.js` MUST equal `['execute','commit','review','pr','archive-openspec']` (excludes the `version` step). The resolved `flags.steps` mirrors that array. Note: `SHIP_FIELDS[0].default` intentionally diverges (all six canonical steps) — this is the broader questionnaire default so users see all choices; it does not affect runtime behavior.
  - Acceptance: running `skill/ship.js --has-plan` with no `.sdlc/local.json` produces `flags.steps === ['execute','commit','review','pr','archive-openspec']` and contains no `flags.preset` field at the top level.
- R35: Step 1 (pre-flight handoff) MUST emit a context-heaviness advisory when the latest transcript stats sidecar at `$TMPDIR/sdlc-context-stats.json` indicates `heavy: true` (transcript ≥60% of model budget). The advisory recommends `/compact` and notes that pipeline state survives compaction. When the sidecar is absent or `heavy: false`, no advisory is emitted. Implementation lives in `scripts/lib/context-advisory.js` and is appended to `skill/ship.js` PREPARE_OUTPUT_FILE so it surfaces before the pipeline begins. (Rationale: #173.)
  - Acceptance: with a sidecar containing `heavy: true`, the advisory text appears in `skill/ship.js --dry-run` output; with `heavy: false` or no sidecar, the output contains no advisory.
- R36: The pipeline includes a final `learnings-commit` step after `pr` (issue #208). The step has no dedicated sub-skill — it is dispatched inline via bash (Learning Capture append + diff check + commit + push). When `git diff --quiet -- .sdlc/learnings/log.md` reports no change, the step is a no-op (no empty chore commit). When there is a diff, the step commits `chore(ship-sdlc): capture pipeline learnings` and pushes. Push failures report a warning but do not halt the pipeline. The value `learnings-commit` is recognized in `VALID_STEPS` (`lib/ship-fields.js`), `CANONICAL_STEPS`, `PRESET_TO_STEPS` (all preset variants — full/balanced/minimal/A/B/C), and `schemas/sdlc-local.schema.json` `shipSection.steps.items.enum`. The step is opt-out via `--steps` or `ship.steps[]`; when omitted, `skipSource` records `cli`/`config`/`default` per the standard provenance rules.
  - Acceptance: default `BUILT_IN_DEFAULTS.steps` ends with `learnings-commit`; `computeSteps` produces a step entry whose `name === 'learnings-commit'`, `skill === null`, `model === 'haiku'`, and `status` mirrors `isIn('learnings-commit')`. With a Learning Capture entry queued, post-pipeline `git status --porcelain` is empty and `git log -1 --format=%s` equals `chore(ship-sdlc): capture pipeline learnings`. With no entry queued, no extra commit is created.
- R37: Post-execute branch migration (issue #223). After the `execute` step completes, the skill MUST detect whether the current branch (`git branch --show-current`) differs from `data.branch` recorded in the active ship-state file. When the values differ, the skill MUST invoke `state/ship.js migrate --from <oldSlug> --to <newBranch>` to rename the state file to `ship-<newSlug>-<originalTimestamp>.json` AND update `data.branch` to the new branch name. All other state fields (steps, decisions, deferredFindings, flags, startedAt) MUST be preserved. Migration failures (`migrated: false`) are warnings only — the pipeline continues; the orphaned state file will be cleaned by the terminal cleanup step (R38) or by `--gc` (R39). The migration helper `migrateBranchSlug` lives in `lib/state.js` and is exposed via the `migrate` subcommand on `state/ship.js`.
  - Acceptance: starting `/ship-sdlc` on `main`, then having execute-plan-sdlc create branch `fix/foo`, results in exactly one state file named `ship-fix-foo-*.json` after the execute step (no orphan `ship-main-*.json`); the file's `data.branch` field equals `"fix/foo"`.
- R38: Terminal `cleanup` pipeline step (issue #223). Every ship pipeline run MUST include a deterministic terminal `cleanup` step appended after every other configured step (including `pr`, `archive-openspec`, `learnings-commit`). The step is added to the resolved step list by `skill/ship.js::computeSteps`, NOT by user configuration — it is rejected with a validation error if it appears in CLI `--steps` or `ship.steps[]`. The step has `status: "will_run"` on success paths and `skill: null` (dispatched as a direct `Bash` call to `state/ship.js cleanup-pipeline`, not as an Agent). Behavior on success paths: (a) validate pipeline contract (no `pending`/`in_progress` steps among the configured set); (b) on contract success, delete the current run's state file; (c) GC sweep stale `ship-*` AND `execute-*` state files older than `state.gc.ttlDays` (default 7) whose branch no longer exists in `git branch --list`; (d) emit one JSON report `{currentRun: {valid, cleaned}, gc: {ship: {...}, execute: {...}}}`. On failure paths (any earlier step ended in `status: "failed"`), the skill MUST invoke the same script with `--force`, which skips the contract check and preserves the current run's state file (so `--resume` works) but still runs the GC sweep against unrelated stale orphans.
  - Acceptance: a clean `/ship-sdlc` end-to-end leaves `.sdlc/execution/` empty afterwards; the dry-run output table includes `cleanup` as the last step; `--steps cleanup` (or `ship.steps: ["cleanup"]`) is rejected with a validation error from `skill/ship.js`; on failure paths the current run's state file is preserved and unrelated stale orphans are still pruned.
- R-config-version (issue #232): At pipeline entry — before any step is dispatched and before the pipeline plan is presented — `skill/ship.js` MUST call `verifyAndMigrate(projectRoot, 'project')` and `verifyAndMigrate(projectRoot, 'local')` from `lib/config-version.js` (one call per role). On migration success the prepare output exposes `migration: { project: { schemaVersion, migrated, backupPath, stepsApplied }, local: {...} }`; on a no-op call the corresponding role contains `{ migrated: false, ... }`. On any migration failure the prepare emits a non-zero exit and an `errors[]` entry naming the failing step (e.g., `"local: v2→v3 (renameVersionToSchemaVersion)"`). The pipeline MUST NOT dispatch step 1 (execute) when a migration error is reported.
  - Acceptance: `skill/ship.js` imports `verifyAndMigrate` from `lib/config-version.js` and invokes it twice (once per role) before composing `steps[]`; on error the prepare output's `errors[]` includes a failing-step identifier; SKILL.md surfaces the failing step verbatim to the user before halting.
- R-config-skip (issue #232): On migration success, `skill/ship.js` MUST set `process.env.SDLC_SKIP_CONFIG_CHECK = '1'` for the duration of the pipeline so every subsequent Bash invocation (including `node scripts/skill/<sub>.js`) inherits the env var and short-circuits its own per-skill `verifyAndMigrate` call. The pipeline MUST NOT pass `--skip-config-check` per Skill tool invocation — env var is the single source. (Rationale: avoids per-invocation flag plumbing and keeps the skip surface uniform across nested subprocesses.)
  - Acceptance: after `skill/ship.js` runs `verifyAndMigrate`, the env var is set; sub-skill prepare scripts (commit, review, version, pr, etc.) observe `flags.skipConfigCheck === true` resolved from the env var, not from a CLI flag passed by ship-sdlc.
- R-config-failure-mode (issue #232): A migration failure halts the pipeline before step 1 — no partial pipeline runs. The prepare output is the single point of refusal: SKILL.md gates Step 4 (DO) on `errors.length === 0` from the prepare output. If a previous run partially migrated and the lock file (`.sdlc/.migration.lock`) is stale, the prepare surfaces a `ConfigMigrationLocked` error with PID guidance; the user is responsible for removing the lock manually after confirming no other migration is in flight.

- R39: `/ship-sdlc --gc` on-demand pruning (issue #223). When `--gc` is passed, `skill/ship.js` MUST short-circuit pipeline composition and emit `{action: "gc", report: {...}, errors: [], warnings: []}` to the prepare-output file. The report shape is `{ttlDays: N, ship: {deleted: [...], kept: [...]}, execute: {deleted: [...], kept: [...]}}` where each entry in `deleted`/`kept` is `{file, prefix, branch, reason}` (prefix ∈ `{"ship", "execute"}`). Pruning rule: a file is deleted iff (mtime is older than the TTL) AND (parsed branch slug does not match any current branch from `git branch --list`); files newer than the TTL are kept regardless (in-flight pipelines must not be wiped). The TTL defaults to `state.gc.ttlDays` from `.claude/sdlc.json` (fallback 7); CLI `--ttl-days <N>` overrides config. The same `gcStateFiles` helper from `lib/state.js` powers both `--gc` and the terminal cleanup step (R38). The skill MUST print the report and stop — no pipeline steps run.
  - Acceptance: `/ship-sdlc --gc` produces a prepare output with top-level `action: "gc"` and a `report` object containing `ship` and `execute` sub-reports each with `deleted[]` and `kept[]` arrays; `/ship-sdlc --gc --ttl-days 0` removes every state file whose branch is absent from `git branch --list` (regardless of age) but never removes files for currently-existing branches; no pipeline step is dispatched.

> **Implementation surface for R37–R39:** `state/ship.js` exposes `gc`, `migrate`, and `cleanup-pipeline` subcommands; `state/execute.js` exposes `gc`. The shared logic lives in `lib/state.js::gcStateFiles` and `lib/state.js::migrateBranchSlug`.

## Workflow Phases

1. CONSUME — load config, parse flags, run `skill/ship.js` for context detection and step computation
   - **Script:** `skill/ship.js`
   - **Params:** A1-A8 forwarded (`--auto`, `--steps <csv>`, `--quality`, `--bump`, `--draft`, `--resume`, `--workspace`); internal: `--has-plan` (from plan context detection). `--quality` is forwarded to execute-plan-sdlc only when explicitly passed; cross-reference: see `execute-plan-sdlc.md` A2.
   - **Output:** JSON → P1-P6 (flags with per-flag provenance sources, resume detection, context with branch/auth/openspec/worktree, pipeline steps with status/reason/skipSource/invocation, config)
2. PLAN — build pipeline table from `skill/ship.js` steps array; display flag resolution and auto-skip decisions
3. CRITIQUE — validate pipeline: gh auth, branch safety, skip values, flag coherence
4. DO — present pipeline for confirmation (or auto/dry-run); execute steps sequentially via Agent dispatch
   - **Script:** `state/ship.js`
   - **Params:** subcommands per step lifecycle: `init`, `start`, `complete`, `skip`, `fail`, `decide`, `defer`
   - **Output:** JSON state object persisted to `.sdlc/execution/ship-<branch>-<timestamp>.json` for `--resume` support
5. REPORT — summary table with per-step results, decisions log, deferred findings, worktree cleanup
   - **Script:** `state/ship.js`
   - **Params:** subcommand `cleanup` (on success) or `read` (on failure, state preserved)
   - **Output:** state file removed on success; preserved on failure for `--resume`

## Quality Gates

- G1: `gh` CLI authenticated — `gh auth status` succeeds
- G2: Not on default branch — warn if on main/master (do not block)
- G3: Step values valid — all CLI `--steps` values are recognized step names (`VALID_STEPS` from `lib/ship-fields.js`)
- G4: At least one step will run — pipeline is not entirely skipped
- G5: Flag coherence — `--bump` without version step produces error (exit code 1, blocking). The `--bump` value space accepts `major|minor|patch` or any pre-release label matching `^[a-z][a-z0-9]*$`; values outside this set are rejected at parse time before the version step runs.
- G6: Pipeline contract — every `will_run` step was dispatched as Agent
- G6a: Pipeline completion gate — `state/ship.js cleanup` validates all steps are in terminal state (`completed`, `skipped`, or `failed`) before deleting the state file. Steps still `pending` or `in_progress` cause cleanup to refuse deletion and exit 1.
- G7: Staging gap filled — `git add -A -- ':!.sdlc/'` ran between execute and commit
- G8: Rebase attempted — rebase ran after commits, before version (when applicable)

## Prepare Script Contract

- P1: `flags` (object) — resolved flags with `sources` map showing CLI/config/default provenance per flag
- P2: `resume` (object) — `{ found, stateFile }` resume detection result
- P3: `context` (object) — `{ planInContext, uncommittedChanges, currentBranch, defaultBranch, ghAuth, openspec, sdlcGitignored, worktree }`
- P4: `steps` (array) — pipeline steps, each with `{ skill, status, reason, skipSource, args, invocation, pause }`
- P5: `steps[].invocation` (string) — exact skill name + computed args for Agent dispatch
- P6: `config` (object | null) — ship config from `.sdlc/local.json` or null if absent
- P7: `steps[].model` (string) — model for Agent dispatch per step, computed from skill specs (e.g., `"sonnet"` for review-sdlc, `"haiku"` for commit-sdlc)
- P8 (issue #232): `migration` (object | null) — `{ project: { schemaVersion, migrated, backupPath, stepsApplied }, local: { ... } }` after `verifyAndMigrate` runs at pipeline entry. Null only when both calls were short-circuited by `SDLC_SKIP_CONFIG_CHECK=1` or `--skip-config-check`. On migration failure, `migration` is null AND `errors[]` carries the failing step identifier.

## Error Handling

- E1: Sub-skill fails (script crash) → stop pipeline, save state for `--resume`; sub-skill handles its own error reporting
- E2: `gh auth status` fails → stop at validation, tell user to `gh auth login`
- E3: `git add` fails → stop pipeline, show error
- E4: Network error (gh API) → auto-retry 3 attempts with exponential backoff; if exhausted, save state
- E5: State file write fails → warn and continue (best-effort)
- E6: Resume state file corrupt → warn, start fresh
- E7: Review verdict unparseable → treat as APPROVED WITH NOTES, warn user
- E8: Rebase conflict → abort rebase; auto mode stops, interactive offers pause/skip/merge options
- E9: Sub-skill times out → stop pipeline, save state

## Constraints

- C1: Must not invoke sub-skills via Skill tool — all dispatched as Agents for context isolation
- C2: Must not skip critique step (Step 3)
- C3: Must not forward `--auto` to sub-skills that don't support it (execute-plan-sdlc, review-sdlc)
- C4: Must not automatically resolve review findings — received-review-sdlc handles this
- C5: Must not run pipeline steps in parallel — strictly sequential
- C6: Must not delete state file on failure — needed for `--resume`
- C7: Must not proceed past a failed sub-skill — stop, save state, inform user
- C8: Must not skip steps marked `will_run` in the pipeline plan — the plan is a binding contract
- C9: Must not copy example args from SKILL.md — use `step.invocation` from skill/ship.js
- C10: Must not add `--steps` flags not present in user invocation; pipeline composition derives from CLI `--steps` > config `ship.steps[]` > `BUILT_IN_DEFAULTS.steps`
- C11: Must not skip, bypass, or defer prepare script execution — the script must run and exit successfully before any skill phase begins
- C12: Must not override, reinterpret, or discard prepare script output — for every P-field, the script return value is authoritative and final; the skill must not substitute LLM-generated alternatives
- C13: Must not independently compute, infer, or fabricate values for any field the prepare script is contracted to provide — if the script fails or a field is absent, the skill must stop rather than fill in data
- C14: Must not re-derive data the prepare script already computes via shell commands, tool calls, or LLM inference — script output is the sole source for all factual context, preserving deterministic behavior

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

- I1: `skill/ship.js` — pre-computes flags, context, step statuses, and invocations
- I2: `state/ship.js` — pipeline state management for pause/resume
- I3: `util/ship-init.js` — interactive config wizard for `--init-config`
- I4: `execute-plan-sdlc` — step 1: plan execution
- I5: `commit-sdlc` — steps 2 and 5: feature commit and review fix commit
- I6: `review-sdlc` — step 3: multi-dimension code review
- I7: `received-review-sdlc` — step 4 (conditional): process review findings
- I8: `version-sdlc` — step 6: semantic versioning and release tag
- I9: `pr-sdlc` — step 7: pull request creation
- I10: `setup-sdlc` — redirect target for `--init-config`
- I11: `util/worktree-create.js` — worktree creation for workspace isolation
- I12: OpenSpec — optional; suggests `/opsx:verify` and `/opsx:archive` post-pipeline when detected
- I13: `lib/openspec.js` — `validateChangeStrict`, `isArchived`, `runArchive` helpers for the `archive-openspec` step
- I14 (issue #232): `lib/config-version.js::verifyAndMigrate` — invoked at pipeline entry once per role (project, local) before any step dispatch. Throws halt the pipeline before step 1.
- I15 (issue #232): `lib/config-migrations.js` — registry consumed by `verifyAndMigrate`; ship-sdlc does not import it directly.
