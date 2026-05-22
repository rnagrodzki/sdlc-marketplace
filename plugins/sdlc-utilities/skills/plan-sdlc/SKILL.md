---
name: plan-sdlc
description: "Use when writing an implementation plan from requirements, a spec, a design doc, or a user description. ALWAYS use when plan mode is active — this is the designated plan-mode skill. Analyzes scope, maps file structure, decomposes into classified tasks with dependencies, and produces a plan ready for execute-plan-sdlc. Triggers on: write plan, create plan, plan this, break this into tasks, implementation plan, plan mode."
user-invocable: true
argument-hint: "[--spec] [--from-openspec <change-name>] [spec-file-path]"
model: opus
---

# Plan (SDLC)

Write an implementation plan from requirements, a spec, or a user description. Produces a plan in the format consumed by execute-plan-sdlc — with per-task complexity/risk/dependency metadata embedded.

**Announce at start:** "I'm using plan-sdlc (sdlc v{sdlc_version})." — extract the version from the `sdlc:` line in the session-start system-reminder. If no version is in context, omit the parenthetical.

## Step 0: Mode Detection, Routing, and Setup

**Mode detection:** Check whether a system-reminder contains "Plan mode is active". If yes, extract the designated plan file path from "You should create your plan at `<path>`". That path is the only writable file.

**Gather requirements:** If no spec or requirements document is in context, use AskUserQuestion:
> What do you want to implement? (describe in free form, bullet points, or provide a file path)

**OpenSpec integration (opt-in — requires `--spec` flag or explicit spec path):**

**Hook context fast-path:** If the session-start system-reminder contains an `OpenSpec active:` line, use its data (change name, branch match status, delta spec count) to skip the initial `Glob for openspec/config.yaml` and change directory scanning. If the line is absent or the user switched branches since session start, fall back to the existing Glob-based detection. The hook context is a session-start snapshot — treat it as a hint, not as authoritative.

1. Glob for `openspec/config.yaml`. If absent, skip this entire block — no OpenSpec in this project.
2. **Gate check:** If `openspec/config.yaml` exists but neither `--spec` flag was passed NOR the user provided a path into `openspec/changes/`:
   a. **Classify the request:** Determine whether the user's task involves functional changes (new features, behavior modifications, API changes, new integrations, capability additions) vs non-functional changes (refactoring, config, docs, CI/CD, dependency updates, formatting, infrastructure).
   b. **Non-functional changes:** Print:
      > OpenSpec detected — pass `--spec` to include spec context in planning.
      Then skip the rest of this block. `openspecContext` remains empty.
   c. **Functional changes:** Check whether an active OpenSpec change already covers this work — Glob `openspec/changes/*/proposal.md` (exclude `archive/`), and if any exist, try matching against the current git branch name. If a match is found, treat it as if the user passed `--spec` and continue to step 3. If no match, use AskUserQuestion:
      > This looks like a functional change. This project uses OpenSpec for spec-driven development.
      >
      > Options:
      > 1. **Start OpenSpec flow** — run `/opsx:propose` to spec this out first (recommended for non-trivial features)
      > 2. **Continue planning directly** — skip spec workflow, plan from conversation context
      > 3. **Use existing spec** — pass `--spec` if you already have an OpenSpec change for this
      >
      > Select (1/2/3):

      - On **1**: Stop plan-sdlc. Tell the user to run `/opsx:propose "<their description>"`. In plan mode, call ExitPlanMode first.
      - On **2**: Skip the rest of the OpenSpec block. `openspecContext` remains empty. Continue with standard planning.
      - On **3**: Re-run the OpenSpec loading logic (steps 3–6) to resolve and load the active change.
3. If the user provided a spec file path pointing into `openspec/changes/<name>/`, extract `<name>` as the active change.
4. Otherwise, Glob `openspec/changes/*/proposal.md` (exclude `archive/`). If exactly one non-archived change exists, use it. If multiple, try matching change directory names against the current git branch name. If still ambiguous, use AskUserQuestion:
   > Multiple active OpenSpec changes found. Which one are you working on?
   List the change names as options.
5. Once the active change is identified, Read in parallel:
   - `openspec/changes/<name>/proposal.md` — intent and scope
   - `openspec/changes/<name>/design.md` — technical approach (may not exist yet; skip if absent)
   - All files matching `openspec/changes/<name>/specs/*.md` — delta specs (the requirements)
   - `openspec/changes/<name>/tasks.md` — OpenSpec's task checklist (may not exist; skip if absent)
6. Store these as `openspecContext` for use in Steps 1–5. Update the plan file header `**Source:**` to `openspec/changes/<name>/`.

**Complexity routing:**

