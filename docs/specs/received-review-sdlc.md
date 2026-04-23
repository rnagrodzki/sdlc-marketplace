# received-review-sdlc Specification

> Process code review feedback with technical verification against the full codebase, dual self-critique gates, and incremental PR thread processing. Prevents performative agreement and ensures pushback where warranted.

**User-invocable:** yes
**Model:** sonnet
**Prepare script:** `skill/received-review.js`

## Arguments

- A1: `--pr <number>` — PR number to process review comments from (default: none, falls back to manual gathering)
- A2: `--auto` — auto-implement "will fix" items without Step 10 consent; also auto-runs Step 12 (post in-thread replies and resolve "agree, will fix" threads) without consent. "disagree"/"needs discussion"/"won't fix" items are displayed but never auto-implemented; their threads are replied to but not resolved (default: false)

## Core Requirements

- R1: 12-step workflow: READ → UNDERSTAND → VERIFY → EVALUATE → CRITIQUE #1 → IMPROVE #1 → RESPOND → CRITIQUE #2 → IMPROVE #2 → PRESENT → IMPLEMENT → REPLY & RESOLVE
- R2: Dual self-critique gates: first gate reviews evaluation quality (Step 5-6), second gate reviews response quality (Step 8-9)
- R3: Critique gate output is internal only — never displayed to the user
- R4: Every feedback item verified against the full codebase (not just the change diff) before evaluation
- R5: Five verification statuses: confirmed, confirmed but suggestion incomplete, incorrect, partially correct, cannot verify
- R6: Four evaluation outcomes: agree will fix, agree won't fix, disagree, needs discussion
- R7: Unclear items block all implementation — clarify ALL unclear items at once before proceeding
- R8: Incremental PR thread processing: prepare script identifies outstanding vs resolved/self-replied/stale threads; only outstanding threads are processed
- R9: Step 10 consent gate is mandatory unless `--auto` is explicitly passed — pipeline context does not override
- R10: Auto mode only auto-implements "will fix" items; "disagree", "needs discussion", and "won't fix" are never auto-actioned
- R11: PR thread replies use in-thread comment replies (REST API), not top-level PR comments
- R12: Thread resolution uses GraphQL `resolveReviewThread` mutation — only for "agree, will fix" items; pushback and won't-fix threads are left open
- R13: Forbidden openers: no performative language ("Great catch!", "You're right!", "Thanks!")
- R14: YAGNI check for feature requests: grep codebase for actual usage before accepting
- R15: Prepare script output is the single authoritative source for all contracted fields (P-fields) — script-provided values take unconditional precedence over skill-generated content, and all factual context (git state, config, flags, metadata) must originate from script output to ensure deterministic behavior
- R16: Under `--auto`, Step 12 posts in-thread replies for all action-plan items and resolves only "agree, will fix" threads without an AskUserQuestion gate; pushback and "won't fix" threads are replied to but left open for the reviewer

## Workflow Phases

1. READ — gather review feedback via prepare script (PR threads) or manual input
   - **Script:** `skill/received-review.js`
   - **Params:** A1-A2 forwarded (`--pr <number>`, `--auto`); internal params: `--owner <owner>`, `--repo <repo>`, `--project-root <path>`
   - **Output:** JSON → P1-P7 (threads with status classification, comment chains, auto flag, PR number/owner/repo)
