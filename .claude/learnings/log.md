# Learnings Log

This is the append-only learnings log for the `ai-setup-automation` marketplace repository.
Entries flow from incidents, debugging sessions, and evolution cycles.

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
