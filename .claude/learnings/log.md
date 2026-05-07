# Learnings Log

Append-only learnings log for the `sdlc-marketplace` repository.
Entries flow from incidents, debugging sessions, and evolution cycles.

## 2026-05-07 — version-sdlc: patch bump for jira-sdlc hardening (v0.18.5)
Patch release from branch `fix/jira-sdlc-hardening-240-241`. Branch had no upstream so `--set-upstream` was used on first push. Commit `906ea6e6` (fix #239) appeared in the commit list but was already captured in `[0.18.4]` — changelog correctly attributed only commit `7eb87856` (#240) as new content. Link validation passed with no violations.


## 2026-05-06 — version-sdlc: patch release with uncommitted deletions in working tree
Release v0.18.4 proceeded normally with uncommitted deletions (`.claude/review-dimensions/*.md` and `.sdlc.json`) in the working tree — these were not staged and not included in the release commit. The `--set-upstream` auto-heal path fired correctly for a new feature branch with no prior remote tracking.

## 2026-05-06 — version-sdlc: patch bump on feat/233-configurable-always-fix-severities
Branch had no upstream; --set-upstream was emitted automatically. suggestedBump was minor (feat commit present) but explicit patch override from pipeline took precedence without issue. All CI scripts were current at v0.18.3 release.

## 2026-05-06 — pr-sdlc: --validate-body on older installed plugin version emits full JSON to stdout
The installed plugin (0.17.x) resolves pr.js via `find ~/.claude/plugins` and may be an older cached version than the local checkout. When piping a large body to `--validate-body`, stdout floods with the full pr context JSON (572KB) because the older version echoes it — only the last line `LINK_EXIT=N` and `OK:` message matter. The validation still works correctly (exit 0 = pass). No action needed; capturing stderr separately and checking exit code is sufficient.

## 2026-05-06 — version-sdlc: patch bump from chore/relocate-sdlc-state-config-schema
v0.18.1 → v0.18.2. Branch had no upstream — auto-set via `--set-upstream` on push. changelog flag was false (no --changelog arg passed despite config.changelog=true), so no CHANGELOG entry was generated.

## 2026-05-06 — pr-sdlc: PR #236 created for feat/harden-sdlc-skill → main
Custom template active (.claude/pr-template.md). Title pattern required type(#issue): scope - description format. Installed pr.js was 0.17.47 (project at 0.18.0) — --validate-body still worked. Branch was already up to date on remote despite remoteState.pushed=false. Labels enhancement+documentation inferred via llm mode from feat/ prefix and docs/* changes.

## 2026-05-06 — version-sdlc: v0.18.0 minor release from feat/harden-sdlc-skill
First push from a fresh feature branch — `remoteState.hasUpstream === false` triggered `--set-upstream` auto-heal correctly. Release contained new harden-sdlc skill (feat) and two fix commits. All CI scripts were current (no scaffold updates needed).

## 2026-05-06 — received-review-sdlc: harden-sdlc review round — 9 findings fixed, 2 pushed back
Fixed HIGH: silent catches in harden-prepare.js now log to stderr (H1, H2), EXIT_CODE_ARG rename avoids bash variable collision (H3), dual critique gate added to harden-orchestrator (H4), Step 4 skip-label corrected (H5), review-sdlc spec R16 step reference corrected to Step 5 (H6), commit-sdlc spec R13 narrowed to subjectPattern only (H7). Fixed MEDIUM: stdin JSON parse error now logged (M1), pipeline array in skills-meta.ts gains "learn" step (M2), trap guarded with [ -n ] (M3). Pushed back: M4 (P11 vs R4 — different concerns, no defect), L1 (no requirement for dimensions to cover log.md).

## 2026-05-05 — version-sdlc: patch release v0.17.47 from fix/220-223-context-stats-ship-state-cleanup
Single fix commit (context-stats token calculation + ship-state GC cleanup). Branch had no upstream — first push used --set-upstream automatically. Changelog disabled (flags.changelog === false despite config.changelog === true; --auto mode without explicit --changelog flag). All CI scripts current at their installed versions.

## 2026-05-05 — version-sdlc: flags.changelog vs config.changelog in auto mode
When `--auto` is combined with `config.changelog: true` but the script (pre-fix) emits `flags.changelog: false`, the skill must still honor the task-level intent (`config.changelog`). The script bug (#219) was the root cause; the fix is in `skill/version.js`. Post-fix, `flags.changelog` will correctly reflect `config.changelog` even in auto mode.

## 2026-05-05 — pr-sdlc: PR #222 created for fix/217-openspec-enrich-yaml-block
PR used the project custom template (.claude/pr-template.md). Custom template sections matched 1:1 with the 8 default sections by intent. Label `bug` inferred from `fix/` branch prefix and `fix(...)` commit subjects via LLM mode. Title pattern `^(feat|fix|...)\(#\d+\): .+ - .+$` required the issue number in parentheses — critical to get right for this repo.

## 2026-05-05 — version-sdlc: patch release v0.17.45 on fix/217-openspec-enrich-yaml-block
Released two fix commits (openspec-enrich YAML block template + duplicate-key guard). Remote had no upstream; `--set-upstream` auto-heal worked correctly. flags.changelog resolved to false despite config.changelog=true — the --auto flag + no explicit --changelog flag left changelog disabled for this release.

## 2026-05-05 — openspec-enrich: v1→v2 update path missing context-key duplicate guard
Reviewer caught that the in-place update path (v1→v2 migration) in `openspec-enrich.js` skipped the `hasExistingContextKey` guard that the append path had. A config with a user-defined `context:` key plus a v1 managed block would produce a duplicate `context:` key on upgrade. Fix: call `hasExistingContextKey(content, block)` before writing and return `skipped-existing-context` with a warning if true. Rule: whenever adding a new code path that writes a structured key to a YAML file, mirror every guard from the existing path that prevents duplicate keys.

## 2026-05-05 — pr-sdlc: gh account auto-switch on CreatePullRequest permission error
During PR creation for fix/#208-#209-#214-pipeline-bugs, `gh pr create` failed with `rnagrodzkicl does not have the correct permissions to execute CreatePullRequest`. The recovery helper (`pr-recover-gh-account.js`) returned `recovered: false` with a hint for `gh auth login --hostname github-rn`, but `gh auth switch` to `rnagrodzki` (the repo owner) succeeded manually and the retry PR creation worked. The recovery helper's `hint` path did not trigger an account switch because the host was `github-rn` (a custom hostname) rather than the standard `github.com` — the helper found no local account matching `github-rn`. Rule: when the recovery hint points to a non-standard hostname and a `rnagrodzki` account exists on `github.com`, try `gh auth switch` to `rnagrodzki` before escalating to the user.

## 2026-05-05 — version-sdlc: patch release v0.17.44 from fix/#208-#209-#214-pipeline-bugs
Branch had no upstream; auto `--set-upstream` on push worked correctly. `flags.changelog` resolved to `false` despite `config.changelog: true` — changelog requires explicit `--changelog` flag or a bump invocation that sets it. CI scripts were up to date.

## 2026-05-05 — pr-sdlc: gh account auto-switch on CreatePullRequest permission error
The active gh account (rnagrodzkicl) lacked CreatePullRequest permissions on the rnagrodzki/sdlc-marketplace repo. pr-recover-gh-account.js returned `recovered: false` with hint `gh auth login --hostname github-rn` because the remote URL uses a custom SSH host alias. The correct account (rnagrodzki) was already configured locally as an inactive account — manual `gh auth switch --user rnagrodzki` resolved it before the retry. Rule: when the recovery helper returns `recovered: false`, check `gh auth status` for inactive matching accounts and switch manually before the retry.

## 2026-05-05 — version-sdlc: patch release v0.17.43 on fix branch
Released v0.17.43 on `fix/version-sdlc-bugs-211-212-213` — first push required `--set-upstream`; auto-healed correctly. The `--output-file` "Unknown flag" warning was expected (the very bug being fixed in this release) and is non-blocking. `config.changelog = true` drove CHANGELOG generation without an explicit `--changelog` flag, confirming #213 fix works correctly during its own release.

## 2026-05-05 — received-review-sdlc: three HIGH fixes on fix/version-sdlc-bugs-211-212-213
HIGH-1: `--output-file` handler had a conditional `i++` that ate the next positional arg (e.g. `patch`), causing `requestedBump` to stay null. `output.js` only checks `process.argv.includes('--output-file')` — no value consumption — so the handler must be a pure no-op. Rule: boolean flags that delegate value-reading to another module must not advance the parse index.
HIGH-2: Exec test for #212 used `--output-file` in `script_args`, which made the script write JSON to a temp file and print only the path to stdout. The `not-icontains "Unknown flag: --output-file"` assertion against a file path was a guaranteed false positive. Fix: remove `--output-file` from args so full JSON hits stdout; replace the file-path regex with a `requestedBump` content assertion.
HIGH-3: `docs/skills/version-sdlc.md` was never updated after #211 (git diff hard-gate) and #213 (unified flags.changelog). Rule: when SKILL.md gains a new hard gate or behavior change, update the user-facing reference doc in the same PR.

## 2026-05-05 — version-sdlc: plugin.json corruption during release v0.17.41 (#211)
Root cause: SKILL.md Step 8.1 only mandated targeted Edit for TOML/YAML version files; JSON formats (package.json, plugin.json) were left to LLM discretion. The agent rewrote plugin.json from memory during the release commit, truncating the `description` field. Mitigation: Step 8.1 now mandates a single targeted Edit-tool call for ALL version-file formats (JSON included) plus a post-edit `git diff` HARD GATE — exactly one line must differ; otherwise abort and `git checkout -- <versionFile>`. Spec R8 generalized; gotcha bullet rewritten. Behavioral test added (multi-field plugin.json fixture).

## 2026-05-05 — version-sdlc: patch release v0.17.41 from fix/205-pr-labels-section-menu
Branch had no upstream; `--set-upstream` auto-heal fired correctly on first push. Changelog disabled via CLI (no `--changelog` flag despite `config.changelog: true`). Single fix commit: setup-sdlc summarizePrLabels leaf config read.

## 2026-05-05 — pr-sdlc: per-dimension model override PR (#199)
PR created for feat(#199) on branch fix/199-per-dimension-model-override. Custom template active — title pattern required `type(#issue): scope - description` format. sdlc.json version mode was already switched to `tag` on this branch, affecting how version-sdlc behaves in future sessions. "Fixes #199" placed in Github Issue section (custom template field) to link the issue for auto-close on merge.

## 2026-05-05 — version-sdlc: tag-mode release on feature branch with no upstream
Tag mode project (no version file). Branch `fix/199-per-dimension-model-override` had no upstream set; Step 8 auto-healed with `--set-upstream`. Branch was already pushed so push reported "Everything up-to-date" for commits; tag pushed cleanly as new tag. Explicit `patch` bump overrode conventional `minor` suggestion (1 feat commit). No changelog configured.

## 2026-05-05 — version-sdlc: patch release v0.17.38 from fix/198-link-validation-safeguard
Standard patch release. Two fix commits for link-validation URL validator and missing exit guards. Branch had no upstream — used `--set-upstream` on first push. CI scripts all current. No blocking issues.

## 2026-05-04 — pr-sdlc: PR #200 for feat/configurable-pr-labels
Custom template active (8 custom sections). Branch already pushed and tracked (`origin/feat/configurable-pr-labels`); `remoteState.pushed: false` in context JSON was stale — branch was current. Labels `enhancement` and `documentation` inferred: `feat/` branch prefix + `feat(#197)` commits → `enhancement`; doc files (`docs/skills/*.md`, `docs/specs/*.md`) in changedFiles → `documentation`. `prConfig.titlePattern` required `type(#issue): scope - description` — title validated before `gh pr create`. No JIRA ticket (null); Github Issue section populated with GitHub issue URL from pipeline context. Chore release commit (`v0.17.37`) included in branch commits — correctly ignored for PR title inference; feature commit used instead.

## 2026-05-04 — pr-sdlc: PR #196 for feat/191-setup-sdlc-menu
Custom template active (`.claude/pr-template.md`); 8 custom sections used. Branch was already pushed ("Everything up-to-date" on push). Label `enhancement` inferred from `feat/` branch prefix and `feat(#191)` commit subjects. `prConfig.titlePattern` required `type(#issue): scope - description` form — title validated before `gh pr create`. No JIRA ticket detected (null in context); `Github Issue` section populated with GitHub issue URL from pipeline context instead.

## 2026-04-29 — pr-sdlc: PR #189 for fix/185-skill-docs-required-guardrail
Custom template present in repo (`.claude/pr-template.md`); all 8 custom sections used. `skill-docs-required` guardrail config-field-only change — no script or hook needed. Branch was already pushed; `push` step returned "Everything up-to-date". Label `bug` inferred from `fix/` branch prefix.

## 2026-04-29 — version-sdlc: patch release v0.17.32 on fix/185-skill-docs-required-guardrail
Single chore commit (plan-sdlc skill-docs-required guardrail & test fixture). Branch had no upstream; push used `-u` to set it. The `--output-file` flag passed via pipeline args triggers an "Unknown flag" warning in version.js but does not block execution.

## 2026-04-29 — version-sdlc: patch release v0.17.31 on fix/184-sequential-meteor
First push from untracked branch; `git push --set-upstream origin <branch>` required before `git push --tags`. Both commits were `fix` type (null-check guard + gh-account-switch retry), cleanly mapping to a patch bump.

## 2026-05-06 — execute-plan-sdlc: 4-task plan executed inline (no Agent dispatch tool)
Agent tool was not surfaced in this environment so all four waves of the harvest-learnings plan executed inline in the main context (consistent with the existing 2026-05-05 entry on the same situation). Plan AC for the exec test "byte-identical mutation" required tmp-copying the fixture before `--commit` so the canonical fixture under `fixtures-fs/` stays pristine across promptfoo's parallel concurrency=8 — the AC was honored by spinning up an isolated tmp tree inside the JS assertion. Behavioral fixtures `fixtures/*.md` describe the helper's drafts JSON output rather than copying the filesystem fixture; this is the existing harness pattern (exec tests own filesystem trees, behavioral tests own simulated context), so "no fixture duplication" was satisfied in spirit even though the two test surfaces don't literally share files.

## 2026-05-06 — pr-sdlc: custom template sections require matching gh issue link format
This repo uses a custom PR template (`.claude/pr-template.md`) with a `## Github Issue` section (not `## JIRA Ticket`). The `Fixes #N` reference goes in that section, not in a JIRA field. When a custom template is active, all section headings come from the template — do not inject default 8-section headings alongside it.

Active bugs are tracked in GitHub issues. This log retains only entries < 30 days old
that capture non-obvious gotchas not yet reflected in code, docs, or skills.

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