2. UNDERSTAND — categorize items; flag and block on unclear items
3. VERIFY — check each item against full codebase context (callers, dependents, architecture)
4. EVALUATE — determine verdict per item (agree fix / agree won't fix / disagree / needs discussion)
5. CRITIQUE #1 (internal) — self-review evaluation against 5 gates
6. IMPROVE #1 (internal) — fix evaluation issues
7. RESPOND — draft responses per item (substance-first, no performative language)
8. CRITIQUE #2 (internal) — self-review responses against 7 gates
9. IMPROVE #2 (internal) — fix response issues
10. PRESENT — show analysis table, action plan, drafted responses; consent gate
11. IMPLEMENT — post responses, apply code changes (blocking → simple → complex order)
12. REPLY & RESOLVE — post PR thread replies and resolve addressed threads

## Quality Gates

Critique #1 (evaluation):
- G1: Verification completeness — every item verified against actual code
- G2: No blind agreement — disagreements exist where technically warranted
- G3: YAGNI applied — feature suggestions checked for real vs hypothetical need
- G4: Unclear items resolved — all unclear items clarified before proceeding
- G5: Technical grounding — every agree/disagree decision cites code or behavior

Critique #2 (responses):
- G6: No performative language — zero forbidden openers or gratuitous praise
- G7: Technically grounded — every response references specific code, behavior, or constraint
- G8: Pushback is technical — disagreements cite code, performance data, or design constraints
- G9: Thread-level replies — each response targets its specific comment thread
- G10: Implementation plan clear — for accepted items, response states what will change
- G11: No blind agreement — factual errors corrected, not accommodated
- G12: Proportional effort — simple fixes get short responses; complex items get detailed ones

## Prepare Script Contract

- P1: `threads` (array) — review threads with `{ id, databaseId, path, line, body, author, status }` per thread
- P2: `threads[].status` (string) — "outstanding" | "resolved" | "self-replied" | "stale"
- P3: `threads[].comments` (array) — comment chain within the thread
- P4: `flags.auto` (boolean) — whether `--auto` was passed
- P5: `pr.number` (number) — PR number
- P6: `pr.owner` (string) — repository owner
- P7: `pr.repo` (string) — repository name

## Error Handling

- E1: `skill/received-review.js` exit 1 → no PR found, fall back to manual feedback gathering
- E2: `skill/received-review.js` exit 2 (crash) → show stderr, invoke error-report-sdlc
- E3: `gh api` fails fetching PR comments → check auth, show error, ask user to supply feedback directly
- E4: Comment references file/line that no longer exists → verify against current HEAD
- E5: Cannot verify reviewer's claim → state limitation, ask user for direction
- E6: `gh api` 5xx posting reply → retry once; invoke error-report-sdlc on second failure
- E7: GraphQL resolve mutation fails → retry once; invoke error-report-sdlc on second failure

## Constraints

- C1: Must not use performative openers (gratitude, praise, "great catch")
- C2: Must not agree with factually incorrect claims to avoid conflict
- C3: Must not implement unclear feedback — clarify all unclear items first
- C4: Must not implement feature requests without YAGNI check
- C5: Must not reply top-level when comment is in a review thread
- C6: Must not skip self-critique steps even when evaluation seems obvious
- C7: Must not batch implement without testing each change individually
- C8: Must not display output from internal critique steps (Steps 5-6, 8-9) to user
- C9: Must not skip Step 10 consent gate without explicit `--auto` flag
- C10: Must not skip, bypass, or defer prepare script execution — the script must run and exit successfully before any skill phase begins
- C11: Must not override, reinterpret, or discard prepare script output — for every P-field, the script return value is authoritative and final; the skill must not substitute LLM-generated alternatives
- C12: Must not independently compute, infer, or fabricate values for any field the prepare script is contracted to provide — if the script fails or a field is absent, the skill must stop rather than fill in data
- C13: Must not re-derive data the prepare script already computes via shell commands, tool calls, or LLM inference — script output is the sole source for all factual context, preserving deterministic behavior
- C14: Must not present Step 12 consent gate when `flags.auto` is true — the reply/resolve step auto-executes under the same policy as manual `yes`

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

- I1: `skill/received-review.js` — pre-computes PR thread state with incremental processing
- I2: `gh` CLI / GitHub API — used for fetching comments, posting replies, resolving threads
- I3: `review-sdlc` — source of findings this skill may respond to
- I4: `commit-sdlc` — common follow-up to commit fixes
- I5: `error-report-sdlc` — invoked on script crashes and persistent API failures
- I6: `ship-sdlc` — may invoke this skill as part of the shipping pipeline
