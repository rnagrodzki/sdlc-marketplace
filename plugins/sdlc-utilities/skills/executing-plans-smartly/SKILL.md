---
name: executing-plans-smartly
description: "Use when the user wants to execute an implementation plan with adaptive intelligence — classifies tasks by complexity and risk, builds optimized dependency waves, critiques wave structure before dispatch, verifies results after each wave, and recovers from failures without stopping. Self-contained: no external sub-skills required. Triggers on: execute plan, run plan, implement plan, autonomous execution, smart execution, execute this plan."
user-invocable: true
---

# Executing Plans Smartly

Orchestrate plan execution with adaptive task classification, wave-based parallel dispatch, PCIDCI critique loops, and automatic error recovery. No external sub-skills required.

**Announce at start:** "I'm using the executing-plans-smartly skill."

## Step 0: Prerequisites

Ensure session is in `bypassPermissions` mode. Agents must never be blocked by permission prompts mid-execution — they will silently hang. Switch now if not already active.

## Step 1 (LOAD): Load and Validate Plan

**Smart loading:** If the plan content is already in the conversation context (the user discussed, wrote, or pasted it in this session), use it directly — do NOT re-read from file. Only read from file when the plan is not already available in context.

Once the plan content is available, validate it:

| Validation Check | Fail Action |
|---|---|
| Plan file exists and is readable (if loading from file) | Stop with error |
| At least 2 tasks present | Stop — single-task plans don't need orchestration; just do the work directly |
| Each task has a clear deliverable (files to create/modify, behavior to implement) | Flag vague tasks; ask user to clarify before proceeding |
| No circular dependencies detected | Stop with error, show the cycle |
| No tasks reference inaccessible external systems | Warn user, mark as high-risk |

Blocking issues → stop and ask. Warnings only → show them and proceed.

## Step 2 (CLASSIFY): Classify Tasks and Build Waves

For each task, determine three things:

**1. Complexity class** (drives agent dispatch vs inline execution):
- **Trivial** — single-file change, config edit, rename, or < 15 lines. Execute inline in main context; agent overhead exceeds the work.
- **Standard** — multi-file change, feature implementation, test writing. Dispatch to agent.
- **Complex** — architectural change, cross-cutting concern, touches > 5 files. Dispatch to agent with extra context.

**2. Risk level** (drives user gating):
- **Low** — internal implementation, test files, documentation
- **Medium** — public API changes, database changes, security-related code
- **High** — breaking changes, credential handling, infrastructure, irreversible operations

**3. Dependencies** — which tasks must complete before this one (based on file outputs/inputs)

Build waves from the dependency graph. See `./classifying-and-waving-tasks.md` for full heuristics, wave-building algorithm, and adaptive sizing table.

Two tasks modifying the same file must be in different waves.

## Step 3 (CRITIQUE): Critique Wave Structure

Before executing any wave, self-review the entire plan:

- **File conflicts**: Any two tasks in the same wave touching the same file? → Split into sequential waves
- **Dependency integrity**: Does every Wave N+1 task actually depend on something in Wave N? If not, move it earlier
- **Risk clustering**: Multiple high-risk tasks in the same wave? → Spread across waves for easier rollback
- **Context sufficiency**: Is each task self-contained enough to dispatch as an agent? Vague tasks produce vague output
- **Trivial aggregation**: Are trivial tasks that have downstream dependents identified for pre-wave execution?

Note every issue found.

## Step 4 (IMPROVE): Revise and Confirm

Fix each issue from the critique. Then present the final wave structure:

```
Execution Plan
────────────────────────────────────────────
Pre-wave (inline):  N trivial tasks
Wave 1:             N tasks (parallel)
Wave 2:             N tasks (parallel)
Wave 3:             N tasks — contains HIGH RISK tasks (will pause for approval)
────────────────────────────────────────────
Total: N tasks across N waves + pre-wave

Proceed? (yes / edit / cancel)
```

Wait for explicit user confirmation before executing.

## Step 5 (DO): Execute

**Pre-wave:** Execute all trivial tasks directly in main context. Mark each complete in TodoWrite.

**For each wave:**

**5a. High-risk gate** — If the wave contains high-risk tasks, show what will be done and wait:
```
Wave N contains high-risk task(s):
  - Task N: "..." [HIGH RISK: database change]
Approve? (yes / skip / cancel)
```

**5b. Dispatch agents** — One agent per standard/complex task, all in a single message (parallel). Each agent prompt must include:
- Full task text (never a reference to the plan file — paste the entire task body)
- Exact list of files the agent may touch
- Expected deliverable: what changed + how to verify
- For complex tasks: brief summary of relevant changes from prior waves

**5c. Collect and verify** — After all agents return:
- Check each agent's summary for completeness
- Detect file conflicts (two agents touched the same file)
- Run verification commands specified in the plan (tests, build, lint)
- On failure → apply recovery from Step 6

**5d. Progress report** — After each wave:
```
Wave N complete: N/N tasks succeeded
  - Task N: [brief description] ✓
Running verification... [status]

Proceeding to Wave N+1 (N tasks)
```

**5e. Inter-wave critique** — Before next wave:
- Did any task's actual output differ from what upcoming tasks assumed as input?
- Did any task change an interface that downstream tasks depend on?
- If yes, update the next wave's task descriptions to reflect the actual (not planned) outputs.

