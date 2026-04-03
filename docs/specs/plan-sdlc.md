# plan-sdlc Specification

> Decompose requirements into a classified, dependency-ordered implementation plan with per-task metadata ready for execute-plan-sdlc consumption. Designated plan-mode skill.

**User-invocable:** yes
**Model:** sonnet
**Prepare script:** `plan-prepare.js`

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

## Workflow Phases

1. SETUP — mode detection, routing, OpenSpec integration, complexity routing, guardrail loading via `plan-prepare.js`
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

## Integration

- I1: `plan-prepare.js` — context detection (OpenSpec, guardrails, branch matching)
- I2: `execute-plan-sdlc` — consumes the plan this skill produces
- I3: `ship-sdlc` — can invoke execute-plan-sdlc with this plan
- I4: OpenSpec — optional spec-driven planning via `--spec` or `--from-openspec`
- I5: Plan reviewer subagent — cross-model review for plans with 5+ tasks
- I6: ExitPlanMode — called at handoff when plan mode is active
