# commit-sdlc Specification

> Generate and execute a git commit with a message matching the project's existing style, isolating staged changes via stash lifecycle management.

**User-invocable:** yes
**Model:** haiku
**Prepare script:** `commit-prepare.js`

## Arguments

- A1: `--no-stash` — skip stashing unstaged changes before commit (default: false)
- A2: `--scope <scope>` — override inferred commit scope (default: auto-detected)
- A3: `--type <type>` — override inferred commit type (default: auto-detected)
- A4: `--amend` — amend the most recent commit instead of creating a new one (default: false)
- A5: `--auto` — skip interactive approval prompt; critique gates still run (default: false)

## Core Requirements

- R1: Detect project commit style from the 15 most recent commits (conventional, plain imperative, ticket-prefix, or mixed)
- R2: Generate a commit message that matches the detected project style
- R3: When `commitConfig` is present, constrain type selection to `allowedTypes` and scope selection to `allowedScopes`
- R4: When `commitConfig.requireBodyFor` includes the selected type, the commit body must be non-empty
- R5: When `commitConfig.requiredTrailers` is set, include all listed trailer keys in the commit body
- R6: Validate subject line against `commitConfig.subjectPattern` regex before executing the commit; block on mismatch (hard gate, no override)
- R7: When `--amend` is set and `lastCommitMessage` is available, use it as the starting point and revise based on the current staged diff
- R8: When `--auto` is set, skip AskUserQuestion approval but still display the commit plan and run all critique gates
- R9: OpenSpec scope hint: when `flags.scope` is not set, check for an active OpenSpec change and use its directory name as a candidate scope (style precedence applies)
- R10: OpenSpec change trailer: when an active OpenSpec change is identified and a body is present, append an `OpenSpec-Change: <name>` trailer
- R11: Prepare script output is the single authoritative source for all contracted fields (P-fields) — script-provided values take unconditional precedence over skill-generated content, and all factual context (git state, config, flags, metadata) must originate from script output to ensure deterministic behavior

## Workflow Phases

1. CONSUME — read pre-computed context from `commit-prepare.js` output (staged diff, recent commits, branch, config, flags)
   - **Script:** `commit-prepare.js`
   - **Params:** A1-A5 forwarded (`--no-stash`, `--scope <s>`, `--type <t>`, `--amend`, `--auto`)
   - **Output:** JSON → P1-P13 (branch, flags, staged diff/stat/files, unstaged state, recent commits, last commit message, commit config)
2. PLAN — analyze diff and recent commits to generate commit message (type, scope, subject, body, trailers)
3. CRITIQUE — self-review message against all 10 quality gates
4. IMPROVE — fix failing gates (max 2 iterations per gate)
5. DO — present commit plan, obtain approval (or auto-approve), execute stash-commit-unstash sequence
6. CRITIQUE — verify commit was created and stash was restored

## Quality Gates

- G1: Style match — message follows project's commit style detected from `recentCommits`
- G2: Subject length — subject line is 72 characters or fewer
- G3: Accuracy — every claim in the message is traceable to `staged.diff` or `staged.diffStat`
- G4: Type correctness — commit type matches the nature of the change (feat=new, fix=bug, etc.)
- G5: Imperative mood — subject uses imperative form ("add" not "adds" or "added")
- G6: No fabrication — nothing in the message is invented beyond what the diff shows
- G7: Body relevance — body adds "why" context or is absent; does not restate the subject
- G8: Pattern match — subject matches `commitConfig.subjectPattern` regex (skip when config absent)
- G9: Required body — body present when type is in `commitConfig.requireBodyFor` (skip when config absent)
- G10: Required trailers — all `commitConfig.requiredTrailers` keys present in body (skip when config absent)

## Prepare Script Contract

- P1: `currentBranch` (string) — active git branch name
- P2: `flags` (object: `{ noStash, scope, type, amend, auto }`) — parsed CLI flags
- P3: `staged.files` (string[]) — list of staged file paths
- P4: `staged.fileCount` (number) — count of staged files
- P5: `staged.diff` (string) — full unified diff of staged changes
- P6: `staged.diffStat` (string) — diff stat summary line
- P7: `staged.diffTruncated` (boolean) — true when diff exceeded context budget
- P8: `staged.truncatedFiles` (string[]) — file paths whose full diffs were omitted
- P9: `unstaged.files` (string[]) — modified tracked files not staged
- P10: `unstaged.hasChanges` (boolean) — whether unstaged changes exist
- P11: `recentCommits` (string[]) — last 15 commits in oneline format
- P12: `lastCommitMessage` (string | null) — previous commit message (only when amend is true)
- P13: `commitConfig` (object | null) — commit validation config from `.claude/sdlc.json`

## Error Handling

- E1: `commit-prepare.js` exit 1 → show `errors[]` array to user, stop (no error report)
- E2: `commit-prepare.js` exit 2 (crash) → show stderr, invoke error-report-sdlc
- E3: No staged changes → inform user, suggest `git add`, stop (no error report)
- E4: `git stash push` fails → abort commit, show error, invoke error-report-sdlc if non-trivial
- E5: `git commit` fails (pre-commit hook) → show hook output, inform user stash is still in place, provide recovery instructions (no error report)
- E6: `git commit` fails (other) → show error, invoke error-report-sdlc
- E7: `git stash pop` conflict → warn user, suggest manual resolution (no error report)

## Constraints

- C1: Must not execute any git command before explicit user approval (unless `--auto`)
- C2: Must not fabricate changes not present in the staged diff
- C3: Must not skip the critique step
- C4: Must not include file paths in the subject line
- C5: Must not run `git stash` when `--no-stash` is true
- C6: Must not run `git commit --amend` unless `--amend` was explicitly passed
- C7: Must not stash untracked files — only stash modified tracked files (`--keep-index`, no `--include-untracked`)
- C8: Must not skip, bypass, or defer prepare script execution — the script must run and exit successfully before any skill phase begins
- C9: Must not override, reinterpret, or discard prepare script output — for every P-field, the script return value is authoritative and final; the skill must not substitute LLM-generated alternatives
- C10: Must not independently compute, infer, or fabricate values for any field the prepare script is contracted to provide — if the script fails or a field is absent, the skill must stop rather than fill in data
- C11: Must not re-derive data the prepare script already computes via shell commands, tool calls, or LLM inference — script output is the sole source for all factual context, preserving deterministic behavior

## Integration

- I1: `commit-prepare.js` — provides all pre-computed context (diff, history, config)
- I2: `error-report-sdlc` — invoked on script crashes and persistent git failures
- I3: `review-sdlc` — common follow-up after committing
- I4: `pr-sdlc` — common follow-up after committing
- I5: `version-sdlc` — common follow-up after committing
- I6: OpenSpec — optional scope hint and change trailer when active change exists
