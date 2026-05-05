# review-sdlc Specification

> Thin dispatcher that runs the review prepare script, then delegates multi-dimension code review to the review-orchestrator agent.

**User-invocable:** yes
**Model:** sonnet
**Prepare script:** `skill/review.js`

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

- R1: Run `skill/review.js` to produce a manifest file; do NOT read the manifest into main context
- R2: Scope flags (`--committed`, `--staged`, `--working`, `--worktree`) are mutually exclusive
- R3: When `--dry-run` is passed, read the manifest, display the review plan in the specified format, clean up, and stop
- R4: Delegate to the `review-orchestrator` agent (via Agent tool, NOT Skill tool) with the manifest file path and project root
- R5: On orchestrator failure, re-dispatch once with the same inputs; on second failure, invoke error-report-sdlc
- R6: After orchestrator returns, offer self-fix via `received-review-sdlc` when verdict is CHANGES REQUESTED or APPROVED WITH NOTES
- R7: When verdict is APPROVED, skip the self-fix offer
- R8: Clean up the manifest temp file after completion
- R9: Prepare script output is the single authoritative source for all contracted fields (P-fields) — script-provided values take unconditional precedence over skill-generated content, and all factual context (git state, config, flags, metadata) must originate from script output to ensure deterministic behavior
- R10: Post-confirmation (`yes` / `save` / `cancel`) is issued by the skill in the main context, not by the orchestrator
- R11: Orchestrator writes the consolidated comment body to `${manifest.diff_dir}/review-comment.md` and returns its absolute path plus `pr.*` metadata in its summary; the skill acts on the summary without reading the manifest
- R12: When the user confirms `yes`, the skill posts via `gh api … -F body=@<path>` — no further Agent dispatch is made to complete posting
- R13: After the orchestrator returns, the skill MUST read `${diff_dir}/review-comment.md` and display its full contents verbatim in the main context before any posting prompt — the orchestrator summary alone is insufficient because it contains only severity counts, not per-finding detail
- R14: Link verification (issue #198) — every URL embedded in the consolidated review comment body MUST be validated by `plugins/sdlc-utilities/scripts/lib/links.js` (CLI: `node scripts/lib/links.js --json`) before `gh api … /comments`. Three URL classes are checked: (1) `github.com/<owner>/<repo>/(issues|pull)/<n>` — owner/repo identity must match the current remote, and the issue/PR number must exist on that repo; (2) `*.atlassian.net/browse/<KEY-N>` — host must match the configured Jira site; (3) any other `http(s)://` URL — generic reachability via HEAD (fall back to GET on 405), 5s timeout. Hosts in the built-in skip list (`linkedin.com`, `x.com`, `twitter.com`, `medium.com`) and any `ctx.skipHosts` entries are reported as `skipped`, not violations. `SDLC_LINKS_OFFLINE=1` skips network checks but keeps structural context-aware checks (GitHub identity match, Atlassian host match). Any violation aborts posting with non-zero exit and a structured violation list — no soft-warning mode.

## Workflow Phases

1. CONSUME — run prepare script to produce manifest file
   - **Script:** `skill/review.js`
   - **Params:** A1-A7 forwarded (`--base <branch>`, `--committed`, `--staged`, `--working`, `--worktree`, `--set-default`, `--dimensions <list>`)
   - **Output:** manifest file path → P1-P8 (base branch, changed files, dimension counts/entries, plan critique); also writes per-dimension `.diff` files to tmpdir. Skill must NOT read manifest into main context
2. DO — dispatch review-orchestrator agent (or display dry-run plan)
3. REPORT — display orchestrator summary and full consolidated comment body
4. POST — skill handles PR posting decision in main context (`yes` / `save` / `cancel` or no-PR options), then cleans up manifest and diff dir
5. OFFER — conditionally offer self-fix based on review verdict

## Quality Gates

- G1: Manifest file produced — `skill/review.js` exits successfully and produces a valid file path
- G2: Orchestrator dispatched — agent is spawned (not via Skill tool) with manifest path and project root
- G3: Manifest file and `diff_dir` cleaned up by the skill after the terminal branch (including failures)
- G4: Exactly one `review-orchestrator` Agent dispatch per `/review-sdlc` invocation (a retry on failure counts as the same attempt; user confirmation never triggers a new dispatch)
- G5: Full comment body displayed — Step 3 emits the verbatim contents of `${diff_dir}/review-comment.md` in the main context before the posting prompt is shown

## Prepare Script Contract

- P1: `base_branch` (string) — base branch used for diff
- P2: `git.changed_files` (array) — list of changed file paths
- P3: `summary.active_dimensions` (number) — count of active review dimensions
- P4: `summary.skipped_dimensions` (number) — count of skipped dimensions
- P5: `dimensions` (array) — per-dimension entries with files, severity, status
- P6: `plan_critique.uncovered_files` (string[]) — files not covered by any dimension
- P7: `plan_critique.over_broad_dimensions` (string[]) — dimensions reviewing too many files
- P8: `plan_critique.uncovered_suggestions` (array) — suggested additional dimensions
- P9: `subagent_model` (string) — model for dimension subagent dispatch (default: `"sonnet"`)

## Error Handling

- E1: `skill/review.js` exit 1 → show stderr message, stop (no error report)
- E2: `skill/review.js` exit 2 (crash) → show stderr, invoke error-report-sdlc
- E3: Orchestrator fails once → re-dispatch with same inputs
- E4: Orchestrator fails twice → invoke error-report-sdlc

## Constraints

- C1: Must not read the manifest JSON into main context (orchestrator reads it)
- C2: Must not read REFERENCE.md in main context (orchestrator resolves it)
- C3: Must not invoke the orchestrator via the Skill tool — must use Agent tool
- C4: Must not invoke error-report-sdlc for user errors — only for script crashes (exit 2) and repeated orchestrator failures
- C5: Orchestrator MUST pass `manifest.subagent_model` to each dimension subagent Agent dispatch via the `model:` parameter
- C6: Must not skip, bypass, or defer prepare script execution — the script must run and exit successfully before any skill phase begins
- C7: Must not override, reinterpret, or discard prepare script output — for every P-field, the script return value is authoritative and final; the skill must not substitute LLM-generated alternatives
- C8: Must not independently compute, infer, or fabricate values for any field the prepare script is contracted to provide — if the script fails or a field is absent, the skill must stop rather than fill in data
- C9: Must not re-derive data the prepare script already computes via shell commands, tool calls, or LLM inference — script output is the sole source for all factual context, preserving deterministic behavior
- C10: Orchestrator MUST NOT call `gh api` or prompt the user for PR-posting confirmation
- C11: Orchestrator MUST NOT delete `manifest.diff_dir` — the skill owns cleanup of both the manifest file and the diff dir
- C12: Skill MUST NOT re-dispatch the orchestrator to complete a posting flow already computed — `comment_file` from the orchestrator summary is authoritative

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

- I1: `skill/review.js` — produces the review manifest with all git data
- I2: `review-orchestrator` agent — performs the actual multi-dimension review
- I3: `received-review-sdlc` — invoked to address review findings when verdict warrants
- I4: `setup-sdlc --dimensions` — creates the review dimension configuration
- I5: `commit-sdlc` — common follow-up after review approval
- I6: `error-report-sdlc` — invoked on script crashes and repeated orchestrator failures
