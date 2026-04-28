# Learnings Log

This is the append-only learnings log for the `ai-setup-automation` marketplace repository.
Entries flow from incidents, debugging sessions, and evolution cycles.

## 2026-04-23 — version-sdlc: branch without upstream requires --set-upstream on first push
When releasing from a feature branch that has never been pushed, `git push` fails with exit 128. The fix is `git push --set-upstream origin <branch>` followed by `git push --tags`. This is expected behavior when `remoteState.hasUpstream: false` in the version context.

## 2026-04-23 — pr-sdlc: active gh account may be wrong for repo owner
When the active `gh` account (`rnagrodzkicl`) doesn't have write permission on the target repo, `gh pr create` fails with "does not have the correct permissions to execute CreatePullRequest". Recovery: run `gh auth switch --user <login>` to switch to the account that owns the repo before retrying. The skill's auto-switch only fires if `ghAuth` is non-null in PR_CONTEXT_JSON; if the script doesn't detect a needed switch, the user may need to switch manually.

## 2026-04-23 — version-sdlc: patch bump on feat branch with no upstream
Branch had no upstream configured. `git push` failed with exit 128. Recovery: used `git push --set-upstream origin <branch>` followed by `git push --tags`. Branch was a new feature branch in the pipeline, so setting upstream was correct and unblocking.

## 2026-04-23 — pr-sdlc auto-switch account detection
**Trigger:** `gh pr create` failed with permissions error because active gh account was `rnagrodzkicl` (work account) rather than `rnagrodzki` (personal account where the repo lives). The auto-switch logic in `pr.js` did not switch because the branch had already been pushed with the remote set.
**Rule:** When `gh pr create` fails with a permissions error, check `gh auth status` and switch to the account matching the repo owner before retrying. The skill should detect this and switch automatically; when it doesn't, manual `gh auth switch --user <login>` is the fix.
**Example:** Repo owner is `rnagrodzki`; active account was `rnagrodzkicl`; fix was `gh auth switch --user rnagrodzki`.

## 2026-04-23 — version-sdlc: patch bump on feature branch without upstream
Branch feat/131-received-review-auto-step12 had no upstream configured. `git push` failed with exit 128; recovered with `git push --set-upstream origin <branch>` then `git push --tags`. The `remoteState.hasUpstream: false` in the version context was the correct pre-condition warning. No data lost.

## 2026-04-15 — PR #165 (fix/#164 openspec-detection hardening)

The `prConfig.titlePattern` for this repo requires `type(#issue): scope - description` format (e.g. `fix(#164): openspec-detection - harden against contradictory signals`). The dash-separated scope and description is mandatory — titles without the ` - ` separator will fail validation. Conventional commit style alone (without issue number in parens) is not accepted.

## 2026-04-15 — version-sdlc: patch release v0.17.20 via ship pipeline
Single fix commit for #164 (openspec-detection hardening). Auto mode used; push deferred to ship pipeline's pr step. CI scripts all current. No pre-condition issues.

## 2026-04-15 — plan-sdlc: fix #152 ship-config missing fields
Planned a fix for `/setup-sdlc` Step 3b dropping `auto`/`skip`/`bump` questions. Root cause was LLM drift when SKILL.md hand-enumerates 8 `AskUserQuestion` calls — the LLM silently shortens the loop. Fix: emit authoritative field list from `setup.js` (new P7 contract) and make SKILL.md iterate mechanically.

Cross-model plan review (sonnet reviewing opus plan) caught two real blockers that self-review missed:
1. `rebase` field: SKILL.md currently says `yes/no/prompt` but `ship.js` only accepts `auto/skip/prompt` strings (or booleans mapped via legacy logic). Writing `"yes"` would silently fall through to the `'auto'` fallback — user's choice ignored. Lesson: when moving enum field definitions into a new source of truth, verify the runtime consumer's accepted value set, not just the documented-in-SKILL.md set.
2. Schema path: self-review assumed `plugins/sdlc-utilities/scripts/schemas/` existed (pattern inferred from other plugin layouts) when the actual location is `schemas/` at repo root. Lesson: verify path claims with `ls` even in comments — reviewers flag inaccurate references as noise.

Plan also revealed a pre-existing inconsistency between `ship.js` `VALID_SKIP` (5 items) and SKILL.md Step 3b `skip` options (7 items). Scoped out as follow-up, not fixed.

---

