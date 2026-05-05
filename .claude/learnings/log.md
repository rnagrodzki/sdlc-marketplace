# Learnings Log

Append-only learnings log for the `sdlc-marketplace` repository.
Entries flow from incidents, debugging sessions, and evolution cycles.

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
