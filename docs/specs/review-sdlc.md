# review-sdlc Specification

> Thin dispatcher that runs the review prepare script, then delegates multi-dimension code review to the review-orchestrator agent.

**User-invocable:** yes
**Model:** sonnet
**Prepare script:** `review-prepare.js`

## Arguments

- A1: `--base <branch>` — base branch for diff comparison (default: auto-detected)
- A2: `--committed` — review only committed changes (default: false)
- A3: `--staged` — review only staged changes (default: false)
- A4: `--working` — review only working tree changes (default: false)
- A5: `--worktree` — review changes in the current worktree (default: false)
- A6: `--set-default` — persist the selected scope as default (default: false)
- A7: `--dimensions <name,...>` — limit review to specific dimensions (default: all configured)
- A8: `--dry-run` — show review plan without dispatching subagents (default: false)

## Core Requirements

- R1: Run `review-prepare.js` to produce a manifest file; do NOT read the manifest into main context
- R2: Scope flags (`--committed`, `--staged`, `--working`, `--worktree`) are mutually exclusive
- R3: When `--dry-run` is passed, read the manifest, display the review plan in the specified format, clean up, and stop
- R4: Delegate to the `review-orchestrator` agent (via Agent tool, NOT Skill tool) with the manifest file path and project root
- R5: On orchestrator failure, re-dispatch once with the same inputs; on second failure, invoke error-report-sdlc
- R6: After orchestrator returns, offer self-fix via `received-review-sdlc` when verdict is CHANGES REQUESTED or APPROVED WITH NOTES
- R7: When verdict is APPROVED, skip the self-fix offer
- R8: Clean up the manifest temp file after completion
- R9: Prepare script output is the single authoritative source for all contracted fields (P-fields) — script-provided values take unconditional precedence over skill-generated content, and all factual context (git state, config, flags, metadata) must originate from script output to ensure deterministic behavior

## Workflow Phases

1. CONSUME — run prepare script to produce manifest file
2. DO — dispatch review-orchestrator agent (or display dry-run plan)
3. REPORT — display orchestrator summary, clean up manifest
4. OFFER — conditionally offer self-fix based on review verdict

## Quality Gates

- G1: Manifest file produced — `review-prepare.js` exits successfully and produces a valid file path
- G2: Orchestrator dispatched — agent is spawned (not via Skill tool) with manifest path and project root
- G3: Manifest cleaned up — temp file is deleted after completion or cancellation

## Prepare Script Contract

- P1: `base_branch` (string) — base branch used for diff
- P2: `git.changed_files` (array) — list of changed file paths
- P3: `summary.active_dimensions` (number) — count of active review dimensions
- P4: `summary.skipped_dimensions` (number) — count of skipped dimensions
- P5: `dimensions` (array) — per-dimension entries with files, severity, status
- P6: `plan_critique.uncovered_files` (string[]) — files not covered by any dimension
- P7: `plan_critique.over_broad_dimensions` (string[]) — dimensions reviewing too many files
- P8: `plan_critique.uncovered_suggestions` (array) — suggested additional dimensions

## Error Handling

- E1: `review-prepare.js` exit 1 → show stderr message, stop (no error report)
- E2: `review-prepare.js` exit 2 (crash) → show stderr, invoke error-report-sdlc
- E3: Orchestrator fails once → re-dispatch with same inputs
- E4: Orchestrator fails twice → invoke error-report-sdlc

## Constraints

- C1: Must not read the manifest JSON into main context (orchestrator reads it)
- C2: Must not read REFERENCE.md in main context (orchestrator resolves it)
- C3: Must not invoke the orchestrator via the Skill tool — must use Agent tool
- C4: Must not invoke error-report-sdlc for user errors — only for script crashes (exit 2) and repeated orchestrator failures
- C5: Must not skip, bypass, or defer prepare script execution — the script must run and exit successfully before any skill phase begins
- C6: Must not override, reinterpret, or discard prepare script output — for every P-field, the script return value is authoritative and final; the skill must not substitute LLM-generated alternatives
- C7: Must not independently compute, infer, or fabricate values for any field the prepare script is contracted to provide — if the script fails or a field is absent, the skill must stop rather than fill in data
- C8: Must not re-derive data the prepare script already computes via shell commands, tool calls, or LLM inference — script output is the sole source for all factual context, preserving deterministic behavior

## Integration

- I1: `review-prepare.js` — produces the review manifest with all git data
- I2: `review-orchestrator` agent — performs the actual multi-dimension review
- I3: `received-review-sdlc` — invoked to address review findings when verdict warrants
- I4: `setup-sdlc --dimensions` — creates the review dimension configuration
- I5: `commit-sdlc` — common follow-up after review approval
- I6: `error-report-sdlc` — invoked on script crashes and repeated orchestrator failures
