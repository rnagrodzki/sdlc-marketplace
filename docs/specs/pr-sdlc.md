# pr-sdlc Specification

> Generate and execute an 8-section PR description (or custom template) from pre-computed git context, with auto-labeling, title pattern validation, and create/update mode support.

**User-invocable:** yes
**Model:** sonnet
**Prepare script:** `skill/pr.js`

## Arguments

- A1: `--draft` — create PR as a draft (default: false)
- A2: `--update` — update an existing PR instead of creating a new one (default: false)
- A3: `--base <branch>` — target base branch for the PR (default: auto-detected)
- A4: `--auto` — skip interactive approval; critique gates still run (default: false)
- A5: `--label <name>` — force a label onto the PR; repeatable; creates label if missing in repo (default: none)

## Core Requirements

- R1: Default template has 8 mandatory sections: Summary, JIRA Ticket, Business Context, Business Benefits, Technical Design, Technical Impact, Changes Overview, Testing
- R2: When `customTemplate` is present, parse its `## Heading` sections and use those instead of the default 8 sections
- R3: All sections in the active template must always be present — fill with real content, "N/A", or "Not detected"; never omit or leave empty
- R4: Changes Overview uses logical concepts only — zero file paths in this section
- R5: PR title must be under 72 characters
- R6: When `prConfig.titlePattern` is set, validate title against the regex before executing `gh` CLI (hard gate)
- R7: When `prConfig.allowedTypes` or `allowedScopes` are set, constrain title generation accordingly
- R8: Label inference via fuzzy-match against `repoLabels` using 5 signal types: branch prefix, commit subjects, changed file paths, diff size, Jira ticket type
- R9: Labels must exist in `repoLabels` — never fabricate labels not in the repository
- R10: Forced labels (`--label`) are always included, merged with inferred labels, and created via `gh label create` if missing in repo
- R11: In update mode, existing labels are preserved; only new labels are added via `--add-label`
- R12: When `--auto` is set, skip AskUserQuestion approval and apply labels directly; critique gates still run
- R13: OpenSpec enrichment: when an active OpenSpec change is detected, use proposal.md for Business Context/Benefits and design.md for Technical Design
- R14: Prepare script output is the single authoritative source for all contracted fields (P-fields) — script-provided values take unconditional precedence over skill-generated content, and all factual context (git state, config, flags, metadata) must originate from script output to ensure deterministic behavior

## Workflow Phases

1. CONSUME — run prepare script, read PR context JSON (commits, diff, labels, config, custom template)
   - **Script:** `skill/pr.js`
   - **Params:** A1-A5 forwarded (`--draft`, `--update`, `--base <branch>`, `--auto`, `--label <name>`)
   - **Output:** JSON → P1-P18 (mode, branches, draft flag, existing PR, jira ticket, commits, diff stats/content, changed files, repo labels, custom template, PR config, auth, remote state, warnings)
2. PLAN — draft all sections of the active template, draft title, infer labels
3. CRITIQUE — self-review against all 12 quality gates
4. IMPROVE — fix failing gates (max 2 iterations per gate); ask clarifying questions for Business Context/Benefits if needed
5. DO — present title, labels, and description; obtain approval (or auto-approve); validate title pattern; create labels JIT; execute `gh pr create` or `gh pr edit`

## Quality Gates

- G1: All sections present — every section in the active template has content (real, "N/A", or "Not detected")
- G2: Specificity — Summary names a concrete change, not vague ("various improvements")
- G3: Business honesty — Business Context/Benefits are concrete or "N/A"; no invented reasons
- G4: No file paths — Changes Overview uses concepts only (applies only if active template includes this section)
- G5: Title length — title is under 72 characters
- G6: Title pattern match — title matches `prConfig.titlePattern` regex (skip when null)
- G7: No fabrication — all claims traceable to commits, diff, or user input
- G8: JIRA accuracy — JIRA value matches evidence or is "Not detected"
- G9: Audience check — Summary and Business sections readable by non-technical stakeholders
- G10: Documentation sync — structural changes have corresponding docs updates or user confirmation
- G11: Label validity — every label in `suggestedLabels` exists in `repoLabels`
- G12: Forced label inclusion — every label in `forcedLabels` appears in the final label list

## Prepare Script Contract

- P1: `mode` (string: "create" | "update") — whether creating or updating a PR
- P2: `baseBranch` (string) — target base branch
- P3: `currentBranch` (string) — branch being PR'd
- P4: `isDraft` (boolean) — whether to create as draft
- P5: `existingPr` (object | null) — `{ number, title, url, state, labels }` for update mode
- P6: `jiraTicket` (string | null) — detected ticket reference
- P7: `commits` (array) — `[{ hash, subject, body, coAuthors }]`
- P8: `diffStat` (object) — `{ filesChanged, insertions, deletions, summary }`
- P9: `diffContent` (string) — full unified diff text
- P10: `changedFiles` (string[]) — relative file paths changed
- P11: `repoLabels` (array) — `[{ name, description }]` labels defined in the repository
- P12: `customTemplate` (string | null) — content of `.claude/pr-template.md` or null
- P13: `prConfig` (object | null) — PR title validation config from `.claude/sdlc.json`
- P14: `isAuto` (boolean) — whether `--auto` was passed
- P15: `forcedLabels` (string[]) — labels forced via `--label` flag(s)
- P16: `ghAuth` (object | null) — `{ switched, account, previousAccount }` GitHub account switch result
- P17: `remoteState` (object) — `{ pushed, remoteBranch, action }`
- P18: `warnings` (string[]) — non-fatal notes

## Error Handling

- E1: `skill/pr.js` exit 1 → show `errors[]`, stop (no error report)
- E2: `skill/pr.js` exit 2 (crash) → show stderr, invoke error-report-sdlc
- E3: `gh pr create` / `gh pr edit` fails with 5xx → show error, offer manual fallback, invoke error-report-sdlc
- E4: `gh` unavailable → show install instructions (no error report)
- E5: `gh` auth failure → show `gh auth login` instructions (no error report)
- E6: Title pattern validation fails → show error message, ask user to edit title
- E7: `gh pr create` fails with a repo-permission error → post-flight account-switch recovery (distinct from pre-flight `ensureGhAccount`): if a local gh account matching the repo owner is found, switch to it automatically and retry `gh pr create` exactly once; the user sees a single concise recovery line and not the raw error. If no matching account exists, surface the original error with a `gh auth login` hint for the correct hostname. A second consecutive permission failure is terminal. Max one retry per pipeline invocation. References issue #184.

## Constraints

- C1: Must not omit any section from the active template
- C2: Must not write generic descriptions ("various improvements", "code cleanup")
- C3: Must not fabricate JIRA ticket, business reason, or technical claim
- C4: Must not include file paths in Changes Overview
- C5: Must not execute `gh pr create/edit` without approval (unless `--auto`)
- C6: Must not skip the critique-improve cycle
- C7: Must not run git or gh bash commands to gather data — all context from `PR_CONTEXT_JSON`
- C8: Must not suggest labels not in `repoLabels`
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

- I1: `skill/pr.js` — provides all pre-computed PR context
- I2: `gh` CLI — used for PR creation, update, and label creation
- I3: `error-report-sdlc` — invoked on script crashes and persistent gh failures
- I4: OpenSpec — optional enrichment for Business Context/Benefits and Technical Design
- I5: `review-sdlc` — common follow-up after PR creation
- I6: `version-sdlc` — common follow-up after merge
- I7: `setup-sdlc --pr-template` — creates custom PR template
- I8: `commit-sdlc` — commit changes before creating PR