## 2026-03-19 — execute-plan-sdlc: 7-improvement upgrade + plan-sdlc new skill
Executed a 9-task, 2-wave plan upgrading execute-plan-sdlc and creating plan-sdlc. All tasks classified Standard/Complex; no Trivial tasks, so no batching or pre-wave needed. Wave 1 (7 parallel agents) completed cleanly. Spec compliance review found 1 minor issue in plan-reviewer-prompt.md (9-row table vs 8 specified — agent added "Decomposition balance" row not in spec); fixed inline. Wave 2 (2 parallel docs agents) completed cleanly. README update was required post-execution per AGENTS.md — add this check to standard plan-sdlc output for skill additions.
Key outcome: grouping improvements by target file (not by improvement letter) was the right decomposition strategy — avoided wave conflicts without over-splitting.

---

### [DOC_GAP] Documentation not updated after structural feature PRs

- **Date**: 2026-02-24
- **Session**: post-mortem
- **Discovery**: After PRs #2, #3, #4 added the `sdlc-utilities` plugin, namespace prefixes, `scripts/`, and CI enforcement, 25 specific documentation issues accumulated across 7 files. Root cause: the PR workflow (`sdlc-creating-pull-requests` skill) has no quality gate checking whether structural docs (README, AGENTS.md, docs/) were updated to match code changes. `aisa-evolve-target` was never triggered post-merge despite being designed for exactly this.
- **Impact**: HIGH — misleading docs for contributors; wrong naming conventions documented; entire `scripts/` directory undocumented; outdated PR template description in README vs actual 8-section skill.
- **Action**: (1) Add "Documentation Sync" quality gate to `sdlc-creating-pull-requests` skill. (2) Add Best Practice note in that skill recommending `/aisa-evolve-target` after structural changes. (3) Fix all 25 doc issues in 7 files. (4) Establish `.claude/learnings/` in this repo for future capture.
- **Status**: PROMOTED:sdlc-creating-pull-requests

### [PATTERN_FAILED] Prescriptive docs written without reading actual code

- **Date**: 2026-02-24
- **Session**: post-mortem
- **Discovery**: `docs/adding-skills.md` recommends a gerund naming convention for skill directories (e.g., `writing-unit-tests`). 8 of 9 actual skills in the repo use a non-gerund prefix pattern (`aisa-init`, `aisa-evolve`, `aisa-evolve-*`). The doc was authored as prescriptive ideal without cross-referencing existing code — a violation of Behavioral Rule 2 ("code is ground truth").
- **Impact**: MEDIUM — contributors following the docs would create skills with inconsistent naming.
- **Action**: Fix `docs/adding-skills.md` to describe the actual naming pattern used. Document both the `<plugin-prefix>-<noun>` pattern (aisa skills) and the gerund pattern (sdlc skills) as context-specific conventions.
- **Status**: PROMOTED:docs/adding-skills.md

### [DOC_GAP] scripts/ directory entirely absent from all documentation

- **Date**: 2026-02-24
- **Session**: post-mortem
- **Discovery**: `plugins/ai-setup-automation/scripts/` contains `verify-setup.js`, `cache-snapshot.js`, and a `lib/` directory with 6 modules. Not one documentation file mentions this directory. Contributors have no guidance on how to add scripts to a plugin or when to use them vs skills.
- **Impact**: HIGH — scripts are invoked by health and cache skills; undocumented maintenance risk.
- **Action**: Add `scripts/` to all structural documentation (AGENTS.md, README.md, docs/architecture.md). Consider adding `docs/adding-scripts.md` if scripts are expected to grow.
- **Status**: PROMOTED:docs/architecture.md,AGENTS.md

### [GOTCHA] Large script JSON output (>65KB) breaks shell pipes — use temp file pattern

- **Date**: 2026-03-03
- **Session**: post-mortem
- **Discovery**: `pr-prepare.js` embeds full `diffContent` in its JSON output, inflating it to ~150KB for a 16-file PR. When an agent runs `node pr-prepare.js | node -e "..."` to parse the output, the pipe silently truncates at ~65KB, producing "Unterminated string in JSON at position 65342". The `pr.md` command says "capture stdout as `PR_CONTEXT_JSON`" with no guidance for large outputs, so the natural interpretation (shell pipe) fails. Workaround: write to a temp file first (`node pr-prepare.js > /tmp/pr-context-$$.json`), then read from it. Same risk applies to `review-prepare.js`.
- **Impact**: HIGH — `/sdlc:pr` fails silently on repos with large diffs; requires 3+ extra recovery steps.
- **Action**: (1) Update `pr.md` command to prescribe temp-file write pattern. (2) Add GOTCHA section to `sdlc-creating-pull-requests` SKILL.md. (3) Apply same fix to `review.md` / `sdlc-reviewing-changes` SKILL.md. (4) Consider adding `--output-file` flag to both scripts.
- **Status**: PROMOTED:sdlc-creating-pull-requests,sdlc-reviewing-changes

