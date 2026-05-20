# Plan Reviewer Prompt Template

Use this template in plan-sdlc Step 5 (CRITIQUE) when dispatching the plan review subagent.

**Purpose:** Verify the plan is complete, accurate, and ready for execution by execute-plan-sdlc.

**Model selection:** Use a different model than the one that wrote the plan for plans with 5+ tasks (cross-model review catches blind spots). For plans under 5 tasks, same model is acceptable.

## How to Fill This Template

- `{PLAN_FILE_PATH}` — path to the written plan document
- `{REQUIREMENTS_CHECKLIST}` — numbered list from Step 1 (CONSUME)
- `{SOURCE_REQUIREMENTS}` — file path or inline text of the original spec/requirements (if available)
- `{BRIEF_FILE}` — absolute path to `discovery-brief.md` produced by `plan-explore-orchestrator`, or `"none — orchestrator skipped"` when the lightweight path or fallback ran
```
Task tool (general-purpose):
  description: "Plan review for <feature name>"
  model: <reviewer model — different from plan author model when 5+ tasks>
  mode: bypassPermissions
  prompt: |
    You are reviewing a plan document for completeness, accuracy, and executability.
    The plan will be executed by an automated plan orchestrator (execute-plan-sdlc).

    **Plan to review:** {PLAN_FILE_PATH}
    **Source requirements:** {SOURCE_REQUIREMENTS — file path or inline text, or "not provided"}
    **Requirements checklist:**
    {REQUIREMENTS_CHECKLIST}
    **Plan guardrails:** {GUARDRAILS — one per line, or "none configured"}
    **Discovery brief:** {BRIEF_FILE — absolute path to discovery-brief.md, or "none — orchestrator skipped"}

    ## What to Check

    Read the plan file. For each check, verify by reading the plan — do not assume.

    | Category | What to Look For |
    |---|---|
    | Requirements coverage | Every requirement in the checklist has at least one task; no orphan tasks without a requirement |
    | Task descriptions | Each task is specific enough to implement without guessing — exact file paths, clear behavior, edge cases |
    | Metadata completeness | Every task has Complexity, Risk, Depends on, and Verify fields |
    | Dependency accuracy | Dependencies are correct; no circular deps; implicit deps (barrel files, type exports) are captured |
    | File paths | All paths are relative to project root (no absolute paths) |
    | Verification strategy | Each task has an appropriate verification method (not TDD forced on config/docs tasks) |
    | Scope discipline | No tasks beyond stated requirements; no gold-plating |
    | Buildability | An agent with no codebase context could execute each task using only its description |
    | Decision documentation | Key Decisions section present for plans with 5+ tasks; each rationale references codebase evidence, not preference; no obvious decisions included |
    | Plan completeness | All header fields (Goal, Architecture, Source, Verification) are filled in — no placeholders like "[TBD]"; no leftover working sections (e.g., `## Requirements` scaffolding); task numbering is sequential with no gaps |
    | Guardrail compliance | Each guardrail from the guardrails list above is satisfied by the plan. Error-severity violations are blocking. Warning-severity violations are advisory. If no guardrails configured, skip this check. |
    | Exploration provenance | When `{BRIEF_FILE}` is provided (not "none"): every Standard/Complex task in the plan cites ≥1 `F-<DIM>-<n>` finding ID OR is marked "out-of-scope addition" with rationale. Trivial tasks exempt. Flag uncited Standard/Complex tasks as a blocking issue (G15). |
    | Best-practice traceability | When the brief contains a `## Best-Practice Synthesis` section: Key Decisions explicitly ADOPTS / REJECTS-with-rationale / marks NOT-APPLICABLE each web finding by `F-<DIM>-<n>` ID. Silent omission of a web finding is a blocking issue. |

    ## Calibration

    Only flag issues that would cause real problems during execution:
    - A task so vague an agent would hallucinate → flag it
    - A missing dependency that would cause a wave conflict → flag it
    - A wrong file path → flag it
    - A stylistic preference about task ordering → do NOT flag

    Approve unless there are genuine execution blockers.

    ## Output

    **Status:** Approved | Issues Found

    **Issues (if any — list only execution blockers):**
    - Task N: [specific issue] — [why this would cause execution failure]

    **Recommendations (advisory, do not block approval):**
    - [optional suggestions that improve the plan but are not blocking]
```

## Handling Reviewer Output

**Approved:** Proceed to Step 7 (Handoff).

**Issues Found:**
1. Fix each blocking issue in the plan document
2. Re-dispatch the reviewer (same model selection)
3. Maximum 3 reviewer iterations — if still unresolved, surface to user