| Scope Signal | Normal Mode | Plan Mode |
|---|---|---|
| 1 file, clear change | Stop — no plan needed. Tell the user. | Lightweight plan (user explicitly chose to plan) |
| 2–3 files, clear scope | Lightweight: skip exploration and review loop | Lightweight |
| 4+ files or unclear scope | Full pipeline (Steps 1–7) | Full pipeline |
| Multiple independent subsystems | Decompose into separate plans | Decompose |

**TodoWrite setup (full pipeline only):** Create TodoWrite items for Steps 1–7. Skip TodoWrite for lightweight plans.

**Session recovery (full pipeline only):** When the designated plan file already has content, restart and overwrite — do NOT prompt (implements R23 single-touchpoint default for Step 0). Clear the file in-place and begin fresh. If the user wants to preserve the prior draft, they can `cp` the file before invoking the skill.

**Initialize plan file:** Write the skeleton header immediately:

```markdown
# [Feature Name] Implementation Plan

**Goal:** [TBD]
**Architecture:** [TBD]
**Source:** [Spec file path or "conversation context"]
**Verification:** [TBD]

---
```

**Context detection and guardrail loading (skill/plan.js):**

> **VERBATIM** — Run this bash block exactly as written.

```bash
SCRIPT=$(find ~/.claude/plugins -name "plan.js" -path "*/sdlc*/scripts/skill/plan.js" 2>/dev/null | sort -V | tail -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/skill/plan.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/skill/plan.js"
[ -z "$SCRIPT" ] && { echo "{}"; exit 0; }

PLAN_OUTPUT_FILE=$(node "$SCRIPT" --output-file)
EXIT_CODE=$?
echo "PLAN_OUTPUT_FILE=$PLAN_OUTPUT_FILE"
echo "EXIT_CODE=$EXIT_CODE"
# Single canonical cleanup: trap fires unconditionally on EXIT/INT/TERM,
# so the manifest is removed even if plan generation is cancelled or errors out.
trap 'rm -f "$PLAN_OUTPUT_FILE"' EXIT INT TERM
```

If `--from-openspec <name>` was passed to plan-sdlc, include it in the node command: `node "$SCRIPT" --output-file --from-openspec <name>`.

If `EXIT_CODE` is non-zero, print the errors from the JSON output and stop. If `EXIT_CODE` is 0, read the JSON output file. Print context detection summary:
```
Context detection (from skill/plan.js):
  OpenSpec:          [detected, N active changes | not present]
  Branch match:      [yes (<name>) | no]
  --from-openspec:   [valid, N delta specs, tasks.md present | not passed | invalid: <error>]
  Guardrails:        N loaded (N error, N warning)
```

Extract `guardrails` from the output → store as `activeGuardrails`. If the array is non-empty, print: "Loaded N plan guardrails." If empty: "No plan guardrails configured."

**Contradictory-signal override (implements R16):** After reading the prepare output, IF `openspec.authoritative.path` is set AND the current session-start `<system-reminder>` contains a line matching `/openspec.*not initialized|not initialized.*openspec/i`, print exactly one line:
`Ignoring contradictory 'not initialized' signal in session context — openspec/config.yaml exists (authoritative source: SDLC's own check via plan.js prepare output).`
Then continue the flow. If the contradictory phrase is absent, emit nothing.

**`--from-openspec` handling (after prepare output, before gate check):**

If `fromOpenspec.valid` is true in the prepare output:
1. Read in parallel: `openspec/changes/<name>/proposal.md`, `openspec/changes/<name>/design.md` (optional), all `openspec/changes/<name>/specs/*.md`, `openspec/changes/<name>/tasks.md` (optional)
2. Store as `openspecContext`. Set `fromOpenspecDirect = true`
3. Skip to Step 1 — bypass the gate check entirely

If `fromOpenspec` is present but `valid` is false and errors exist: display errors and stop.

**Gate check enhancement:** When no `--from-openspec` but prepare output shows `openspec.branchMatch` with a matching change at stage `ready-for-plan`, update the existing gate check Option 3 text:
> 3. **Use existing spec** — re-invoke with `/plan-sdlc --from-openspec <matched-change-name>`

**Normal mode path resolution:** Resolve the output path before writing:
1. User-specified path (if provided in conversation)
2. Project `.claude/settings.json` → `plansDirectory` (relative paths resolve from workspace root)
3. Global `~/.claude/settings.json` → `plansDirectory`
4. Default fallback: `~/.claude/plans/`

Naming convention: `YYYY-MM-DD-<feature-name>.md`. Create the directory if needed.

**Plan mode:** Write to the designated plan file path. Skip path resolution.