### [GOTCHA] Installed plugin script version skew silently suppresses custom PR template

- **Date**: 2026-03-04
- **Session**: post-mortem
- **Discovery**: `pr.md` resolved `pr-prepare.js` from the installed plugin first (`~/.claude/plugins`). Installed v0.3.1 predates custom template support; the project's current script has it. The installed version always won, so `PR_CONTEXT_JSON.customTemplate` was `null`, and the skill silently used the default 8-section template (including JIRA Ticket) instead of the project's 7-section `.claude/pr-template.md`. Root cause: lookup order preferred installed over local; no fallback in the skill to cross-check disk.
- **Impact**: HIGH — project template preferences silently ignored; wrong sections injected into every PR generated against this project.
- **Action**: (1) Reversed lookup order in `pr.md`: local project script first, installed second. (2) Added Quality Gate Gotcha to `sdlc-creating-pull-requests` skill: if `customTemplate` is null, check disk for `.claude/pr-template.md` and read it directly if present, warn about potential version skew.
- **Status**: PROMOTED:sdlc-creating-pull-requests

### [GOTCHA] Hardcoded branch names in AGENTS.md become stale immediately

- **Date**: 2026-02-24
- **Session**: post-mortem
- **Discovery**: AGENTS.md contained `Current branch: fix/docs` and `Target merge branch: main` as hardcoded text. After merging to main, these lines became factually wrong. Branch metadata in static docs is always stale — it reflects the state at time of writing, not at time of reading.
- **Impact**: LOW — confusing to contributors and AI agents reading the file.
- **Action**: Remove hardcoded branch metadata from AGENTS.md. If branch context is needed, use git commands instead of hardcoding in docs.
- **Status**: STALE

## 2026-04-13 — version-sdlc: branch with no upstream requires --set-upstream on first push
Branch fix/pipeline-contract-enforcement-and-model-assignment had no upstream. First `git push` failed with exit 128; recovered by running `git push --set-upstream origin <branch>` then `git push --tags` separately. Tag pushed successfully.

## 2026-04-15 — openspec-lib-exec: script_path "inline" silently fails in script-runner.js
**Trigger:** Review finding that 6 test cases in `openspec-lib-exec.yaml` used `script_path: "inline"` + `script_inline` which the provider doesn't support.
**Rule:** If a promptfoo exec test calls library functions directly, create a real wrapper script in `tests/promptfoo/scripts/` and use `script_path: "repo://tests/promptfoo/scripts/<name>.js"`. Never use `script_path: "inline"` — script-runner.js passes the path string literally to `execFileSync`, so "inline" becomes a file argument and crashes. The `script_inline` var is never read by any provider.
**Example:** `script_path: "repo://tests/promptfoo/scripts/openspec-lib-test.js"` with `script_args: "--op isArchived --project-root {{project_root}} --change add-auth"`

## 2026-04-23 — review-orchestrator: manifest field reference `manifest.git.branch` doesn't exist
**Trigger:** Review of fix/#167 found orchestrator Step 6 summary template used `{manifest.git.branch}` — this field doesn't exist. The manifest schema has `current_branch` at the top level and `git.{commit_count, commit_log, changed_files}` in a sub-object.
**Rule:** When adding new fields to an orchestrator summary template, verify field paths against the manifest construction in `scripts/skill/review.js` (lines 535-560). The top-level branch field is `current_branch`, not `git.branch`.
**Example:** `{manifest.current_branch}` (correct) vs `{manifest.git.branch}` (wrong — this key is undefined).

## 2026-04-27 — version-sdlc: branch with no upstream requires --set-upstream on first push
**Trigger:** v0.17.25 release on `fix/issue-176-review-sdlc-full-display` — `git push` failed with "no upstream branch". The remoteState in the version context correctly showed `hasUpstream: false`, which was noted as a warning but not acted on pre-push.
**Rule:** When `remoteState.hasUpstream === false`, use `git push --set-upstream origin <branchName>` for the commit push, then `git push --tags` separately. Don't attempt bare `git push` — it will fail.
