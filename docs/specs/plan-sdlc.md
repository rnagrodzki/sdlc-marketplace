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

## Workflow Phases

1. SETUP — mode detection, routing, OpenSpec integration, complexity routing, guardrail loading via `skill/plan.js`
   - **Script:** `skill/plan.js`
   - **Params:** `--from-openspec <name>` (from A2) when applicable
   - **Output:** JSON → P1-P7 (openspec detection/active changes/branch match, from-openspec validation/delta spec count/tasks presence, plan guardrails array)
2. CONSUME — requirements discovery, codebase exploration, OpenSpec enrichment
3. PLAN — decompose into tasks with per-task metadata, key decisions, file structure mapping
4. CRITIQUE — self-review against all 14 quality gates
5. IMPROVE — fix all issues, present to user for approval (unbounded approval loop)
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

## Prepare Script Contract

- P1: `openspec.detected` (boolean) — whether OpenSpec is present in the project
- P2: `openspec.activeChanges` (array) — list of active (non-archived) change names
- P3: `openspec.branchMatch` (object | null) — `{ name, stage }` if a change matches the current branch
- P4: `fromOpenspec.valid` (boolean) — whether `--from-openspec` resolved to a valid change
- P5: `fromOpenspec.deltaSpecs` (number) — count of delta spec files found
- P6: `fromOpenspec.hasTasks` (boolean) — whether tasks.md exists for the change
- P7: `guardrails` (array) — plan guardrails from `.claude/sdlc.json` → `plan.guardrails`

## Error Handling

- E1: Spec/requirements not found → ask user to provide path or paste content
- E2: Codebase exploration fails (too large) → ask user to point to relevant directories
- E3: Plan reviewer loop exceeds 3 iterations → surface unresolved issues to user
- E4: Requirements are contradictory → flag specific contradictions, ask user to resolve
- E5: Output path fails → retry with different path; offer to print plan to screen

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
