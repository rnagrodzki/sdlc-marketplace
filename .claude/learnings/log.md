# Learnings Log

Append-only learnings log for the `sdlc-marketplace` repository.
Entries flow from incidents, debugging sessions, and evolution cycles.

## 2026-05-09 — execute-plan-sdlc: bulk-close 20 stale version-sdlc GH issues
All 20 open issues with `version-sdlc:` titles were auto-harvested learnings from `log.md` (2026-05-08). None had labels. Both cited bug groups (#211/#212/#213 and #219) were already fixed on main before the harvest ran (d4da030 / 8ea8606). Lesson: learnings-harvest should gate on whether the cited bug is still open on main before creating a GH issue — status notes for successful releases should never become issues.

## 2026-05-09 — pr-sdlc: fix(#311) pr-recover-gh-account SSH alias fallback - PR #329
PR #329 used custom template. Labels `bug` + `enhancement` inferred via llm mode from `fix/` branch prefix (bug) and feat commit subject (enhancement). Branch had 3 commits including a release chore — primary feature commit `feat(#311)` drove label inference. `viaFallback: true` result field added to recovery helper to distinguish fallback-path recovery from direct-path recovery. `host` field normalized across all return branches for consistent caller access.

## 2026-05-08 — pr-sdlc: feat(#292) ship tunables surfaced via setup-sdlc
PR #328 used custom template from `.sdlc/pr-template.md`. Title pattern `^(feat|fix|...)\(#\d+\): .+ - .+$` required ` - ` separator; title was 68 chars. Labels `enhancement` + `documentation` inferred via llm mode from `feat/` branch prefix and docs/* changes. `when.stepInActiveSteps` gate mechanism added to SHIP_FIELDS — `skip: true` entries stay in array but are excluded from setup prompts; array order/length stable per R15. `BUILT_IN_DEFAULTS` is now single source for both setup defaults and ship runtime defaults.





































## 2026-05-09 — execute-plan-sdlc: fixture SHA must be exactly 40 hex chars for parseFixReferences regex
The `\b([0-9a-f]{40})\b` regex requires exactly 40 hex chars. Fixture SHA `abc1234567890123456789012345678901234567890` was 43 chars; `abc1234567890abcdef1234567890abcdef123456` was 41; only `abc1234567890abcdef1234567890abcdef12345` (40 chars) matched. Always count fixture SHA length before asserting AC-CL3 or similar.

## 2026-05-09 — execute-plan-sdlc: promptfoo broken on Node v26 (NODE_MODULE_VERSION 147 vs 141)
Running `promptfoo eval` on Node 26 fails with `ERR_DLOPEN_FAILED` for `better-sqlite3`. Workaround: verify deterministic helper logic directly via `node <helper> --output-file` with fixture cwd + fake env vars. Behavioral tests (LLM provider tests) still require promptfoo.

## Tracked in GH Issues
- version-sdlc auto-set-upstream → #183
- pr-sdlc post-failure gh-switch → #184
- plan-sdlc README reminder → #185
- version-sdlc --output-file unknown flag warning → #212 (RESOLVED — declared in version.js parser; see fix/version-sdlc-bugs-211-212-213)
- version-sdlc config.changelog not honored → #213 (RESOLVED — flags.changelog now emits resolved value config OR --changelog; spec R18; see fix/version-sdlc-bugs-211-212-213)
- pr-sdlc remoteState.pushed stale → #214

## 2026-04-29 — received-review-sdlc processing of review findings for fix(#183)
- `not-icontains` on `--set-upstream` would match the string anywhere in the response (including explanatory text), producing false negatives on regression-guard assertions; `not-regex: 'git push.*--set-upstream'` scopes the check to actual push command lines only.
- When adding a new behavior to version-sdlc (R15), always verify: (1) CHANGELOG entry covers the fix, (2) P-fields in spec list all script-provided values the skill uses, (3) user-facing docs describe the behavior, (4) regression-guard assertions are precise enough not to false-negative on prose mentions of flagged strings.

## 2026-05-05 -- setup-sdlc: review-dimensions count mismatch
setup.js reported reviewDimensions.count: 0 despite 12 valid .md files in .claude/review-dimensions/. Root cause: setup.js likely checks for .yaml extensions but this project uses .md. Validate script (validate-dimensions.js) correctly found all 12. Added type-safety-review as the one genuine gap (code-quality.md only triggers on *.js, not *.ts). GitHub Copilot instruction added for new dimension. Also added 8 execution guardrails including 3 project-specific ones derived from AGENTS.md (no-auto-eval, spec-first, skill-docs-required).

## 2026-05-05 — version-sdlc: patch bump on feat commit, first push from new branch
Patch bump (0.17.41 → 0.17.42) was explicitly requested despite conventionalSummary.suggestedBump being "minor" (one feat commit). Explicit user request takes precedence. Branch fix/skill-subagents-minimal-payload had no upstream — used --set-upstream on first push; succeeded cleanly.

## 2026-05-05 — ship-sdlc: issue #202 - skill subagent minimal payload
execute-plan-sdlc created feature branch fix/skill-subagents-minimal-payload from main. Previous in_progress state file (from 09:51) was silently bypassed by starting fresh — state was keyed to `main` but execute created a new branch, requiring state re-init. version-sdlc suggested minor bump (feat commit) but explicit patch override worked as expected. Review found call-site model:haiku inconsistency vs review-sdlc pattern (medium) — verify if agent frontmatter model: is honored without call-site override.

## 2026-05-05 — received-review-sdlc: issue #202 follow-up fixes
Review finding #2 (medium): "call-site model:haiku inconsistent with review-sdlc" — the asymmetry is intentional. review-orchestrator runs at parent model; commit/error-report orchestrators want haiku specifically. The Agent tool model: parameter takes precedence over agent frontmatter (per tool docs). The original comment "pass it explicitly so the harness honours it" was misleading — the call-site IS the correct mechanism, frontmatter is redundant. Finding accepted (improve comment clarity), not change of mechanism.

## 2026-05-05 — execute-plan-sdlc: pipeline-bugs plan executed without Agent tool
Resumed execution on `fix/#208-#209-#214-pipeline-bugs` where the prior wave 0 had been built but no tasks dispatched. The harness exposed TeamCreate but not the one-shot Agent tool the skill was designed around, so all 11 tasks ran inline in the main context, sequentially, with `git diff --stat` after each task as filesystem verification (Step 5c.1) and the existing 14 active guardrails passing on the final diff. Rule: when Agent dispatch is unavailable, fall through to inline execution rather than aborting — plan tasks remain the source of truth, and `state/execute.js` still tracks completion. The advisor catch was correct (skip Spec Compliance Reviewer dispatch in 5c-bis when no Agent tool — equivalent to `--quality full` for that step alone).

## 2026-05-05 — execute-plan-sdlc: Agent dispatch tool unavailable in environment
When the Agent/Task dispatch tool is not registered in the runtime tool list, the orchestrator must fall back to direct main-context execution rather than failing. The skill protocol allows this implicitly (small-plan path), but the heuristic should be: if dispatch is unavailable, treat all tasks as inline regardless of complexity and rely on per-task verification + post-execution acceptance-criteria checks. Tasks 1–4 of plan #217 executed sequentially in main context with full verification — outcome equivalent to wave dispatch for a 4-task plan.

## 2026-05-05 — version-sdlc: changelog skip under auto-dispatch (#219)
Even though prepare script (#213) correctly resolved flags.changelog, residual SKILL.md sites that read config.changelog directly or used vague "if changelog is enabled" wording let the LLM skip the changelog write under sub-agent dispatch. Fix: every gate (draft, write, release-plan display) now cites `flags.changelog === true` verbatim. Step 7.5 CI-scaffold remains config.changelog-gated by design (persistent project setup, not per-release). Lesson: when a script-emitted resolved value is the contract, every consumer site must cite that exact field name; vague phrasing leaks back to original-source semantics.

## 2026-05-05 — execute-plan-sdlc: 8-task plan executed inline; cleanup-pipeline reserved-step semantics
Plan 220-223-steady-clarke.md (#220 context-stats fix + #223 ship-state lifecycle) executed end-to-end inline because the Agent dispatch tool was again absent from the runtime. Three additional learnings worth keeping:
- **Reserved synthetic steps:** the cleanup step is appended unconditionally by `skill/ship.js::computeSteps`, NOT user-configurable. The validator must reject it from `--steps`/`ship.steps[]` regardless of `flagSources.steps` source. Source check (`cli`-only error, `config`-warning) is wrong for reserved names — always an error.
- **Atomic file rename + content edit pattern:** `migrateBranchSlug` writes the new path first (atomic temp+rename) then unlinks the old. There is a brief window where both files exist; `findStateFile` sorts by mtime descending and picks the newest. Acceptable for state files (single-writer), don't generalize this pattern to multi-writer scenarios.
- **Hook context advisory bug surfaced its own irony:** the context-stats hook reported 100% transcript usage at the start of this very session (using the broken bytes/4 heuristic), which the advisor correctly flagged as stale data — the issue we were fixing. Test fixture `project-context-advisory-real-transcript` with `usage.input_tokens=50000 + cache_read=10000 = 60000 → 30%` validates the fix produces the right answer (and the heavy/light/missing tests in `context-advisory-exec.yaml` still cover the consumer-side advisory text).

## 2026-05-06 — execute-plan-sdlc: harden-sdlc skill scaffolded across 4 waves
8 tasks executed sequentially (Agent dispatch unavailable in this environment — adapted to inline execution). Three-layer artifacts (spec/SKILL/reference doc) plus prepare script + orchestrator + caller integrations + promptfoo dataset all landed without retries. The 200-line cap on `harden-prepare.js` initially missed by 8 lines; trimming the docstring resolved it, suggesting the C2 cap should be checked before the final docstring is written, not after. Pre-existing `flag-coherence-cross-skill` validator failure (description >512 chars) confirmed unrelated to this work via git stash.

## 2026-05-06 — ship-sdlc: worktree branch + state migration gap
execute-plan-sdlc created branch `chore/relocate-sdlc-state-config-schema` from `main`. ship.js state was initialized for `main`; state/ship.js `migrate` subcommand not yet available (v0.17.47). Manual JSON rename needed. Consider initializing state after execute returns, not before.

## 2026-05-06 — ship-sdlc: fixture embedded git repo
execute-plan-sdlc created `tests/promptfoo/fixtures-fs/project-skill-skip-via-env/` by running `git init` inside the fixture dir. fixture should be empty (no .sdlc/ files) — only `.gitkeep` needed. Spec comment for such fixtures should explicitly note "do not git init".

## 2026-05-06 — execute-plan-sdlc: SDLC layout reconciliation plan (10 tasks, 6 waves)

Wave structure for config.js multi-edit plans: 4 tasks all edited config.js (Tasks 2, 3, 4, 6) which forced 4 sequential waves. A plan-time pre-check grep of all file modifications would have surfaced this earlier and allowed better planning. Wave 1 batched 3 trivials across different files correctly.

Fixture smoke-test side effect: running `migrate-config.js` directly inside a promptfoo fixture directory mutated it. Script-runner copies fixtures to tempdir in real use — always run smoke tests with a temp copy or restore the fixture afterward.

`cd` in Bash tool persists between commands in the session — using relative paths after a `cd` means subsequent tool calls resolve from the new directory. Always use absolute paths or re-cd to repo root at the start of each command.

Out-of-scope finding: `guardrails.js:446` still uses `.claude/review-dimensions` hardcoded path — not listed in plan, left unmodified per no-scope-creep guardrail. Flagged for follow-up.

## 2026-05-06 — execute-plan-sdlc: migrate-config cleanup (plan-fixes-for-following-rustling-rocket)
Wave structure required careful file-conflict analysis: T2, T3, T4 all touch config.js so each landed in its own wave (3 sequential waves vs 1). T4 and T6 were correctly identified as parallel-safe (no shared files). T5 (fixtures) correctly depended on all three code waves. During final verification, `node -e "require('./scripts/skill/migrate-config.js')"` executed the script's `main()` since the file calls `main()` at module load — always use `node --check` for syntax-only verification of scripts that auto-execute on require. The accidental execution deleted .claude/sdlc.json and .claude/review-dimensions/ from the repo; restored via `git restore`. The .sdlc/.gitignore dedup was a valid side-effect (repo had a redundant !.gitignore outside the managed block).

## 2026-05-06 — execute-plan-sdlc: configurable alwaysFixSeverities for received-review-sdlc (issue #233)
Sub-skill execution from ship-sdlc had no Agent/Task tool exposed in the dispatched session — `ToolSearch` for `agent dispatch subagent` returned only `SendMessage`/`TeamCreate`/etc., not the standard `Task` tool. Fell back to inline sequential execution of all 9 waves in the main context. This is functional but skips spec-compliance-reviewer dispatch (5c-bis, 8-bis) and parallelism. Adapted by: (a) executing waves in dependency order, (b) verifying empirically (parseSeverity test cases, setup-init round-trip with cwd assertion, fixture-fs setup.sh dry-runs), (c) confirming guardrails post-execution against the cumulative diff. Rule for next time: when execute-plan-sdlc is invoked as a sub-skill and Agent/Task is unavailable, announce the constraint upfront and proceed inline — do not stall or retry tool discovery.

The `setup-init.js` writes to `process.cwd()` (no `--project-root` flag), so harness scripts must `cd` to fixture directories before invoking. `tests/promptfoo/scripts/run-setup-init-receivedreview.js` documents this in its docstring. Severity tag format in review-sdlc PR comments is `- **Severity**: <value>` per `skills/review-sdlc/REFERENCE.md:192` — case-insensitive regex with optional bullet prefix matches the canonical and tolerates inline variations. The Ajv path mentioned in plan task 9 (`scripts/skill/guardrails.js:185`) does not exist in the codebase; structural assertions on `additionalProperties: false` + property absence are sufficient and don't require a runtime validator dependency. Hook side-effect: an automated context-stats hook touched `.sdlc/.gitignore` mid-execution (whitespace-only), `git checkout --` reverted cleanly. Watch for unexpected `M` entries in `git status` post-execution that aren't from any plan task.

## 2026-05-06 — execute-plan-sdlc: 6-task plan for issue #239 (review-sdlc 3-dot diff fix)
Five waves executed inline (Agent/Task tool not surfaced in this environment, consistent with prior entries). T2 and T3 both modified `lib/git.js` so they had to run in sequential waves — the wave-structure critique correctly caught this. The promptfoo exec test pattern for lib helpers requires a tiny harness script in `tests/promptfoo/scripts/` (e.g., `git-lib-test.js`) that loads the lib module and dispatches by `--op` — the dataset cannot reference internal lib functions directly. Fixtures requiring real git state (e.g., `git-lib-unreachable-origin`) must use `setup.sh` to init at runtime, not commit a `.git` directory (which becomes a nested submodule). The `git diff --cached` form does not accept `<base>...HEAD` ranges — only single commits — so the `all` scope's symmetric `--cached <base>` form had to stay two-arg even though "branch contribution" semantics were the goal; documented in `buildBranchContribDiffCmd` JSDoc to prevent future regressions. Single shared helper `buildBranchContribDiffCmd(scope, base)` keeps `getChangedFiles`, `getDiffStat`, `getDiffContent`, and `review.js::fetchAndSplitDiff` in lockstep — DRY pays off when multiple call sites must agree on a wire-format change.

## 2026-05-07 — execute-plan-sdlc: jira-sdlc hardening (#240+#241), 7 tasks, 4 waves
- Plan-classified Task 5 as Standard with 4 artifacts (template file + script logic + SKILL.md fragment + dataset cases). All four landed cleanly without splitting; the bundling proved correct because every artifact mutated `jira.js` or `SKILL.md` — splitting would have serialized them in the same wave with no parallelism gain.
- Plan referenced `tests/promptfoo/datasets/jira-sdlc-hook-exec.yaml` for hook-test additions, but actual hook tests live in `jira-sdlc-guardrail-exec.yaml`. Mid-wave realignment: routed Task 2/3/4 hook-test additions to `jira-sdlc-guardrail-exec.yaml` plus the `jira-write-guard-test.js` helper. Filed as a plan-source verification gap — plan authors should grep dataset structures before naming target files.
- Sub-task.md was named in `docs/skills/jira-sdlc.md` but did not actually ship — a documentation-vs-reality drift caught only by issue #241. Adding `validate-skill-docs` enforcement for shipped-template assertion would catch this class earlier.
- Agent dispatch was unavailable in this session (Task tool not surfaced via ToolSearch); fell back to main-context serial execution. Each wave still produced the planned deliverables; the dual-critique gates (Step 3 + Step 5e) ran inline. Learning: execute-plan-sdlc should not assume Agent availability — main-context fallback is a viable third execution mode alongside small-plan direct and wave-orchestrated.

## 2026-05-07 — pr-sdlc: PR #267 for fix/multi-version-script-resolution
Created PR for a 39-file mechanical sweep (49 `head -1` → `sort -V | tail -1` replacements). Title required shortening from 74 to 64 chars to pass the 72-char gate and also match the `type(#issue): scope - description` pattern simultaneously. Custom template with 8 sections used; all required GitHub close keywords (Fixes #258, #261–#264) placed in Github Issue section. LLM-mode label inference: `fix/` branch prefix matched `bug` label.

## 2026-05-07 — version-sdlc: v0.18.5 → v0.18.6 patch release on fix/multi-version-script-resolution
Patch release covering fixes #258 and #261–#264 (script resolution picks newest cached plugin version via `sort -V | tail -1`) plus the execute-plan-sdlc SCRIPT variable shadowing fix. Branch had no upstream; `--set-upstream` push auto-healed. The squash commit for v0.18.5 appeared in the commit list for this tag — correctly excluded from the new changelog entry since its changes were already documented under 0.18.5.

## 2026-05-07 — execute-plan-sdlc: 14-task plan #228/#234/#235, inline 4-wave execution
- Agent/Task dispatch was again unavailable in this session — fell through to main-context inline execution (consistent with prior 2026-05-05/06 entries). The plan classified T2/T3/T4 as a batched-haiku trivial bundle in Wave 2 and T8/T9 as Complex+Medium-risk; without dispatch, all collapsed to sequential edits. No retries needed; verification was per-wave `git diff --stat` plus per-script syntax + smoke test in `/tmp/<fixture>` clones.
- `setup-sections.js` capturing `parseRemoteOwner(process.cwd())` at module load froze the default to the require-time cwd. This is fine for `setup.js` (always invoked from project root) but would silently break if any other consumer required `lib/setup-sections.js` from a different directory. Acceptable trade-off here, but prefer a getter / lazy default for any future field whose default depends on runtime cwd.
- `parseRemoteOwner` returns `{host, owner, repo}` (object), not a string — the first version of the new `expectedAccount` default emitted the entire object as `default:`, which would have crashed the AskUserQuestion renderer at runtime. Caught only by the smoke-test against the fixture; rule: when adding a new field whose default uses an existing helper, always smoke-test the prepare output once before considering the task done.
- Pre-existing `flag-coherence-cross-skill` guardrail description (>512 chars) flagged by `validate-guardrails.js` is unrelated to this work — confirmed via `git show HEAD:.sdlc/config.json | grep -c "When skill A dispatches"` returning the same count. Worth filing as a separate task.
- `T13` (setup-sdlc SKILL.md flip default + diff preview) had to thread three concerns: (a) the resolved field name `flags.unsetOnly`, (b) cite-by-name discipline per `flag-coherence-cross-skill`, (c) the diff-preview being a NEW step BEFORE the existing write step. Splitting "flip default rule" from "add diff-preview step" might have been cleaner — they are conceptually distinct gates and could regress independently.

## 2026-05-07 — execute-plan-sdlc: 10-task mechanical sweep, inline execution
Plan #258/#261/#262/#263/#264 was 7 trivial sweep tasks (T4-T9) plus T2/T3 standard work plus T1 prep and T10 verify. Classification routed 6 sweeps into a single batched-haiku agent dispatch in Wave 2 — but on inspection, the work was 49 line-level edits across 23 files following an exact mechanical rule ("any line with `find ~/.claude/plugins` AND `| head -1` → swap to `| sort -V | tail -1`"). Dispatching a haiku agent for this would have been slower and less reliable than running a 30-line node script in the main context that performed the replacement deterministically. Learning: when "trivial" tasks share an exact textual rule, prefer a one-shot deterministic transform (node/sed) over a batched-LLM dispatch. Reserve agents for "trivial" tasks that still require local judgment (which lines to touch, which to skip).

## 2026-05-07 — execute-plan-sdlc: B1 + #273 plan execution

Plan assumed Task 1 (provider tmp-path auto-read) would fix all listed dataset rows. In practice, ~10 of the originally-listed "failing" rows had pre-existing failures unrelated to the path-vs-JSON shape (stale assertions, fixtures missing required state, code drifted from test expectations). T1 fixed +95 rows; the residual 22 failures were not within T1's scope. Lesson: when verification tasks list specific row counts as success criteria, validate at plan time which rows are truly affected by the proposed fix vs. which carry unrelated breakage. Stash-baseline diff (`git stash; eval; git stash pop; eval; diff`) is the right tool to confirm "no new regressions" and isolate which failures pre-existed.

Also: running plugin scripts in cwd of a fixture directory pollutes the fixture (writes side-effects to working tree). Always use `/tmp/<copy>` for direct invocations.

## 2026-05-07 — version-sdlc: patch bump for OWASP dimension (#272)
Explicit patch bump requested despite suggestedBump=minor (feat commit present). Caller specified patch via ship config — no conflict, proceeded as requested. The fix(#273) squash commit showed in range but was already released in v0.18.9; only feat(#272) was net-new. remoteState.hasUpstream=false — used --set-upstream on first push from new feature branch.

## 2026-05-07 — execute-plan-sdlc: ship-sdlc + jira-sdlc fixes (#275, #276)
- Plan flagged 3 ship-prepare exec rows but one was infeasible: `reviewThreshold` is config-only, not a CLI flag, so `--review-threshold unknown` rejection cannot be tested via CLI. Reframed the third row to assert source-tracking (`"reviewThreshold": "config"`) instead. Lesson: when a plan task lists "X exec rows" verify each row is testable against the actual CLI surface before authoring.
- Plan asked for 5 jira test rows; integrated 2 lib-level assertions (null-strip, ADF dispatch) into the existing helper-payload-hash and helper-placeholder rows rather than spawning new helper rows — extending in-place keeps the helper RESULT line atomic and avoids parallel rows that share state. Lesson: row count in a plan is a coverage proxy, not a strict requirement; merge-into-existing-row is fine when the assertion fits the same op.
- ship-prepare auto-migrates fixture local.json to schemaVersion 3 on every run, leaving `*.bak.*` and `.gitignore` files in the fixture tree. Pre-existing fixtures absorb this silently because they were already migrated; brand-new fixtures emit backup files that pollute git status. Lesson: when adding new ship-fixture configs, run prepare once locally and clean up backup artifacts before final commit, or write the fixture in already-migrated v3 shape.

## 2026-05-08 — execute-plan-sdlc: cost-tier model assignments (#229)
- Plan task description put fixtures at `tests/promptfoo/fixtures-fs/cost-tiers-clean/skills/...` (flat layout) but my initial validator hardcoded `<root>/plugins/sdlc-utilities/skills`. Lesson: when a plan specifies fixture paths, read them carefully BEFORE writing the code that scans them — adapt the validator's path resolver (with a real-vs-fixture fallback) rather than reshaping the fixture tree. Adding `resolveSkillsDir`/`resolveAgentsDir` with real → flat fallback was the right move.
- Local promptfoo install failed with Node ABI mismatch (better-sqlite3 NODE_MODULE_VERSION 141 vs Node 26's 147). Targeted eval was blocked but the dataset YAML structure was verifiable by direct `node validate-cost-tiers.js` runs against fixtures — exit codes and output strings matched the dataset assertions exactly. Lesson: when promptfoo is broken locally, validate dataset assertions by running the script directly with the same args/cwd the provider would use, then check the YAML's `icontains`/`not-icontains` strings against actual output.
- Tool environment lacked Agent/Task dispatch tool, only SendMessage/TeamCreate. Skill normally builds wave structure for agent dispatch; with no Agent tool available, executed inline. Lesson: when execute-plan-sdlc runs in an environment without the Agent tool, fall back to inline execution rather than blocking — most plans have well-scoped enough tasks that inline succeeds, and the wave structure still informs which edits are independent (parallelizable Edit calls) versus serial.

## 2026-05-08 — execute-plan-sdlc: post-PR CI verification + Copilot review (#130)
- Plan was OpenSpec-styled with R-numbered requirements (R41–R59 in ship-sdlc spec, R1–R10 in new verify-pipeline-sdlc spec) and Task 1 as a spec-only task gating Tasks 6 + 8. Linear execution respected the dependency: T1 → T7 → T2 → T3 → T4 → T5 → T6 → T9 → T8 → T10 — every "Depends on" satisfied without parallel waves. Lesson: when no Agent/Task dispatch tool surfaces (sub-agent context with no nested dispatch), classify-and-wave still informs WHICH tasks are independent; just execute them serially in dependency order.
- The plan's instruction "insert verify-pipeline immediately after pr in ship.js#computeSteps" looked like a 5-line change but actually required adding the flag to FOUR places: parseArgs (CLI surface), mergeFlags (config resolution + sources), computeSteps (step entry), and the final `flags:` output object (so SKILL.md prose can cite `flags.verifyPipeline` per `flag-coherence-cross-skill`). Forgetting the fourth (output object) leaves SKILL.md unable to read the resolved value and downstream consumers see `undefined`. Lesson: when a plan adds a CLI flag to ship.js, mentally map all four touch-points before writing — parser → merge → compute → output exposure. Missing exposure means the dispatcher cannot see the resolved flag.
- Initial classifier regex `/Cannot\s+find\s+module\s+'/i` required a single-quote literally, missing double-quoted `Cannot find module "foo"`. Found via smoke-test before tests landed. Lesson: when classifier signals are based on log text, anchor on the sentence head (`Cannot find module\b`) rather than the next punctuation — message phrasing varies (single quote, double quote, backtick).
- Local promptfoo binary had pre-existing NODE_MODULE_VERSION mismatch (141 vs Node 26's 147 for better-sqlite3) so could not run targeted eval as final verification. Smoke-tested every pure helper directly via inline `node -e`, validated YAML datasets via js-yaml from another repo's node_modules, and ran ship.js as actual CLI to confirm the steps array order/status. Lesson: when promptfoo is broken locally, the pure-helper layer can be exhaustively smoke-tested via Node REPL — the dataset YAML then becomes a regression contract for CI to enforce, not something blocking local verification.

## 2026-05-08 — execute-plan-sdlc: ship-config gating refactor (issue #130 follow-up)
Plan said `PROJECT_MIGRATIONS is not extended` because the renamed fields are local-only. But `lib/config-version.js` uses a single global `CURRENT_SCHEMA_VERSION` constant for both roles; bumping it from 3 to 4 forced a project-side v3→v4 step to keep the migration walker satisfied. Added a no-op `noopProjectV3ToV4` that just stamps the version. Lesson: when a plan touches a versioned constant shared across registries, audit every consumer of that constant — even if the plan claims a registry is untouched.


## 2026-05-08 — execute-plan-sdlc: Astro site devops category + system map update
Multi-file additive changes across a TypeScript Astro site. Wave structure was forced by skills-meta.ts being touched by 3 tasks (T1, T3, T5) — all needed separate waves. WorkflowGraph.astro used dynamic maxCol computation so no layout fix was needed for the new col-4 node. Agent correctly identified and added the parallel colorHex map entry alongside colorMap — slight plan spec gap (spec only mentioned colorMap), agent self-corrected. Trivial batch (2 tasks, 2 separate files) executed cleanly in parallel with the standard task in Wave 2.

## 2026-05-08 — execute-plan-sdlc: Agent dispatch tool absent in session

**What happened:** Session had no `Agent` tool surfaced (only TeamCreate). Plan called for parallel wave dispatch of 6 MVP tasks (1, 2, 3, 19, 20, 21).

**What was learned:** When the dispatch tool is missing, sequential inline execution in the main context is the right fallback for ≤6 mechanical tasks. TeamCreate would have been over-engineering. Adopted file-conflict-safe order (2 → 1 → 19 → 20 → 3 → 21) so dependencies (Task 3 needs Task 2, Tasks 20+21 both touch lib/version.js) resolved naturally without parallelism.

**Implementation gotchas surfaced:**
- `migrate-config.js` outputs pretty-printed JSON (`null, 2`) — required extending `writeJsonLine` with an `indent` option to keep byte-identical output.
- `version.js`'s "diff truncation" sites are actually CHANGELOG file truncation, not diff truncation. Required adding a separate `truncateText(text, {maxBytes})` helper alongside the file-aware `truncateDiff` in `lib/diff-truncate.js`.
- `harden-prepare.js::readPipelineState` doesn't filter by branch — it picks any state file. Adapted by passing `detectResumeState({prefix})` with no `branch` arg, returning the newest of any branch.
- Original ship.js `detectResumeState` resolved state dir from `process.cwd()` (worktree-local); canonical `lib/state.js::resolveStateDir` resolves from main worktree. This is the documented correct path; any worktree-local-only consumer would have been a bug.

**Stash hazard:** A `git checkout HEAD -- file` was needed when a stash pop conflicted on an unrelated file (`.sdlc/config.json` modified at session start). Lesson: avoid stashing during long execution; modify only files within the task surface.

## 2026-05-08 — harden-sdlc: user-code for setup-sdlc at Step 0 Pre-flight
Applied: 2 proposal(s) across plan-guardrails, review-dimensions | Skipped: 0 | Routed: no
Trigger: preflight check is wrong: localIsV1: true was already migrated several times; schemaVersion also keeps showing as mis

## 2026-05-08 — ship-sdlc: commit-sdlc fails without issue number in branch name
Branch `chore/extract-shared-script-utilities` has no issue number, causing commit-sdlc to reject with pattern error. Pass `--issue 284` to commit-sdlc when branch name lacks a number. Issue number comes from plan header ("Tracking issue: #N").

## 2026-05-08 — ship-sdlc: opus model dispatch requires extra context (1M tokens)
First execute-plan-sdlc dispatch failed: "opus model requires 1M context (extra usage not enabled)". Resumed next session without --resume flag (started fresh). Prior state file cleaned by terminal step.

## 2026-05-08 — ship-sdlc: review threshold=low triggers received-review even on APPROVED verdict
Verdict was APPROVED but 2 low findings triggered received-review-sdlc dispatch (threshold=low catches all non-info findings). Both fixes were documentation-only (JSDoc clarifications). Pipeline behaved correctly per spec.

## 2026-05-08 — harden-sdlc: ambiguous for execute-plan-sdlc at Step 1 — Agent dispatch
Applied: 0 proposal(s) | Skipped: 0 | Routed: no
Trigger: Agent dispatch failed: opus model requires 1M context (extra usage not enabled)

## 2026-05-08 — ship-sdlc: plan-integrity hook (issue #285)
- state.js resolveStateDir() is git-dependent (resolveMainWorktree via worktree list) — test fixtures with embedded state files need SDLC_STATE_DIR_OVERRIDE env var to bypass; adding this to state.js is the clean approach
- promptfoo fixture dirs must not have embedded .git repos; hook tests that need branch detection require an env-var override (SDLC_BRANCH_OVERRIDE) instead
- SKILL.md bash blocks do NOT share shell state — each block is a separate Bash tool invocation; $SCRIPT resolved in Step 0 is not available in Step 3 blocks; always re-resolve per block
- execute-plan-sdlc creates feature branch when workspace=branch; ship state file needs post-execute branch migration (state/ship.js migrate) before subsequent state operations

## 2026-05-08 — execute-plan-sdlc: 10-task fix for #287/#288 — inline execution path
Plan called for wave-based agent dispatch but the runtime had no `Agent`/`Task` tool available, so all 9 implementation tasks ran inline in the orchestrator context. Wave structure was preserved for ordering and state persistence. Promptfoo CLI is broken in this environment (better-sqlite3 NODE_MODULE_VERSION mismatch), so per-wave promptfoo verification was substituted with direct node-based smoke tests of the affected modules (PRESET_TO_STEPS, CANONICAL_STEPS, computeSteps pipeline order, harden-prepare manifest pluginRepoUrl). Side-effect to watch for: running ship.js against a fixture mutates the fixture's `.sdlc/.gitignore` (auto-managed selective-ignore block) — reverted manually.

## 2026-05-08 — ship-sdlc: #287/#288 archive-openspec order + harden ambiguous offer
- archive-openspec was placed before version in runtime (ship.js), before pr in config lists — both wrong. Fixed: runtime IIFE relocated to version→archive-openspec→pr; CANONICAL_STEPS, PRESET_TO_STEPS, schema enum, specs, docs, tests all aligned.
- harden-sdlc SKILL.md Step 5c referenced MANIFEST.pluginRepoUrl but MANIFEST as parsed-JSON was never defined — only MANIFEST_FILE (path). Review caught it; fix: add explicit read instruction per step.
- reviewThreshold=low fires received-review-sdlc on any finding; both medium and low findings were real and fixable — threshold appropriate for this project.

## 2026-05-08 — execute-plan-sdlc: #292 surface verify-pipeline + await-remote-review tunables
- Agent tool was unavailable (no `Task` deferred tool); all Standard tasks ran inline in orchestrator context. Wave ordering was preserved for correctness and state tracking.
- The `when` evaluator site was ambiguous in the plan: "evaluated in setup.js against the steps[] selection just selected by the user" seems contradictory (prepare runs before user selection), but the resolution is correct — setup.js accepts a `--steps` CLI flag and the skill calls it with the user's selection. This is the same pattern as `--unset-only` and `--force`.
- `applyWhenGates` is a pure function added to setup.js — makes the gate testable without running the full prepare pipeline.
- promptfoo CLI broken in this env (better-sqlite3 NODE_MODULE_VERSION mismatch on Node v26); exec test assertions verified directly with `node -e` inline assertion scripts instead.
- Existing test for `shipFields.length === 7` needed updating to 13 — always check length assertions in datasets when adding new SHIP_FIELDS entries.

## 2026-05-08 — ship-sdlc: feat/surface-verify-pipeline-await-remote-review-tunables
- Issue body proposed nested config form (verifyPipeline.timeout) but codebase already had flat keys (verifyPipelineTimeout) per spec R57 — always check schema before trusting issue scope descriptions.
- SHIP_FIELDS had no `condition`/`when` mechanism; added `when: { stepInActiveSteps }` shape + setup.js evaluator. Guardrail: scripts-over-llm-logic correctly identified prose carve-out as the worse option.
- reviewThreshold=low caused received-review-sdlc dispatch on 2 medium findings (stale doc count, missing min/max on number fields). Both legitimate; min/max addition was the right call over schema-only fallback.

## 2026-05-09 — ship-sdlc: triage #295+ issues with github.com fallback fix
- 15 open issues ≥#295 were auto-harvested operational PR logs; only #311/#313 described a reproducible bug
- recoverGhAccountForRepo now queries github.com as fallback when remote uses a non-canonical SSH host alias (e.g. github-rn); returns viaFallback:true on match
- reviewThreshold=low triggers received-review-sdlc on any finding — even 3 low findings caused a received-review cycle; consider raising threshold to high for repos with clean code