**Context management** — Between waves, check context usage. If high, compact before dispatching the next wave: summarize completed wave results into a compact status block and discard the verbose agent output. This prevents context exhaustion on plans with 4+ waves.

## Step 6 (RECOVER): Error Recovery

See `./recovering-from-failures.md` for the full playbook. Summary:

| Failure Type | Recovery Action |
|---|---|
| Agent error / incomplete output | Re-dispatch once with failure context added to prompt |
| File conflict between agents | Resolve manually in main context; re-run affected verification |
| Test failure (1-2 tests) | Fix inline in main context |
| Test failure (3+ tests) | Stop; diagnose root cause before proceeding |
| Build failure | Stop immediately; fix before next wave |
| Lint failure | Fix inline; never block a wave on lint-only failures |
| Persistent failure (2+ retries) | Escalate to user with full context |

Maximum retries per task: **2**. After 2 failures, escalate.

## Step 7 (VERIFY): Final Verification

After all waves:
1. Run full test suite
2. Run build
3. Run linter (if configured)
4. Review changed files: `git diff --stat`

Fix any failures directly (no agent dispatch — final issues are typically small integration problems).

## Step 8 (CRITIQUE): Final Output Critique

- Does every task from the original plan have a completed deliverable?
- Any orphaned files (created but not referenced)?
- Did any task drift from its specification?
- Any TODO/FIXME/HACK markers left by agents?

Fix inline if possible; report to user otherwise.

## Step 9 (REPORT): Summary

```
Plan Execution Complete
────────────────────────────────────────────
Tasks completed:  N/N
Waves executed:   N + pre-wave
Retries needed:   N
Verification:     tests ✓  build ✓  lint ✓

Files changed:    N files (N added, N modified, N deleted)
────────────────────────────────────────────
```

Do NOT automatically commit, push, or create branches. The user decides what happens next.

## Quality Gates

| Gate | Pass Criteria |
|---|---|
| Plan validated | No blocking validation issues |
| Wave structure critiqued | All file conflicts and dependency issues resolved |
| User approved | Explicit "yes" received in Step 4 |
| All tasks completed | No tasks skipped without user consent |
| Per-wave verification | Tests/build/lint pass after each wave |
| Final verification | Full suite green |
| No drift | Tasks match their specifications |
| No orphans | All created files are referenced/used |

## When to Ask the User

**ASK when:**
- Plan has ambiguous or contradictory tasks
- High-risk task is about to execute (always gate)
- Agent reports a blocking question requiring domain knowledge
- Same task has failed twice
- Verification failures suggest a systemic issue

**DO NOT ask when:**
- Minor implementation detail (follow codebase conventions)
- Test strategy (follow plan or existing patterns)
- File organization (match existing project patterns)
- Trivial task execution

## DO NOT

- Stop for checkpoints between waves (except high-risk gates)
- Dispatch agents that modify the same files in parallel
- Skip final verification
- Reference the plan file inside an agent prompt — paste the full task text
- Execute more than 2 retries on any single task
- Automatically commit, push, or create branches
- Reference external sub-skills by name — this skill is fully self-contained
- Dispatch agents for trivial tasks — execute them inline

## Gotchas

**Agent context isolation is critical.** Agents have no memory of other agents' work. Every agent prompt must include the full task text, the exact file list, and relevant output from prior waves. A task title without its body produces hallucinated implementations.

**File conflicts have a blind spot.** Two tasks may not list the same file but still conflict — for example, Task A creates a module and Task B modifies the barrel file that re-exports it. The dependency graph catches explicit file dependencies but not implicit ones (barrel files, config registrations, index files). Check for these during inter-wave critique (Step 5e).

**Trivial task aggregation can backfire.** Only aggregate trivial tasks into pre-wave if they have downstream dependents (e.g., adding an env variable Wave 1 reads). Independent documentation updates don't need to run pre-wave.

**`bypassPermissions` must be set before agent dispatch.** Agents inherit the session's permission model. If an agent hits a permission prompt, it silently hangs. There is no way to answer it from inside an agent.

**Plan drift compounds across waves.** After 3+ waves, the codebase may differ significantly from what the plan assumed. The inter-wave critique (Step 5e) exists specifically to catch this. Skipping it on "obvious" waves is where cascading failures begin.

**Context exhaustion during multi-wave execution.** Long-running plans accumulate verbose agent output. Compact between waves when context is high or the conversation will degrade before the final waves execute.

**Smart LOAD prevents redundant file reads.** If the plan was just written or discussed in this session, it's already in context. Re-reading from file is wasted tokens and can introduce stale content if the file hasn't been saved yet.

**Wave sizing heuristics are guidelines.** On resource-constrained systems or when tasks share state (databases, caches), reduce wave size to 2–3 regardless of the heuristic table.

## Learning Capture

After completing execution, append to `.claude/learnings/log.md`:

- Tasks classified trivial that needed agent dispatch (or vice versa)
- Wave structures that caused unexpected file conflicts
- Recovery strategies that worked or failed for specific failure types
- Plans that needed mid-execution restructuring and why
- Projects where default wave sizing was too aggressive or too conservative
- Tasks where missing context caused incorrect agent output

Format:
```
## YYYY-MM-DD — executing-plans-smartly: <brief summary>
<what happened, what was learned>
```

## See Also

- `./classifying-and-waving-tasks.md` — task classification heuristics, wave algorithm, agent prompt template
- `./recovering-from-failures.md` — full error recovery playbook and escalation protocol
