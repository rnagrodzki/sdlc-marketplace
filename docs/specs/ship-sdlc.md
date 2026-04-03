# ship-sdlc Specification

> End-to-end feature shipping pipeline: execute plan, commit, review, fix critical issues, version, and open a PR. Chains six sub-skills sequentially with conditional review-fix loop, state persistence, and resume support.

**User-invocable:** yes
**Model:** opus
**Prepare script:** `ship-prepare.js`

## Arguments

- A1: `--auto` — run pipeline non-interactively; forwarded to sub-skills that support it (default: false)
- A2: `--skip <steps>` — comma-separated steps to skip; valid: execute, commit, review, received-review, commit-fixes, version, pr (default: from config or none)
- A3: `--preset full|balanced|minimal` — execution preset forwarded to execute-plan-sdlc (default: from config or balanced)
- A4: `--bump patch|minor|major` — version bump type forwarded to version-sdlc (default: from config or patch)
- A5: `--draft` — create PR as draft (default: from config or false)
- A6: `--dry-run` — display pipeline plan without executing (default: false)
- A7: `--resume` — resume pipeline from saved state file (default: false)
- A8: `--workspace branch|worktree|prompt` — workspace isolation mode (default: from config or prompt)
- A9: `--init-config` — run interactive config wizard, no pipeline execution (default: false)

## Core Requirements

- R1: 7-step pipeline sequence: execute-plan-sdlc → commit-sdlc → review-sdlc → received-review-sdlc (conditional) → commit-sdlc fixes (conditional) → version-sdlc → pr-sdlc
- R2: All sub-skills dispatched as Agents (never Skill tool) to maintain context isolation — each Agent loads its SKILL.md independently
- R3: Pipeline plan is a binding contract: steps with `status: "will_run"` must execute; LLM cannot override
- R4: Step statuses computed by `ship-prepare.js`: `will_run`, `skipped`, `conditional`
- R5: Skip set provenance tracked via `skipSource`: `cli`, `config`, `auto`, `condition`, `none`; fabrication guard warns on `default` source
- R6: Review verdict conditional logic: CHANGES REQUESTED (critical or ≥3 high) → pause, invoke received-review; APPROVED WITH NOTES (high or ≥5 medium) → invoke received-review if high exists; APPROVED → continue
- R7: `--auto` forwarding audit: only forwarded to commit-sdlc, received-review-sdlc, version-sdlc, pr-sdlc (not execute-plan-sdlc, not review-sdlc)
- R8: Staging gap between execute and commit: `git add -A -- ':!.sdlc/'` required
- R9: Rebase onto default branch after all commits, before version step; abort and pause on conflict
- R10: State persistence after each step via `ship-state.js`; cleanup on success, preserve on failure
- R11: Resume via `--resume`: re-enter worktree if applicable, continue from first incomplete step
- R12: Version step auto-skipped in worktree mode (tags are repo-global); advisory printed post-pipeline
- R13: Worktree PRs auto-label `skip-version-check` when version auto-skipped
- R14: Double commit intentional: feature commit (step 2) and review fix commit (step 5) kept separate
- R15: `--dry-run` displays pipeline table and stops without executing
- R16: `--init-config` redirects to `/setup-sdlc`; runs interactive wizard if user insists
- R17: Deferred review findings (medium/low) collected and displayed in final summary
- R18: Ship config is optional and developer-local (`.sdlc/local.json`); pipeline runs with built-in defaults
- R19: Prepare script output is the single authoritative source for all contracted fields (P-fields) — script-provided values take unconditional precedence over skill-generated content, and all factual context (git state, config, flags, metadata) must originate from script output to ensure deterministic behavior

## Workflow Phases

1. CONSUME — load config, parse flags, run `ship-prepare.js` for context detection and step computation
   - **Script:** `ship-prepare.js`
   - **Params:** A1-A8 forwarded (`--auto`, `--skip <csv>`, `--preset`, `--bump`, `--draft`, `--resume`, `--workspace`); internal: `--has-plan` (from plan context detection)
   - **Output:** JSON → P1-P6 (flags with per-flag provenance sources, resume detection, context with branch/auth/openspec/worktree, pipeline steps with status/reason/skipSource/invocation, config)
