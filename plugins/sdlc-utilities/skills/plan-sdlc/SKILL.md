---
name: plan-sdlc
description: "Use when writing an implementation plan from requirements, a spec, a design doc, or a user description. ALWAYS use when plan mode is active — this is the designated plan-mode skill. Analyzes scope, maps file structure, decomposes into classified tasks with dependencies, and produces a plan ready for execute-plan-sdlc. Triggers on: write plan, create plan, plan this, break this into tasks, implementation plan, plan mode."
user-invocable: true
argument-hint: "[--spec] [--from-openspec <change-name>] [spec-file-path]"
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

**Session recovery (full pipeline only):** Check if the plan file already has content. If yes, use AskUserQuestion:
> Found existing plan draft with N tasks. Resume from critique (Step 3), or restart?

Wait for explicit response. If "resume", re-read the plan file and skip to Step 3. If "restart", clear the file and begin fresh.

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
SCRIPT=$(find ~/.claude/plugins -name "plan.js" -path "*/sdlc*/scripts/skill/plan.js" 2>/dev/null | head -1)
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

## Step 1 (CONSUME): Requirements Discovery and Exploration

**`fromOpenspecDirect` enrichment:** When `fromOpenspecDirect` is true (set by `--from-openspec` handling in Step 0):
- Use `tasks.md` as the PRIMARY decomposition skeleton — OpenSpec tasks were deliberately authored
- Skip the "Structured discovery" AskUserQuestion below — the proposal and delta specs already provide scope, integration, and success criteria
- Delta specs remain the authoritative requirements for Step 3 coverage validation

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
| Dependency target existence | Every "Depends on: Task N" references a task number that exists in the plan |
| Self-containment test | Pick the most complex task — could an agent implement it using only its description + Key Decisions? If not, the description is incomplete |
| Guardrail compliance | For each guardrail in `activeGuardrails`: evaluate whether the plan (as written) satisfies its `description`. Report each as PASS or FAIL with a one-line rationale. Guardrails with `severity: "error"` (or no severity, defaulting to error) that FAIL are blocking — they must be fixed in Step 4. Guardrails with `severity: "warning"` that FAIL are advisory — note them but do not block. |

Note every issue. Do NOT write to the plan file in this step.

## Step 4 (IMPROVE): Revise Plan and Present for Approval

Fix all issues from Step 3. Rewrite the plan file with fixes applied (edit the existing file, don't append).

If `activeGuardrails` is non-empty, append a `## Guardrail Compliance` section to the plan file listing each guardrail's evaluation result. Error-severity failures must be resolved before presenting to user. When an error-severity failure cannot be resolved by plan revision and blocks the workflow, offer **harden** (run `/harden-sdlc` to analyze why this failed and propose stronger guardrails / dimensions / instructions that would catch it earlier next time — opt-in, no surface is edited without your approval) alongside the user-revision options. When the user selects **harden** (interactive mode only — suppressed when `--auto` is set), dispatch `Skill(harden-sdlc)` with `--failure-text "Plan blocked by error-severity guardrail <id>: <description> — <rationale>"`, `--skill plan-sdlc`, `--step "Step 4 — IMPROVE"`, `--operation "error-severity guardrail block"`. Implements R19. Format:

```markdown
## Guardrail Compliance

| Guardrail | Severity | Status | Rationale |
|---|---|---|---|
| no-direct-db-access | error | PASS | No tasks modify database schema files |
| prefer-composition | warning | PASS | No class hierarchies proposed |
```

Present to user via AskUserQuestion:

1. **Requirements-to-task mapping:**
   - Requirement 1 → Task 2, Task 3
   - Requirement 2 → Task 4

2. **Full task list summary:**
   | Task | Name | Complexity | Risk |
   |---|---|---|---|
   | 1 | [name] | Standard | Low |
   | ... | ... | ... | ... |

3. **Options:** approve / change (describe what) / question (ask anything)

Approval loop is unbounded. Do not proceed without explicit approval.

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
LINKS_LIB=$(find ~/.claude/plugins -name "links.js" -path "*/sdlc*/scripts/lib/links.js" 2>/dev/null | head -1)
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
SCRIPT=$(find ~/.claude/plugins -name "plan-handoff-advisory.js" -path "*/sdlc*/scripts/skill/plan-handoff-advisory.js" 2>/dev/null | head -1)
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

## Gotchas

**Vague task descriptions produce hallucinated implementations.** "Add authentication" is not a task. "Add JWT token validation middleware at `src/middleware/auth.ts` that checks the Authorization header and attaches the decoded user to `req.user`" is a task. If you can't describe the exact file and behavior, the task isn't ready.

**Complexity classification drift.** A task titled "add a config key" may be Trivial in the title but Standard in practice if it requires a new schema, a migration, and downstream changes. Classify by the full description, not the title.

**Implicit dependencies.** Two tasks that don't share a file may still have dependencies — barrel files, type re-exports, config registrations, route ordering. Check for these during Step 3 critique.

**Over-decomposition.** If most tasks are Trivial, the plan is over-decomposed. Each task should represent a meaningful unit of work — not a single line change.

**Under-decomposition.** A task that creates 8 files or implements 3 independent behaviors will fail in execution. If a task touches > 5 files, split it.

**Plan-execution format mismatch.** The plan MUST include Complexity, Risk, Depends on, and Verify fields per task — execute-plan-sdlc consumes these for wave building. Missing metadata forces inference, which is slower and less accurate.

**Plan file is the single source of truth.** All working state lives in the plan file. Do not create temporary files, scratchpads, or side documents. If exploration findings are needed later, they belong in the plan file's Requirements section until cleanup.

## Learning Capture

After writing the plan, append to `.claude/learnings/log.md`:

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
