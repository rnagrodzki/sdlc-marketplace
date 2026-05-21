# plan-sdlc Specification

> Decompose requirements into a classified, dependency-ordered implementation plan with per-task metadata ready for execute-plan-sdlc consumption. Designated plan-mode skill.

**User-invocable:** yes
**Model:** sonnet
**Prepare script:** `skill/plan.js`

## Arguments

- A1: `--spec` — include OpenSpec context in planning (default: false)
- A2: `--from-openspec <change-name>` — load a specific OpenSpec change directly, bypassing the gate check (default: none)
- A3: `spec-file-path` — path to a spec or requirements document (positional)

## Core Requirements

- R1: Complexity routing: 1 file → skip (no plan needed), 2-3 files → lightweight (skip exploration and review loop), 4+ files → full pipeline
- R2: In plan mode, always write to the designated plan file path
- R3: In normal mode, resolve output path via: user-specified → `plansDirectory` from settings → default `~/.claude/plans/`
- R4: Each task must touch 1-5 files; more than 5 files requires splitting
- R5: Per-task metadata format is mandatory: Complexity, Risk, Depends on, Verify, Files, Description, Acceptance criteria
- R6: Key decisions documented where a reasonable implementer might differ without the rationale
- R7: Verification strategy matches task type: feature→TDD, config→build, docs→manual, integration→E2E
- R8: Plan review loop uses cross-model review for plans with 5+ tasks (sonnet↔opus), max 3 iterations
- R9: When OpenSpec context is available, map every ADDED/MODIFIED requirement from delta specs to at least one task
- R10: When `--from-openspec` is passed with a valid change, use `tasks.md` as the primary decomposition skeleton
- R11: Guardrail compliance: evaluate plan against `activeGuardrails` during critique; error-severity failures are blocking
- R12: Plans with fewer than 2 tasks should not be created — just do the work directly
- R13: After exploration, re-read the plan file's Requirements section before decomposition (re-anchor to counter attention drift)
- R14: Remove the `## Requirements` working section after task decomposition (temporary scaffolding)
- R15: Prepare script output is the single authoritative source for all contracted fields (P-fields) — script-provided values take unconditional precedence over skill-generated content, and all factual context (git state, config, flags, metadata) must originate from script output to ensure deterministic behavior
- R16: When `openspec/config.yaml` exists AND the injected session-start `<system-reminder>` contains a contradictory signal (regex matching `not initialized` together with `openspec`), the skill MUST emit a single audit line naming the authoritative file path and note that the contradictory signal is being ignored. The override line is informational only — skill flow continues. (Rationale: #164 — defensive hardening against co-installed plugins emitting false-negative OpenSpec detection.)
- R17: Step 7 (handoff) MUST emit a context-heaviness advisory when the latest transcript stats sidecar at `$TMPDIR/sdlc-context-stats.json` indicates `heavy: true` (transcript ≥60% of model budget). The advisory recommends `/compact` and notes that pipeline state survives compaction (preserved by the existing `PreCompact` + `SessionStart` hooks). When the sidecar is absent or `heavy: false`, no advisory is emitted. Implementation lives in `scripts/lib/context-advisory.js` shared with ship-sdlc and execute-plan-sdlc. (Rationale: #173.)
- R18: Link verification (issue #198) — when the produced plan file content embeds URLs, every URL MUST be validated by `plugins/sdlc-utilities/scripts/lib/links.js` (CLI: `node scripts/lib/links.js --json`) before declaring the plan ready. Three URL classes are checked: (1) `github.com/<owner>/<repo>/(issues|pull)/<n>` — owner/repo identity must match the current remote, and the issue/PR number must exist on that repo; (2) `*.atlassian.net/browse/<KEY-N>` — host must match the configured Jira site; (3) any other `http(s)://` URL — generic reachability via HEAD (fall back to GET on 405), 5s timeout. Hosts in the built-in skip list (`linkedin.com`, `x.com`, `twitter.com`, `medium.com`) and any `ctx.skipHosts` entries are reported as `skipped`, not violations. `SDLC_LINKS_OFFLINE=1` skips network checks but keeps structural context-aware checks (GitHub identity match, Atlassian host match). Any violation aborts plan finalization with non-zero exit and a structured violation list — no soft-warning mode.
- R19: At Step 5 reviewer-loop max-iterations escalation and Step 4 error-severity guardrail blocker, the skill MUST present an opt-in menu option that dispatches `Skill(harden-sdlc)` with `--failure-text <full failure text>`, `--skill plan-sdlc`, `--step <step-id>`, `--operation <operation-name>`, and (when known) `--exit-code <N>`. Selection is user-initiated only — the skill MUST NOT auto-dispatch and MUST NOT write any hardening surface silently. Menu wording is canonical and identical across all caller skills (`plan-sdlc`, `execute-plan-sdlc`, `review-sdlc`, `commit-sdlc`) and is suppressed when `--auto` is set. (Fixes #221.)
- R20: planIntegrity markers — `plan-sdlc` MUST write four checkpoint markers into a per-branch plan state file at `.sdlc/execution/plan-<branchSlug>-<ts>.json`. State file JSON schema: `{ "planIntegrity": { "skillInvoked": "<ISO-ts>", "planFile": "<ISO-ts>", "guardrailsEvaluated": "<ISO-ts>", "critiqueRan": "<ISO-ts>" }, "planFilePath": "<abs-path>" }`. Write sites: (1) `skillInvoked` — written by `skill/plan.js --output-file` at Step 0 prepare (skill was invoked); (2) `planFile` + `planFilePath` — written by `skill/plan.js --mark plan-file --path <abs>` after Step 0 path resolution in both plan-mode and normal-mode branches; (3) `guardrailsEvaluated` — written by `skill/plan.js --mark guardrailsEvaluated` at the end of the Step 3 guardrail-compliance gate; (4) `critiqueRan` — written by `skill/plan.js --mark critiqueRan` as the final action of Step 3. Each marker value is an ISO 8601 timestamp; presence of a key means that checkpoint was reached. The `planFilePath` sibling field stores the absolute path to the written plan file, enabling downstream consumers to stat the file for non-empty content verification. (Fixes #285.)
  - **Lifecycle (Fixes #334):** (a) **Prune-on-write** — `pruneStateFiles('plan', branchSlug)` MUST be called immediately before `initState('plan', …)` in the `--output-file` branch of `skill/plan.js main()`. This ensures at most one `plan-<branchSlug>-*.json` file exists per branch between plan-sdlc invocations. The call is wrapped in the same try/catch as `initState` so a prune failure cannot block prepare output. The `--mark` branch MUST NOT prune — it reads the existing marker via `findStateFile` and would break if its target were removed first. (b) **Consume-then-delete** — `hooks/stop-plan-integrity.js` MUST capture the marker file path from `findStateFile` before reading, evaluate all integrity checks, then call `deleteState(path)` regardless of integrity outcome (single-shot semantics). The unlink is wrapped in a try/catch so a failed delete cannot violate the hook's advisory-only exit-0 contract. After consume, subsequent Stop events on the same branch engage the transcript-fallback path — this is correct R21 behavior (the marker is single-use per plan-sdlc invocation). (c) **GC orphan sweep** — stale plan markers (TTL-expired or branch-deleted) are removed by `ship-sdlc --gc` and `execute-plan-sdlc --gc` via `gcStateFiles({ prefix: 'plan', … })`. Each `--gc` call site MUST invoke `gcStateFiles` a third time with `prefix: 'plan'` and include a `plan` field in the aggregated JSON output so downstream consumers see all three buckets (`ship`, `execute`, `plan`). (d) **Atomic write** — plan state files inherit `atomicWriteSync` from `scripts/lib/state.js`; no partial-file states are possible.
- R21: stop-plan-integrity hook contract — a `Stop` hook MUST verify plan integrity at session end using a state-file-first / transcript-fallback activation order. Primary signal: if a plan state file exists for the current branch, the hook reads it, collects missing markers from `planIntegrity` (any of the four keys absent), and additionally stats `planFilePath` (if set) treating an absent or empty file as a failed `planFile` check; if any check fails it emits a structured stderr warning naming each missing checkpoint (`[plan-integrity] WARNING: Plan presented with incomplete plan-sdlc execution. Missing checkpoints: <list>`), one detail line per missing checkpoint. Fallback signal: if no plan state file exists, the hook reads the last 64 KB of the transcript (from `transcript_path` in the Stop event payload); if the literal string `"Plan mode is active"` appears, it emits `[plan-integrity] WARNING: Plan presented but plan-sdlc was not invoked (no plan integrity state for branch <branch>). Quality gates may have been bypassed.` The hook MUST always exit 0 on every code path (advisory-only, non-blocking). Unexpected errors are swallowed by a top-level try/catch with silent exit 0. (Fixes #285.)
- R22 (Fixes #388 — single-touchpoint handoff): Step 7 (Handoff) is the SOLE user touchpoint for the finalized plan. Step 0 session-recovery and Step 4 approval gates MUST NOT prompt the user — both run autonomously. The Step 3 self-critique and Step 5 IMPROVE loop apply fixes (including Guardrail Compliance updates) without user interaction. Genuine user-decision gates that remain (and are explicitly preserved): (1) requirements gathering when the spec is missing or ambiguous, (2) scope-split prompts, (3) OpenSpec routing, (4) the Step 6 reviewer-loop max-iterations escalation, (5) the Step 4 error-severity guardrail-block harden offer (R19), (6) the Step 7 handoff menu. Rationale: removes one premature checkpoint that operators cannot skip plus one redundant prompt that duplicates the Step 7 menu; downstream `--auto` automation needs deterministic non-interactive plan generation.
- R23 (Fixes #388 — Step 0 session-recovery default): When the designated plan file already has content at Step 0, the skill MUST restart and overwrite without prompting. The prior draft is discarded; the user retains full control by `cp`ing the file before invocation. Rationale: stale drafts are rarely worth resuming, deterministic behavior is required for `--auto`, and the alternative (prompting) is the very user touchpoint R22 forbids. Existing R20 plan-integrity markers (`skillInvoked`, `planFile`, `guardrailsEvaluated`, `critiqueRan`) are UNAFFECTED by this requirement — they continue to be written at the same sites regardless of whether the plan file existed before the run.
- R24 (Fixes #408 — Orchestrator dispatch): When `explorePack.manifestPath` is non-null AND complexity routing landed at full pipeline (4+ files), Step 1 dispatches `sdlc:plan-explore-orchestrator` exactly once. Lightweight scope (≤3 files) skips the orchestrator entirely and uses inline exploration as today.
- R25 (Fixes #408 — Dynamic dimensions): The orchestrator's SCOPE step emits 3–7 kebab-case task-specific dimensions in JSON `{ name, description, files[], mode, model }`. Names MUST NOT be the literal generic axes "architecture" / "tests" / "security" alone — they must be task-shaped (e.g., `auth-middleware-integration`, `cli-flag-parser-refactor`).
  - R25a (Web-mode rules): When `explorePack.webResearchSignal` is true OR the task involves a novel external technology, the orchestrator MUST emit ≥1 dimension with `mode: web` or `mode: hybrid`. Per-mode budgets: `web` ≤5 searches + ≤8 fetches; `hybrid` ≤3 searches + ≤5 fetches. Web dimensions are FORBIDDEN for pure internal refactors (when `webResearchSignal` is false AND the prompt indicates rename/move/dead-code removal).
- R26 (Fixes #408 — Discovery brief artifact): The orchestrator writes `discovery-brief.md` to `manifest.outDir/discovery-brief.md` with stable `F-<DIM>-<n>` finding IDs. Code findings format: `F-<DIM>-<n>: file:line — observation`. Web findings format: `F-<DIM>-<n>: <url> — observation (recency, source-type)`. Hybrid findings are tagged `[web-only | verified-in-codebase | conflicts-with-codebase]`. When web/hybrid dimensions ran, the brief includes a `## Best-Practice Synthesis` section.
- R27 (Fixes #408 — Brief traceability): Step 2 cites brief finding IDs in task descriptions. Standard/Complex tasks each reference ≥1 `F-<DIM>-<n>` ID OR are explicitly marked "out-of-scope addition" with rationale. Trivial tasks are exempt. When web/hybrid dimensions ran, Key Decisions explicitly ADOPTS / REJECTS-with-rationale / marks NOT-APPLICABLE each web finding, citing its ID.
- R28 (Fixes #408 — Orchestrator-failure fallback): When `explorePack.error` is non-null OR the orchestrator returns non-zero, Step 1 falls back to inline exploration without the brief. Plan is still produced. Failure is logged to `.sdlc/learnings/log.md`.
- R29 (Fixes #414 — `openspec-task` annotation requirement): When `--from-openspec <name>` is passed AND the change has a `tasks.md`, plan-sdlc MUST annotate every plan task derived from an OpenSpec task with an `openspec-task: { change, ref, line, title }` block. `ref` is a stable kebab-slug-plus-6-char-content-hash identifier of the OpenSpec task title. Plan tasks not derived from any OpenSpec task MUST omit the field. N:1 mapping (multiple plan tasks → same ref) is allowed and intentional. Rationale: #414.
- R30 (Fixes #414 — tasks.md coverage requirement): When R29 applies, every `- [ ]` line in source tasks.md MUST map to at least one plan task carrying the corresponding `openspec-task.ref`, OR be explicitly listed in a plan section titled `## Out-of-scope OpenSpec tasks` with a one-line rationale per entry. Uncovered tasks with no documented out-of-scope entry are a blocking critique failure (G16).
- R-config-version (issue #232): The prepare script `skill/plan.js` MUST call `verifyAndMigrate(projectRoot, 'project')` at start. The call is short-circuited when CLI `--skip-config-check` OR env `SDLC_SKIP_CONFIG_CHECK=1` is present; both gates resolve into a single `flags.skipConfigCheck` boolean in the prepare output (CLI > env > default false). On migration failure the prepare emits non-zero exit and an `errors[]` entry naming the failing step; SKILL.md halts with that text verbatim.
  - Acceptance: prepare output includes `flags.skipConfigCheck` and a `migration` block (or null when skipped); SKILL.md gates further work on `errors.length === 0`.

## Workflow Phases

1. SETUP — mode detection, routing, OpenSpec integration, complexity routing, guardrail loading via `skill/plan.js`
   - **Script:** `skill/plan.js`
   - **Params:** `--from-openspec <name>` (from A2) when applicable
   - **Output:** JSON → P1-P7 (openspec detection/active changes/branch match, from-openspec validation/delta spec count/tasks presence, plan guardrails array)
2. CONSUME — requirements discovery, codebase exploration, OpenSpec enrichment
3. PLAN — decompose into tasks with per-task metadata, key decisions, file structure mapping
4. CRITIQUE — self-review against all 14 quality gates
5. IMPROVE — autonomous fix loop; apply Step 3 self-critique findings and Guardrail Compliance updates; no user interaction.
6. CRITIQUE — plan review loop (cross-model, max 3 iterations; skip for lightweight)
7. IMPROVE — apply review fixes, re-dispatch reviewer
8. HANDOFF — announce plan path, present workflow continuation menu (execute/ship/done)

## Quality Gates

- G1: Requirements coverage — every requirement has at least one task
- G2: No orphan tasks — every task traces back to a requirement
- G3: Dependency integrity — no circular deps; every named dependency exists
- G4: File conflict potential — two tasks modifying the same file are in dependency order
- G5: Context sufficiency — each task description is self-contained for agent dispatch
- G6: Classification accuracy — complexity/risk assignments match heuristics
- G7: No scope creep — no tasks beyond stated requirements
- G8: Verification completeness — every task has at least one verification method
- G9: Decomposition balance — no task touches >5 files; no plan with >80% Trivial tasks
- G10: File existence — every "Modify:" path exists in the codebase
- G11: OpenSpec requirements coverage — every ADDED/MODIFIED delta spec requirement has at least one task (when openspecContext available)
- G12: Dependency target existence — every "Depends on: Task N" references a task that exists
- G13: Self-containment test — the most complex task can be implemented from its description + Key Decisions alone
- G14: Guardrail compliance — each guardrail evaluated against the plan; error-severity failures are blocking, warning-severity are advisory
- G15: Brief citation coverage — when `explorePack.manifestPath` was non-null AND the orchestrator produced a brief, every Standard/Complex task cites ≥1 `F-<DIM>-<n>` finding ID OR is marked "out-of-scope addition" with rationale. Trivial tasks are exempt. Severity: error when brief was produced; not applicable when fallback path ran.
- G16: OpenSpec tasks.md coverage — when `fromOpenspecDirect` is true: every entry in `openspecContext.tasks[]` is either (a) referenced by ≥1 plan task's `openspec-task.ref`, or (b) listed in `## Out-of-scope OpenSpec tasks`. Error severity (blocking).

## Prepare Script Contract

- P1: `openspec.detected` (boolean) — whether OpenSpec is present in the project
- P2: `openspec.activeChanges` (array) — list of active (non-archived) change names
- P3: `openspec.branchMatch` (object | null) — `{ name, stage }` if a change matches the current branch
- P4: `fromOpenspec.valid` (boolean) — whether `--from-openspec` resolved to a valid change
- P5: `fromOpenspec.deltaSpecs` (number) — count of delta spec files found
- P6: `fromOpenspec.hasTasks` (boolean) — whether tasks.md exists for the change
- P7: `guardrails` (array) — plan guardrails from `.sdlc/config.json` → `plan.guardrails`
- P8: `explorePack.manifestPath` (string | null) — absolute path to the manifest JSON written by `plan-explore.js` inside the per-invocation tempdir, or null when the script failed (lightweight-scope skip is a SKILL.md concern, not the prepare script's: the script always writes a manifest on success regardless of scope size)
- P9: `explorePack.outDir` (string | null) — absolute path to the per-invocation tempdir created by `plan-explore.js` (e.g., `os.tmpdir()/sdlc-explore-<branchSlug>-XXXX`), or null
- P10: `explorePack.scopeHintCount` (number) — integer count of files in the scope-hint set assembled by `plan-explore.js` (0 when no git changes and no OpenSpec paths and no keyword matches)
- P11: `explorePack.error` (string | null) — non-null when `plan-explore.js` failed or returned a non-zero exit; the string contains the error message. Non-null signals the consumer to use the fallback inline-exploration path (R28).
- P12: `explorePack.webResearchSignal` (boolean) — true when the user prompt matches best-practice phrases or external-technology tokens in `plan-explore.js`'s regex; false otherwise. Consumed by the orchestrator's SCOPE step to determine whether web/hybrid dimensions are required (R25a).
- P13: `openspecContext.tasks` (array | null) — structured task list parsed from `openspec/changes/<name>/tasks.md` when `--from-openspec` is valid; each entry has `{ ref, line, title, indent }`. Null when `hasTasks` is false.

## Error Handling

- E1: Spec/requirements not found → ask user to provide path or paste content
- E2: Codebase exploration fails (too large) → ask user to point to relevant directories
- E3: Plan reviewer loop exceeds 3 iterations → surface unresolved issues to user
- E4: Requirements are contradictory → flag specific contradictions, ask user to resolve
- E5: Output path fails → retry with different path; offer to print plan to screen
- E6: Prepare/orchestrator failure recovery — when `plan-explore.js` invocation fails or `sdlc:plan-explore-orchestrator` exits non-zero, plan-sdlc falls back to inline exploration. Append a one-line note to `.sdlc/learnings/log.md` with the error string (`## YYYY-MM-DD — plan-sdlc orchestrator skipped: <error>`). Brief absence is not a plan failure — the plan is still produced via the inline-exploration path.

## Constraints

- C1: Must not write implementation code in the plan (code snippets for patterns are fine)
- C2: Must not mandate TDD for every task — match verification to task type
- C3: Must not invoke execute-plan-sdlc within the same turn as plan-sdlc
- C4: Must not create plans with fewer than 2 tasks
- C5: Must not skip the plan review loop (unless lightweight routing)
- C6: Must not use absolute file paths that only work on one machine
- C7: Must not put plans in `$TMPDIR` — plans must survive session boundaries
- C8: Must not ignore plan mode's designated file path when plan mode is active
- C9: Must not skip, bypass, or defer prepare script execution — the script must run and exit successfully before any skill phase begins
- C10: Must not override, reinterpret, or discard prepare script output — for every P-field, the script return value is authoritative and final; the skill must not substitute LLM-generated alternatives
- C11: Must not independently compute, infer, or fabricate values for any field the prepare script is contracted to provide — if the script fails or a field is absent, the skill must stop rather than fill in data
- C12: Must not re-derive data the prepare script already computes via shell commands, tool calls, or LLM inference — script output is the sole source for all factual context, preserving deterministic behavior

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

- I1: `skill/plan.js` — context detection (OpenSpec, guardrails, branch matching)
- I2: `execute-plan-sdlc` — consumes the plan this skill produces
- I3: `ship-sdlc` — can invoke execute-plan-sdlc with this plan
- I4: OpenSpec — optional spec-driven planning via `--spec` or `--from-openspec`
- I5: Plan reviewer subagent — cross-model review for plans with 5+ tasks
- I6: ExitPlanMode — called at handoff when plan mode is active
- I7: plan-sdlc writes `<!-- ref:<ref> -->` HTML comments to source tasks.md exactly once per line (idempotent, additive). The Markdown rendering of tasks.md is unchanged (HTML comments are invisible).