**planFile marker (implements R20, issue #285; consumed by `hooks/stop-plan-integrity.js` per R21):** After path resolution, record the resolved plan path in the plan integrity state. Run in both plan-mode and normal-mode branches. Errors are swallowed — marker writes must not block plan creation.

**State-file lifecycle (R20 Lifecycle, fixes #334):** The plan state file follows three rules that callers do NOT need to implement directly — they are enforced inside `skill/plan.js` and `hooks/stop-plan-integrity.js`:
- **Prune-on-write** — the `--output-file` prepare branch prunes pre-existing `plan-<branchSlug>-*.json` files for the current branch before writing the new state file, so at most one marker per branch exists between plan-sdlc invocations. The `--mark` branch does NOT prune (it would unlink its own target).
- **Consume-then-delete** — the Stop hook reads `planIntegrity` markers, evaluates the gates, then unlinks the marker regardless of outcome (single-shot semantics). Subsequent Stop events on the same branch fall through to the transcript-fallback path — this is correct R21 behavior.
- **GC orphan sweep** — `ship-sdlc --gc` and `execute-plan-sdlc --gc` sweep stale `plan-*` markers (TTL-expired or branch-deleted) alongside `ship-*` and `execute-*` files; the JSON output includes a `plan` bucket alongside `ship` and `execute`.

Each `--mark` block re-resolves `$SCRIPT` independently: SKILL.md bash blocks each run as a separate Bash tool invocation, so shell variables do NOT persist across blocks.

```bash
SCRIPT=$(find ~/.claude/plugins -name "plan.js" -path "*/sdlc*/scripts/skill/plan.js" 2>/dev/null | sort -V | tail -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/skill/plan.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/skill/plan.js"
# writes planIntegrity marker consumed by stop-plan-integrity Stop hook (issue #285)
[ -n "$SCRIPT" ] && node "$SCRIPT" --mark plan-file --path "<resolved-plan-path>" 2>/dev/null || true
```

Replace `<resolved-plan-path>` with the actual absolute path: in plan mode it is the designated plan file path extracted at the top of Step 0; in normal mode it is the path resolved above (from `plansDirectory` or the default fallback).

## Step 1 (CONSUME): Requirements Discovery and Exploration

**`fromOpenspecDirect` enrichment:** When `fromOpenspecDirect` is true (set by `--from-openspec` handling in Step 0):
- Use `tasks.md` as the PRIMARY decomposition skeleton — OpenSpec tasks were deliberately authored
- Skip the "Structured discovery" AskUserQuestion below — the proposal and delta specs already provide scope, integration, and success criteria
- Delta specs remain the authoritative requirements for Step 3 coverage validation

**Orchestrator dispatch (full pipeline only, implements R24–R28):**

After the `fromOpenspecDirect` enrichment block, determine which exploration path to take.

**Cleanup trap (install unconditionally before branching, with null guard):** The prepare script always creates a per-invocation tempdir on success — including for lightweight scopes — so cleanup MUST run regardless of which exploration path is taken. The null guard prevents `rm -rf "$(dirname "")"` (which resolves to `rm -rf .`) when `manifestPath` is null.

```bash
MANIFEST_FILE="<explorePack.manifestPath>"
if [ -n "$MANIFEST_FILE" ]; then
  trap 'rm -rf "$(dirname "$MANIFEST_FILE")"' EXIT INT TERM
fi
```

- **Full pipeline** (`explorePack.manifestPath` is non-null AND scope is 4+ files / unclear scope):

  1. Spawn `sdlc:plan-explore-orchestrator` Agent exactly once with inputs:
     ```
     MANIFEST_FILE: <explorePack.manifestPath>
     PROJECT_ROOT: <cwd>
     USER_PROMPT: <verbatim user request>
     OPENSPEC_CONTEXT: <space-separated path list, or "none">
     ```
     `USER_PROMPT` is authoritative — the orchestrator re-derives web-research dimensions
     independently from the manifest's `webResearchSignal` (which is a best-effort hint;
     plan.js may not have stdin when invoked from a TTY).
  2. Read the orchestrator's returned `Brief file:` absolute path. Use `Read` to load the brief into context. The brief is the source of truth for Step 2 task provenance.
  3. **Brief validation:** After loading the brief, grep its content for the pattern `F-[A-Z0-9_-]+-[0-9]+` (the `F-<DIM>-<n>` finding ID format). If zero matches are found, treat the orchestrator as if it had failed: append one line to `.sdlc/learnings/log.md`: `## <YYYY-MM-DD> — plan-sdlc orchestrator returned brief without F-DIM-N findings; using fallback inline exploration`, then proceed via the **Error fallback** path below. Rationale: a brief with no findings cannot satisfy G15 (Brief citation coverage) and would force every task into "out-of-scope addition" — better to fall back cleanly.

  **Brief consumption (when brief is present AND validation passed):**
  - Step 2 tasks MUST cite at least one `F-<DIM>-<n>` finding ID from the brief OR be explicitly marked "out-of-scope addition" with rationale (implements R27)
  - When the brief contains a `## Best-Practice Synthesis` section: Key Decisions MUST explicitly ADOPT / REJECT-with-rationale / mark NOT-APPLICABLE each web finding by its `F-<DIM>-<n>` ID (implements R27)

- **Lightweight scope** (`explorePack.scopeHintCount` ≤ 3 OR `explorePack.manifestPath` is null due to lightweight scope):
  - Skip orchestrator. Use inline exploration below. No brief. (Tempdir cleanup is already installed by the unconditional trap above when `manifestPath` is non-null.)

- **Error fallback** (`explorePack.error` is non-null, the orchestrator returned non-zero, or brief validation found zero `F-<DIM>-<n>` IDs):
  - Append one line to `.sdlc/learnings/log.md`: `## <YYYY-MM-DD> — plan-sdlc orchestrator skipped: <explorePack.error or "brief without F-DIM-N findings">`
  - Use inline exploration below. Plan still produced. (implements R28)

**Structured discovery:** When requirements are vague (a single sentence or ambiguous goal), use AskUserQuestion with 2–3 targeted questions at once:
1. **Scope** — what's in, what's explicitly out?
2. **Integration** — what existing code does this touch?
3. **Success** — how will we know it works?

Wait for answers before continuing.

**Codebase exploration (skip for lightweight):** Use read-only tools (Glob, Grep, Read, LSP):
- Relevant file structure and patterns in affected areas
- Existing modules, interfaces, and types the feature touches
- Testing patterns used in the project
- Build/lint/test commands (from Makefile, package.json, or similar)
- Naming conventions and code style

Identify constraints: language, framework, existing conventions, testing approach.

**OpenSpec enrichment (when `openspecContext` is available):**
- Use `proposal.md` for goal and scope understanding (what's in, what's out)
- Use delta specs (`specs/*.md`) with their ADDED/MODIFIED/REMOVED sections as the authoritative requirements — each delta entry is a requirement
- Use `design.md` for architecture constraints and technical approach decisions
- Use `tasks.md` as a coarse reference for decomposition — OpenSpec tasks are higher-level than plan-sdlc tasks, so decompose further rather than copying verbatim
- When the OpenSpec artifacts provide sufficient scope, integration, and success criteria, skip the "Structured discovery" AskUserQuestion — the proposal and delta specs already answer those questions

**Write to plan file:** After exploration, update the plan file:
- Fill in Goal, Architecture, Verification header fields
- Append a `## Requirements` section with numbered checklist (one bullet per requirement)

**Re-anchor:** Before leaving Step 1, re-read the plan file's Requirements section. This counters attention drift after many exploration calls.

## Step 2 (PLAN): Decompose Into Tasks

**Scope check:** If requirements span independent subsystems with no shared state, use AskUserQuestion:
> These requirements cover independent subsystems. Recommend splitting into N plans. Proceed as one plan or split?

Wait for answer.

**File structure mapping** — before writing tasks, map out:
- Files to create (path + one-line responsibility)
- Files to modify (path + what changes)
- Test files (aligned with source files)

**`fromOpenspecDirect` decomposition:** When `fromOpenspecDirect` is true:
- Adopt the task structure from `tasks.md` as the starting skeleton
- For each OpenSpec task: map to one plan task (or split if > 5 files), add Complexity/Risk/Depends on/Verify metadata, and expand the description to be self-contained for agent dispatch
- If `tasks.md` is absent (prepare output shows `hasTasks: false`), fall back to standard decomposition from delta specs below

**OpenSpec task annotation (implements R29 — Fixes #414):** When `fromOpenspecDirect` is true AND `openspecContext.tasks[]` is non-null in the prepare output, each plan task derived from one or more OpenSpec tasks MUST carry an `openspec-task:` block beneath its standard metadata fields. Format documented in `./plan-format-reference.md`:

```
**openspec-task:**
- change: <change-name>
- ref: <kebab-slug-6char-hash from openspecContext.tasks[i].ref>
- line: <openspecContext.tasks[i].line>
- title: <openspecContext.tasks[i].title>
```

Plan tasks NOT derived from any OpenSpec task MUST omit the field. N:1 mapping (multiple plan tasks → same `ref`) is allowed when one OpenSpec task expands into several plan tasks — copy the same `change`/`ref`/`line`/`title` quad on each.

**Out-of-scope OpenSpec tasks (implements R30):** When the plan introduces a plan-only task with no OpenSpec source, the plan-author MUST also append (or extend) an `## Out-of-scope OpenSpec tasks` section listing each uncovered OpenSpec task title with a one-line rationale — OR add at least one plan task carrying that `ref`. Every entry from `openspecContext.tasks[]` must be either covered by ≥1 plan task's `openspec-task.ref` OR listed in `## Out-of-scope OpenSpec tasks`. This is enforced by G16 in Step 3.

**Task decomposition rules:**
- Each task = one independently completable unit with a clear deliverable
- Each task touches 1–5 files (more than 5 → split)
- Order: foundations → features → integration → polish
- Dependencies explicit (task B names task A if it needs A's output)

**OpenSpec-aware decomposition (when `openspecContext` is available):**
- Map each ADDED and MODIFIED requirement from the delta specs to at least one task
- In the Key Decisions section, note which OpenSpec `design.md` decisions were adopted and which (if any) were overridden with rationale
- Set the plan header `**Source:**` field to `openspec/changes/<name>/` (not "conversation context")

**Key decisions:** Note every decision where you chose between valid approaches. Focus on choices where a reasonable implementer might differ without the rationale. Skip obvious decisions.

**Per-task metadata (required, consumed by execute-plan-sdlc):** Use the exact format from `./plan-format-reference.md`:

```markdown
### Task N: [Component Name]

**Complexity:** Trivial | Standard | Complex
**Risk:** Low | Medium | High
**Depends on:** Task X, Task Y (or "none")
**Verify:** tests | build | lint | manual

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts` — [what changes]
- Test: `tests/exact/path/to/test.ts`

**Description:**
[What to implement, how it connects to existing code, expected behavior, edge cases.
Complete enough that an agent with no codebase context can execute it.]

**Acceptance criteria:**
- [ ] [Specific, verifiable criterion]
- [ ] [Another criterion]
```

**Verification strategy — match to task type:**
- Feature/logic → TDD (write failing test, implement, pass)
- Config/infrastructure → build verification
- Documentation → manual review
- Integration → integration test or E2E

Do not mandate TDD for config, documentation, or infrastructure tasks.

**Write to plan file:** Append Key Decisions section (if applicable) and all task blocks.

**Post-write cleanup:** Remove the `## Requirements` working section from the plan file. Requirements are traceable through task acceptance criteria; the section was temporary scaffolding.

## Step 3 (CRITIQUE): Self-Review Plan

**Re-anchor:** Re-read the plan file before evaluating gates. The file — not your memory of it — is the source of truth.

**G17 Dimension Coverage subagent dispatch (R31, R33, parallel with main-thread gates):**

Dispatch the G17 subagent at the START of Step 3, in parallel with the main thread's gate evaluations below. Parameters come verbatim from prepare output (`agent-dispatch-script-driven` guardrail — do NOT hardcode these values):

- `subagent_type`: `g17Dispatch.subagentType`
- `model`: `g17Dispatch.model`
- prompt body: read `g17Dispatch.promptTemplatePath` and fill template variables `{PLAN_FILE_PATH}` (absolute path to the plan file), `{DIMENSIONS_DIR}` (`.sdlc/review-dimensions/`), `{COPILOT_DIR}` (`.github/instructions/`), `{GITHUB_HOSTING_DETECTED}` (`githubHosting.detected` from P14), `{LEARNINGS_LOG_PATH}` (`.sdlc/learnings/log.md`), `{PR_COMMIT_WINDOW}` (best-effort "last 14 days" if unknown)

When `g17Dispatch.promptTemplatePath` is null (prepare script reported an error finding the template), skip G17 dispatch entirely and treat `g17Findings` as empty. Log to `.sdlc/learnings/log.md`:
```
## YYYY-MM-DD — plan-sdlc: G17 skipped — promptTemplatePath null (template not found at prepare time)
```

While G17 runs, continue main-thread gate evaluations below. **JOIN on G17 before writing the `critiqueRan` marker.** Persist G17's returned JSON in memory as `g17Findings` for Step 4 consumption. Parse the `findings` JSON object from the subagent's response. **On dispatch failure / timeout / malformed JSON** — treat `g17Findings` as `{ findings: [], rendering: "", suppressed_count: 0 }` and continue; log failure to `.sdlc/learnings/log.md` per R31 dispatch-failure fallback.

Check each quality gate:

| Gate | Check |
|---|---|
| Requirements coverage | Every requirement from Step 1 has at least one task |
| No orphan tasks | Every task traces back to a requirement |
| Dependency integrity | No circular deps; every named dependency exists |
| File conflict potential | Two tasks modifying the same file are in dependency order |
| Context sufficiency | Each task description is self-contained enough to dispatch as an agent |
| Classification accuracy | Complexity/risk assignments match the heuristics |
| No scope creep | No tasks beyond stated requirements |
| Verification completeness | Every task has at least one verification method |
| Decomposition balance | No task touches > 5 files; no plan with > 80% Trivial tasks |
| File existence | Every path under "Modify:" exists in the codebase (verify with Glob) |
| OpenSpec requirements coverage | When `openspecContext` exists: every ADDED/MODIFIED requirement in delta specs has at least one task |
| Brief citation coverage | When `explorePack.manifestPath` was non-null AND the orchestrator produced a brief: every Standard/Complex task cites ≥1 `F-<DIM>-<n>` finding ID OR is marked "out-of-scope addition" with rationale. Trivial tasks exempt. Uncited Standard/Complex tasks are a blocking error. (G15) |
| Dependency target existence | Every "Depends on: Task N" references a task number that exists in the plan |
| Self-containment test | Pick the most complex task — could an agent implement it using only its description + Key Decisions? If not, the description is incomplete |
| Guardrail compliance | For each guardrail in `activeGuardrails`: evaluate whether the plan (as written) satisfies its `description`. Report each as PASS or FAIL with a one-line rationale. Guardrails with `severity: "error"` (or no severity, defaulting to error) that FAIL are blocking — they must be fixed in Step 4. Guardrails with `severity: "warning"` that FAIL are advisory — note them but do not block. |
| OpenSpec tasks.md coverage (G16) | When `fromOpenspecDirect` is true: every entry in `openspecContext.tasks[]` is either (a) referenced by ≥1 plan task's `openspec-task.ref`, or (b) listed in `## Out-of-scope OpenSpec tasks`. Error severity (blocking). |
| Dimension Coverage (G17) | When G17 subagent dispatched: emit proposals per R31 criteria with R31 suppression and ranking. Severity: **advisory** — findings are surfaced in Step 4 but never block plan finalization. Absent proposals do not fail this gate. |

Note every issue. Do NOT write to the plan file in this step.

**guardrailsEvaluated marker (implements R20, issue #285):** After completing the guardrail-compliance gate evaluation above, record the checkpoint. Each `--mark` block re-resolves `$SCRIPT` because SKILL.md bash blocks do not share shell state.

```bash
SCRIPT=$(find ~/.claude/plugins -name "plan.js" -path "*/sdlc*/scripts/skill/plan.js" 2>/dev/null | sort -V | tail -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/skill/plan.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/skill/plan.js"
# writes planIntegrity marker consumed by stop-plan-integrity Stop hook (issue #285)
[ -n "$SCRIPT" ] && node "$SCRIPT" --mark guardrailsEvaluated 2>/dev/null || true
```

Ensure G17 has returned and `g17Findings` is populated before marking critiqueRan (implements R31 join requirement).

**critiqueRan marker (implements R20, issue #285):** After all Step 3 checks are complete AND G17 has returned (this is the final action of Step 3), record the checkpoint.

```bash
SCRIPT=$(find ~/.claude/plugins -name "plan.js" -path "*/sdlc*/scripts/skill/plan.js" 2>/dev/null | sort -V | tail -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/skill/plan.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/skill/plan.js"
# writes planIntegrity marker consumed by stop-plan-integrity Stop hook (issue #285)
[ -n "$SCRIPT" ] && node "$SCRIPT" --mark critiqueRan 2>/dev/null || true
```

## Step 4 (IMPROVE): Revise Plan and Present for Approval

Fix all issues from Step 3. Rewrite the plan file with fixes applied (edit the existing file, don't append).

**G16 (OpenSpec tasks.md coverage) failure resolution:** When G16 reports uncovered OpenSpec task entries, resolve each one by EITHER (a) adding a plan task with the missing `openspec-task` block carrying the corresponding `ref`, OR (b) appending the uncovered title under the `## Out-of-scope OpenSpec tasks` section with a one-line rationale. Both paths are valid; choose based on whether the implementation actually covers the work.

If `activeGuardrails` is non-empty, append a `## Guardrail Compliance` section to the plan file listing each guardrail's evaluation result. Error-severity failures must be resolved before presenting to user. When an error-severity failure cannot be resolved by plan revision and blocks the workflow, offer **harden** (run `/harden-sdlc` to analyze why this failed and propose stronger guardrails / dimensions / instructions that would catch it earlier next time — opt-in, no surface is edited without your approval) alongside the user-revision options. When the user selects **harden** (interactive mode only — suppressed when `--auto` is set), dispatch `Skill(harden-sdlc)` with `--failure-text "Plan blocked by error-severity guardrail <id>: <description> — <rationale>"`, `--skill plan-sdlc`, `--step "Step 4 — IMPROVE"`, `--operation "error-severity guardrail block"`. Implements R19. Format:

```markdown
## Guardrail Compliance

| Guardrail | Severity | Status | Rationale |
|---|---|---|---|
| no-direct-db-access | error | PASS | No tasks modify database schema files |
| prefer-composition | warning | PASS | No class hierarchies proposed |
```

**Suggested Review Dimensions (R34, KD6 placement — Fixes #417):**

When `g17Findings.findings` is non-empty, append the `g17Findings.rendering` markdown verbatim to the plan file. Placement (KD6):
- If `## Guardrail Compliance` was written above, splice immediately after that section.
- Otherwise, splice immediately after the last `### Task N:` block.

When `g17Findings.findings` is empty (or `g17Findings` is the empty-fallback from a dispatch failure), do nothing. Absent proposals are not a failure — G17 is advisory (R31).

Step 4 is autonomous (implements R22 single-touchpoint handoff). After fixes are applied (Guardrail Compliance section written when `activeGuardrails` is non-empty, and Suggested Review Dimensions spliced when `g17Findings.findings` is non-empty per R34), proceed directly to Step 5. The user does NOT see the plan at Step 4; the single user touchpoint for the finalized plan is Step 7 (Handoff). The Step 4 error-severity guardrail-block harden offer above remains a genuine decision gate and is preserved (R19).

## Step 5 (CRITIQUE): Plan Review Loop

Skip for lightweight plans (2–3 file scope from Step 0 routing).

Dispatch a plan reviewer subagent using `./plan-reviewer-prompt.md`. Provide:
- Path to the plan file
- The requirements checklist from Step 1
- Source requirements or spec (if a file exists)
- When `openspecContext` is available, include the delta spec files as the "Source requirements" input — this gives the cross-model reviewer the ability to verify that every OpenSpec requirement is covered by at least one task
- When `activeGuardrails` is non-empty, include them as `{GUARDRAILS}` — format as one guardrail per line: `- [id] (severity): description`. If no guardrails: `"none configured"`.

**Model selection:** Use a different model than the one that wrote the plan when the plan has 5+ tasks. Cross-model review catches blind spots.
- Plan written by sonnet → dispatch reviewer as opus
- Plan written by opus → dispatch reviewer as sonnet
- Plans under 5 tasks → same model is acceptable

**Review loop:**
- Approved → Step 6 is a no-op, proceed to Step 7
- Issues found → go to Step 6
- Max 3 iterations → use AskUserQuestion to surface unresolved issues to user. Offer **harden** (run `/harden-sdlc` to analyze why this failed and propose stronger guardrails / dimensions / instructions that would catch it earlier next time — opt-in, no surface is edited without your approval) alongside the existing escalation options. When the user selects **harden** (interactive mode only — suppressed when `--auto` is set), dispatch `Skill(harden-sdlc)` with `--failure-text "Plan reviewer loop did not converge after 3 iterations. Outstanding issues: <issues>"`, `--skill plan-sdlc`, `--step "Step 5 — review loop"`, `--operation "reviewer-loop max iterations"`. Implements R19.

## Step 6 (IMPROVE): Apply Review Fixes

Fix each blocking issue identified by the reviewer. Rewrite the plan file with fixes applied.

Re-dispatch the reviewer (back to Step 5 loop).

If this is the 3rd iteration, use AskUserQuestion to surface remaining issues instead of looping.

## Step 6.5 (LINK VERIFICATION): Validate URLs in plan content (R18, issue #198) — HARD GATE

After the reviewer loop converges (or the user resolves remaining issues), validate every URL embedded in the finalized plan file via the shared link validator. The script reads the plan content from stdin and auto-derives `expectedRepo` from `parseRemoteOwner(cwd)` and `jiraSite` from `~/.sdlc-cache/jira/` — the skill MUST NOT construct ctx JSON.

```bash
LINKS_LIB=$(find ~/.claude/plugins -name "links.js" -path "*/sdlc*/scripts/lib/links.js" 2>/dev/null | sort -V | tail -1)
[ -z "$LINKS_LIB" ] && [ -f "plugins/sdlc-utilities/scripts/lib/links.js" ] && LINKS_LIB="plugins/sdlc-utilities/scripts/lib/links.js"
[ -z "$LINKS_LIB" ] && { echo "ERROR: Could not locate scripts/lib/links.js. Is the sdlc plugin installed?" >&2; exit 2; }
node "$LINKS_LIB" --file "$plan_path" --json
LINK_EXIT=$?
```

On non-zero exit (`LINK_EXIT != 0`):
- The script has already printed the violation list to stderr.
- Do NOT proceed to Step 7 (Handoff). The plan is not ready.
- Surface the violation list verbatim to the user.
- Stop. Do not retry. Do not edit URLs without user input. Do not bypass.

On zero exit, proceed to Step 7. `SDLC_LINKS_OFFLINE=1` skips network reachability while keeping context-aware checks (GitHub identity match, Atlassian host match) — use in sandboxed CI.

## Step 7: Handoff

**Context-heaviness advisory (implements R17):** Before printing either branch below, locate and run the advisory wrapper. If it prints text, prepend that text verbatim to the handoff menu (above the `ship` / `execute` / `done` lines). If it prints nothing, skip the prepend.

```bash
SCRIPT=$(find ~/.claude/plugins -name "plan-handoff-advisory.js" -path "*/sdlc*/scripts/skill/plan-handoff-advisory.js" 2>/dev/null | sort -V | tail -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/skill/plan-handoff-advisory.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/skill/plan-handoff-advisory.js"
[ -n "$SCRIPT" ] && node "$SCRIPT"
```

The wrapper reads `$TMPDIR/sdlc-context-stats.json` (written by the `UserPromptSubmit` hook `hooks/context-stats.js`) and emits a `/compact` advisory only when transcript ≥60% of model budget. Pipeline state is preserved across `/compact` (PreCompact + SessionStart hooks), so re-invoking after compaction is safe.

**Plan mode:** Announce the plan path and propose execution. Prepend any advisory output from the wrapper above the `ship` / `execute` lines:

> Plan written to `<path>`. On approval:
>   ship    — run the full pipeline: execute → commit → review → version → PR (/ship-sdlc)
>   execute — execute the plan only (/execute-plan-sdlc)

Then call ExitPlanMode. Do NOT invoke execute-plan-sdlc or ship-sdlc in this turn — they run after the user accepts in the next turn.

**Normal mode:** Announce the plan path, then present the Workflow Continuation menu (see below). Prepend any advisory output from the wrapper above the menu's `ship` / `execute` / `done` lines.

## Error Recovery

| Error | Recovery |
|---|---|
| Spec/requirements not found | Ask user to provide path or paste content |
| Codebase exploration fails (too large) | Ask user to point to relevant directories |
| Plan reviewer loop exceeds 3 iterations | Surface to user for guidance |
| Requirements are contradictory | Flag specific contradictions, ask user to resolve |
| User approves but output path fails | Retry with a different path; offer to print plan to screen |

## DO NOT

- Write implementation code in the plan (code snippets for patterns are fine; full implementations are not)
- Mandate TDD for every task — match verification to task type
- Invoke execute-plan-sdlc within the same turn as plan-sdlc (execution happens in the next turn after user acceptance)
- Create plans with fewer than 2 tasks (just do the work directly)
- Skip the plan review loop (unless lightweight routing applies)
- Use absolute file paths that only work on one machine
- Put plans in `$TMPDIR` — plans should survive session boundaries
- Put plans in plugin-branded directories (no `docs/superpowers/plans/`)
- Ignore plan mode's designated file path when plan mode is active — always write to it
- Use TodoWrite for lightweight plans — it adds overhead without value
- Prompt the user at Step 0 session-recovery or Step 4 — those steps are autonomous (single-touchpoint at Step 7, implements R22/R23)

## Gotchas

**Vague task descriptions produce hallucinated implementations.** "Add authentication" is not a task. "Add JWT token validation middleware at `src/middleware/auth.ts` that checks the Authorization header and attaches the decoded user to `req.user`" is a task. If you can't describe the exact file and behavior, the task isn't ready.

**Complexity classification drift.** A task titled "add a config key" may be Trivial in the title but Standard in practice if it requires a new schema, a migration, and downstream changes. Classify by the full description, not the title.

**Implicit dependencies.** Two tasks that don't share a file may still have dependencies — barrel files, type re-exports, config registrations, route ordering. Check for these during Step 3 critique.

**Over-decomposition.** If most tasks are Trivial, the plan is over-decomposed. Each task should represent a meaningful unit of work — not a single line change.

**Under-decomposition.** A task that creates 8 files or implements 3 independent behaviors will fail in execution. If a task touches > 5 files, split it.

**Plan-execution format mismatch.** The plan MUST include Complexity, Risk, Depends on, and Verify fields per task — execute-plan-sdlc consumes these for wave building. Missing metadata forces inference, which is slower and less accurate.

**Plan file is the single source of truth.** All working state lives in the plan file. Do not create temporary files, scratchpads, or side documents. If exploration findings are needed later, they belong in the plan file's Requirements section until cleanup.

## Learning Capture

After writing the plan, append to `.sdlc/learnings/log.md`:

- Requirements that needed significant clarification before decomposition
- Scope decisions (what was included/excluded and why)
- Codebase patterns that influenced task structure
- Plans that were over/under-decomposed on first draft

Format:
```
## YYYY-MM-DD — plan-sdlc: <feature name>
<what was learned>
```

## Workflow Continuation

After writing the plan (normal mode only), present the user with available next actions:

```
What would you like to do next?
  ship     — execute, commit, review, version, and PR (/ship-sdlc)
  execute  — execute the plan only (/execute-plan-sdlc)
  done     — stop here

Select:
```

On selection, invoke the chosen skill using the Skill tool. On "done", end without further action.

## See Also

- `./plan-reviewer-prompt.md` — plan review subagent template
- `./plan-format-reference.md` — plan document format specification
- [`/execute-plan-sdlc`](../execute-plan-sdlc/SKILL.md) — skill that executes the plans this skill produces
