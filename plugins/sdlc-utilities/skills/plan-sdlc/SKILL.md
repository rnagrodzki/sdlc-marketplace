---
name: plan-sdlc
description: "Use when writing an implementation plan from requirements, a spec, a design doc, or a user description. Analyzes scope, maps file structure, decomposes into classified tasks with dependencies, and produces a plan ready for execute-plan-sdlc. Triggers on: write plan, create plan, plan this, break this into tasks, implementation plan."
user-invocable: true
---

# Plan (SDLC)

Write an implementation plan from requirements, a spec, or a user description. Produces a plan in the format consumed by execute-plan-sdlc — with per-task complexity/risk/dependency metadata embedded.

**Announce at start:** "I'm using the plan-sdlc skill."

## Step 0: Prerequisites and Complexity Routing

**Gather requirements:** If no spec or requirements document is in context, ask the user:
> What do you want to implement? (describe in free form, bullet points, or provide a file path)

**Structured discovery** — when requirements are vague (a single sentence or ambiguous goal), ask 2–3 targeted questions before proceeding:
1. **Scope** — what's in, what's explicitly out?
2. **Integration** — what existing code does this touch?
3. **Success** — how will we know it works?

Ask all questions at once. Wait for answers before continuing.

**Complexity routing:**

| Scope Signal | Action |
|---|---|
| 1 file, clear change | Stop — this doesn't need a plan. Just do the work. Tell the user: "This is a single-file change — no plan needed." |
| 2–3 files, clear scope | Lightweight: skip codebase exploration and plan review loop; write plan directly and present for approval |
| 4+ files or unclear scope | Full pipeline (Steps 1–7) |
| Multiple independent subsystems | Decompose into separate plans first; suggest one plan per subsystem |

**Session recovery (full pipeline only):** Before beginning exploration, check for an existing scratchpad at `$TMPDIR/claude-plans/<feature-name>-exploration.md`. If one exists:
> Found exploration notes from a previous session for this feature. Resume from Step 2 using these findings, or restart exploration from scratch?

Wait for explicit user response. If "resume", re-read the scratchpad and skip directly to Step 2. If "restart", delete the scratchpad and begin fresh.

## Step 1 (CONSUME): Analyze Requirements and Codebase

Parse the requirements into a checklist: each requirement becomes one bullet. Number them.

Explore the codebase:
- Relevant file structure and patterns in the affected areas
- Existing modules, interfaces, and types the feature will touch
- Testing patterns used in the project
- Build/lint/test commands (from Makefile, package.json, or similar)
- Naming conventions and code style

Identify constraints: language, framework, existing conventions, testing approach, and anything that limits implementation choices.

**Exploration scratchpad (full pipeline only):** On large codebases, exploration findings scroll out of context before Step 2. Create a scratchpad at `$TMPDIR/claude-plans/<feature-name>-exploration.md` and:
- After every 2 exploration actions (Glob, Grep, Read, LSP), append key findings: file paths and their roles, interfaces and patterns the feature touches, constraints discovered, approach decisions considered
- At the end of exploration, append a checkpoint block to the scratchpad:
  ```
  ## Checkpoint
  Status: Step 1 complete
  Requirements: [your numbered checklist]
  Timestamp: [ISO timestamp]
  ```
- The scratchpad is a working document — not part of the plan output

**Re-anchor before Step 2:** Before leaving Step 1, re-read:
1. The original requirements (user description or spec file)
2. Your numbered requirements checklist
3. The exploration scratchpad (if created)

This counters attention drift — after many exploration calls, the original requirements may have faded from the active context window.

## Step 2 (PLAN): Decompose Into Tasks

**Scope check first:** If requirements span multiple independent subsystems with no shared state, flag it:
> These requirements cover independent subsystems. Recommend splitting into N plans. Proceed as one plan or split?
Wait for answer.

**File structure mapping** — before writing tasks, map out:
- Files to create (path + one-line responsibility description)
- Files to modify (path + what changes and where)
- Test files (aligned with source files)

**Task decomposition rules:**
- Each task = one independently completable unit of work with a clear deliverable
- Each task touches 1–5 files (more than 5 → split the task)
- Tasks ordered naturally: foundations → features → integration → polish
- Dependencies made explicit (task B names task A if it needs A's output)

**Key decisions:** While decomposing, note every decision where you chose between multiple valid approaches. Record each in the plan's `## Key Decisions` section. Focus on choices executing agents need to know — decisions where a reasonable implementer might choose differently without the rationale. Skip obvious decisions.

**Per-task metadata (required, consumed by execute-plan-sdlc):**

Every task must have these fields:

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
Complete enough that an agent with no codebase context can execute it. Include code
snippets for non-obvious patterns; do not write the full implementation.]

