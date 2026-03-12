# Classifying Tasks and Building Waves

Reference for the `executing-plans-smartly` skill — Step 2 (CLASSIFY).

## Complexity Classification Heuristics

| Signal | Complexity |
|---|---|
| Task mentions "rename", "update config", "change value", "add import" | Trivial |
| Task body is < 3 sentences with a single clear action | Trivial |
| Task creates or modifies 1 file with a well-defined output | Trivial |
| Task creates or modifies 2–4 files with clear outputs | Standard |
| Task implements a feature, writes tests, adds a component | Standard |
| Task involves > 5 files or cross-cutting concerns | Complex |
| Task requires understanding multiple existing modules to implement correctly | Complex |
| Task involves architectural patterns or systemic changes | Complex |

When signals are mixed, round up (prefer higher complexity class).

## Risk Classification Heuristics

| Signal | Risk Level |
|---|---|
| Task touches only test files | Low |
| Task touches only documentation or comments | Low |
| Task creates new internal-only modules with no public surface | Low |
| Task modifies a public API or function signatures called by other modules | Medium |
| Task changes database schemas, migrations, or data models | Medium |
| Task modifies authentication, authorization, or session handling | High |
| Task changes infrastructure (Docker, k8s, CI/CD, deploy scripts) | High |
| Task involves credential management, secrets, or encryption | High |
| Task deletes files or removes existing functionality | High |
| Task touches shared state accessible by multiple services | High |

When signals are mixed, round up (prefer higher risk level).

## Wave-Building Algorithm

1. **Build a dependency graph (DAG)** where an edge A → B means "task B depends on outputs from task A"
   - Identify explicit file dependencies: task B reads a file that task A creates
   - Identify implicit dependencies: task B modifies a module that task A adds to an index/barrel file

2. **Topological sort** the DAG to establish valid execution order

3. **Assign wave numbers:**
   - Wave 1: all tasks with no dependencies
   - Wave N+1: all tasks whose dependencies are all in waves ≤ N
   - Continue until all tasks are assigned

4. **Apply same-file constraint:** If two tasks in Wave N both modify the same file, move the later one (by plan order) to Wave N+1

5. **Apply adaptive wave size cap** (see table below). If a wave exceeds the cap, split the excess into Wave N+0.5 (insert a new wave between N and N+1)

6. **Apply risk spreading:** If a wave contains > 1 high-risk task, move the excess to the next wave

7. **Identify pre-wave trivials:** Trivial tasks that have downstream dependents in Wave 1 should run in the pre-wave (inline, before any agent dispatch)

## Adaptive Wave Size Cap

Complex tasks count as 2 toward the cap (they consume more context and are more likely to conflict).

| Total remaining tasks | Max agents per wave |
|---|---|
| 1–3 | No cap (dispatch all) |
| 4–8 | 4 |
| 9–15 | 5 |
| 16+ | 6 |

On resource-constrained systems or when tasks share mutable state (databases, caches, singletons), reduce to 2–3 regardless of the table.

## Agent Prompt Template

Use this template for every agent dispatch in Step 5b. Fill all placeholders. Never abbreviate the task text or reference the plan file.

```
You are implementing a single task from a larger plan. Focus only on your assigned task.

## Your Task
{PASTE FULL TASK TEXT HERE — include title, description, acceptance criteria, and any notes from the plan. Never summarize or paraphrase.}

## Files You May Touch
{List every file the agent is allowed to create or modify. The agent must not modify files outside this list. If you are unsure of a file name, give the directory and a description.}
- path/to/file1.ts
- path/to/file2.ts
- (new file) path/to/new-file.ts

## Context From Prior Waves
{Summary of relevant changes already completed. Omit if this is Wave 1. Be specific: "Task 3 created UserService at src/services/user.service.ts with methods getUser(id) and createUser(data)." Not: "Task 3 was completed."}

## Expected Output
When done, report:
1. Files created or modified (list each with a one-line summary of what changed)
2. Verification performed (tests run, build checked, manual verification done)
3. Any decisions made that the orchestrator should know about
4. Any issues encountered

## Hard Constraints
- Do NOT read the plan file — all task information is provided above
- Do NOT modify files outside the "Files You May Touch" list
- If you encounter a genuine blocker, report it clearly rather than guessing or hallucinating an implementation
- Do not add features, refactor, or clean up code beyond what the task requires
```

## Common Dependency Patterns

These implicit dependencies are easy to miss:

| Scenario | Dependency |
|---|---|
| Task A creates a new module; Task B adds it to an index/barrel file | B depends on A |
| Task A defines a TypeScript type; Task B uses that type | B depends on A |
| Task A creates a database table; Task B seeds or queries it | B depends on A |
| Task A adds a config key; Task B reads that config key | B depends on A |
| Task A adds a route handler; Task B adds middleware that wraps all routes | Depends on order — check the framework's middleware registration semantics |
| Task A writes a test fixture; Task B writes tests that use that fixture | B depends on A |