2. PLAN — build pipeline table from `ship-prepare.js` steps array; display flag resolution and auto-skip decisions
3. CRITIQUE — validate pipeline: gh auth, branch safety, skip values, flag coherence
4. DO — present pipeline for confirmation (or auto/dry-run); execute steps sequentially via Agent dispatch
   - **Script:** `ship-state.js`
   - **Params:** subcommands per step lifecycle: `init`, `start`, `complete`, `skip`, `fail`, `decide`, `defer`
   - **Output:** JSON state object persisted to `.sdlc/execution/ship-<branch>-<timestamp>.json` for `--resume` support
5. REPORT — summary table with per-step results, decisions log, deferred findings, worktree cleanup
   - **Script:** `ship-state.js`
   - **Params:** subcommand `cleanup` (on success) or `read` (on failure, state preserved)
   - **Output:** state file removed on success; preserved on failure for `--resume`

## Quality Gates

- G1: `gh` CLI authenticated — `gh auth status` succeeds
- G2: Not on default branch — warn if on main/master (do not block)
- G3: Skip values valid — all `--skip` values are recognized step names
- G4: At least one step will run — pipeline is not entirely skipped
- G5: Flag coherence — `--bump` without version step produces warning
- G6: Pipeline contract — every `will_run` step was dispatched as Agent
- G7: Staging gap filled — `git add -A -- ':!.sdlc/'` ran between execute and commit
- G8: Rebase attempted — rebase ran after commits, before version (when applicable)

## Prepare Script Contract

- P1: `flags` (object) — resolved flags with `sources` map showing CLI/config/default provenance per flag
- P2: `resume` (object) — `{ found, stateFile }` resume detection result
- P3: `context` (object) — `{ planInContext, uncommittedChanges, currentBranch, defaultBranch, ghAuth, openspec, sdlcGitignored, worktree }`
- P4: `steps` (array) — pipeline steps, each with `{ skill, status, reason, skipSource, args, invocation, pause }`
- P5: `steps[].invocation` (string) — exact skill name + computed args for Agent dispatch
- P6: `config` (object | null) — ship config from `.sdlc/local.json` or null if absent

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
- C9: Must not copy example args from SKILL.md — use `step.invocation` from ship-prepare.js
- C10: Must not add `--skip` flags not present in user invocation or ship config
- C11: Must not skip, bypass, or defer prepare script execution — the script must run and exit successfully before any skill phase begins
- C12: Must not override, reinterpret, or discard prepare script output — for every P-field, the script return value is authoritative and final; the skill must not substitute LLM-generated alternatives
- C13: Must not independently compute, infer, or fabricate values for any field the prepare script is contracted to provide — if the script fails or a field is absent, the skill must stop rather than fill in data
- C14: Must not re-derive data the prepare script already computes via shell commands, tool calls, or LLM inference — script output is the sole source for all factual context, preserving deterministic behavior

## Integration

- I1: `ship-prepare.js` — pre-computes flags, context, step statuses, and invocations
- I2: `ship-state.js` — pipeline state management for pause/resume
- I3: `ship-init.js` — interactive config wizard for `--init-config`
- I4: `execute-plan-sdlc` — step 1: plan execution
- I5: `commit-sdlc` — steps 2 and 5: feature commit and review fix commit
- I6: `review-sdlc` — step 3: multi-dimension code review
- I7: `received-review-sdlc` — step 4 (conditional): process review findings
- I8: `version-sdlc` — step 6: semantic versioning and release tag
- I9: `pr-sdlc` — step 7: pull request creation
- I10: `setup-sdlc` — redirect target for `--init-config`
- I11: `worktree-create.js` — worktree creation for workspace isolation
- I12: OpenSpec — optional; suggests `/opsx:verify` and `/opsx:archive` post-pipeline when detected