**Acceptance criteria:**
- [ ] [Specific, verifiable criterion]
- [ ] [Another criterion]
```

**Verification strategy — match to task type:**
- Feature/logic tasks → TDD (write failing test, implement, pass)
- Config/infrastructure → build verification (does it compile/deploy?)
- Documentation → manual review
- Integration → integration test or E2E

Do not mandate TDD for config, documentation, or infrastructure tasks.

## Step 3 (CRITIQUE): Self-Review Plan

Check each quality gate:

**Re-anchor before critique:** Re-read your requirements checklist from Step 1 before evaluating the quality gates below. The checklist — not your memory of it — is the source of truth for requirements coverage.

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
| Decomposition balance | No task touches > 5 files; no plan with > 80% Trivial tasks (likely over-decomposed) |

Note every issue found. Fix all issues in Step 4 before presenting.

## Step 4 (IMPROVE): Revise and Present

Fix every issue found in Step 3. Then present:

1. **Requirements checklist** (from Step 1) with task mappings:
   - [ ] Requirement 1 → Task 2, Task 3
   - [ ] Requirement 2 → Task 4

2. **Full plan document** (all tasks with metadata)

3. **Wave preview** (estimated — execute-plan-sdlc will finalize):
   ```
   Wave preview:
     Pre-wave: Task 1 [Trivial]
     Wave 1:   Task 2 [Standard], Task 3 [Standard], Task 4 [Complex]
     Wave 2:   Task 5 [Standard]
   ```

Wait for user feedback. User may:
- Approve → proceed to Step 5
- Request changes → revise and re-present (no limit on iterations)
- Ask questions → answer and re-present

Do not proceed to Step 5 without explicit approval.

## Step 5 (DO): Write Plan Document

Save to the location the user specified, or default to:
`$TMPDIR/claude-plans/YYYY-MM-DD-<feature-name>.md`

Create the directory if it does not exist: `mkdir -p $TMPDIR/claude-plans`

Plans are ephemeral working documents — they belong in temp storage, not in the project tree.

See `./plan-format-reference.md` for the exact format specification. The plan header:

```markdown
# [Feature Name] Implementation Plan

**Goal:** [One sentence]
**Architecture:** [2–3 sentences about the overall approach]
**Source:** [Spec file path or "conversation context"]
**Verification:** [Primary verification command, e.g., "npm test", "go test ./..."]

---
```

Followed by each task in the standard task format (from Step 2).

## Step 6 (CRITIQUE): Plan Review Loop

Skip for lightweight plans (2–3 file scope from Step 0 routing).

Dispatch a plan reviewer subagent using the template in `./plan-reviewer-prompt.md`. Provide:
- Path to the written plan file
- The requirements checklist from Step 1
- Source requirements or spec (if a file exists)

**Model selection:** Use a different model than the one that wrote the plan when the plan has 5+ tasks. Same-model review has a blind spot — it tends to approve its own reasoning patterns. Cross-model review is more adversarial.

- If plan was written by sonnet → dispatch reviewer as opus
- If plan was written by opus → dispatch reviewer as sonnet
- For plans under 5 tasks → same model is acceptable

**Review loop:**
- Approved → proceed to Step 7
- Issues found → fix and re-dispatch reviewer
- Max 3 iterations → surface to user if still unresolved

## Step 7: Handoff

```
Plan written to `<path>`.

To execute: /execute-plan-sdlc
```

Do NOT automatically invoke execute-plan-sdlc. The user decides when to execute.

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
- Automatically invoke execute-plan-sdlc after writing
- Create plans with fewer than 2 tasks (just do the work directly)
- Skip the plan review loop (unless lightweight routing applies)
- Use absolute file paths that only work on one machine
- Put plans in the project tree — plans are temp working documents
- Put plans in plugin-branded directories (no `docs/superpowers/plans/`)

## Gotchas

**Vague task descriptions produce hallucinated implementations.** "Add authentication" is not a task. "Add JWT token validation middleware at `src/middleware/auth.ts` that checks the Authorization header and attaches the decoded user to `req.user`" is a task. If you can't describe the exact file and behavior, the task isn't ready.

**Complexity classification drift.** A task titled "add a config key" may be Trivial in the title but Standard in practice if it requires a new schema, a migration, and downstream changes. Classify by the full description, not the title.

**Implicit dependencies.** Two tasks that don't share a file may still have dependencies — barrel files, type re-exports, config registrations, route ordering. Check for these during Step 3 critique.

**Over-decomposition.** If most tasks are Trivial, the plan is over-decomposed. Each task should represent a meaningful unit of work — not a single line change.

**Under-decomposition.** A task that creates 8 files or implements 3 independent behaviors will fail in execution. If a task touches > 5 files, split it.

**Plan-execution format mismatch.** The plan MUST include Complexity, Risk, Depends on, and Verify fields per task — execute-plan-sdlc consumes these for wave building. Missing metadata forces inference, which is slower and less accurate.

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

## See Also

- `./plan-reviewer-prompt.md` — plan review subagent template
- `./plan-format-reference.md` — plan document format specification
- execute-plan-sdlc — skill that executes the plans this skill produces
