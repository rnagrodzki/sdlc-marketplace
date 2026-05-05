# Learnings Log

Append-only learnings log for the `sdlc-marketplace` repository.
Entries flow from incidents, debugging sessions, and evolution cycles.

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

## 2026-04-29 — received-review-sdlc processing of review findings for fix(#183)
- `not-icontains` on `--set-upstream` would match the string anywhere in the response (including explanatory text), producing false negatives on regression-guard assertions; `not-regex: 'git push.*--set-upstream'` scopes the check to actual push command lines only.
- When adding a new behavior to version-sdlc (R15), always verify: (1) CHANGELOG entry covers the fix, (2) P-fields in spec list all script-provided values the skill uses, (3) user-facing docs describe the behavior, (4) regression-guard assertions are precise enough not to false-negative on prose mentions of flagged strings.

## 2026-05-05 -- setup-sdlc: review-dimensions count mismatch
setup.js reported reviewDimensions.count: 0 despite 12 valid .md files in .claude/review-dimensions/. Root cause: setup.js likely checks for .yaml extensions but this project uses .md. Validate script (validate-dimensions.js) correctly found all 12. Added type-safety-review as the one genuine gap (code-quality.md only triggers on *.js, not *.ts). GitHub Copilot instruction added for new dimension. Also added 8 execution guardrails including 3 project-specific ones derived from AGENTS.md (no-auto-eval, spec-first, skill-docs-required).
