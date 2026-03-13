# Recovering From Failures

Reference for the `executing-plans-smartly` skill — Step 6 (RECOVER).

Maximum retries per task: **2**. After 2 failures on the same task, escalate to the user.

## Failure Classification

| Failure Category | How to Detect | Severity |
|---|---|---|
| Agent timeout / no return | Agent does not return or hangs indefinitely | Medium |
| Agent error output | Agent returns error message instead of deliverable | Medium |
| Incomplete implementation | Agent output doesn't match expected deliverable | Low–Medium |
| Unauthorized file modification | `git diff` shows changes outside the agent's allowed file list | High |
| Test failure (1–2 tests) | Test suite fails on a small number of tests | Medium |
| Test failure (3+ tests) | Test suite fails on many tests | High |
| Build failure | Build command returns non-zero exit code | High |
| Lint failure | Linter reports new violations | Low |
| File conflict between agents | Two agents in the same wave modified the same file | High |

## Recovery Strategies

### Agent timeout / error output
Re-dispatch with the same prompt plus this addition at the top:
```
RETRY: Previous attempt failed with the following error:
{error message or description of what happened}

Please complete the task fully.
```
Max 1 retry. If it fails again, escalate.

### Incomplete implementation
Re-dispatch with specific feedback:
```
RETRY: Your previous output was incomplete. Missing:
{specific deliverable that was not produced}

What was produced:
{summary of what the agent did return}

Complete only the missing parts. Do not redo what was already done.
```
Max 1 retry.

### Unauthorized file modification
Do NOT retry the agent without fixing the prompt first.
1. Identify which unauthorized files were modified
2. Revert them: `git checkout -- <file>`
3. Re-examine the task — if it genuinely needs those files, update the allowed file list
4. Re-dispatch with the corrected file list and a warning:
   ```
   CONSTRAINT: You previously modified files outside your allowed list. Stay strictly within:
   {updated file list}
   ```

### Test failure (1–2 tests)
Fix inline in the main context. These are typically integration issues from combining wave outputs (wrong import path, missing export, interface mismatch). Don't re-dispatch an agent for a 2-line fix.

### Test failure (3+ tests)
Stop. Diagnose before proceeding.
1. Read the failure output carefully
2. Determine whether failures share a root cause (same module, same interface change) or are independent
3. **Same root cause**: fix in main context, then continue
4. **Independent failures**: stop and escalate — there may be a systemic issue with the wave output

### Build failure
Stop immediately. Build failures mean subsequent waves will produce invalid output based on a broken foundation.
1. Read the build error
2. Diagnose: missing import, type error from interface change, circular dependency, removed export
3. Fix in main context
4. Rebuild to confirm green before proceeding to the next wave

### Lint failure
Fix inline. Never block a wave progression on lint-only failures unless the project is configured to treat lint as a hard error (e.g., CI fails on lint). In that case, treat as a build failure.

### File conflict between agents
1. Identify which agents touched the same file and what each changed
2. Read the current state of the conflicted file
3. Manually merge the correct final state in the main context
4. Run the affected tests/build to verify the merge is correct
5. Do not re-dispatch agents for the conflict — merge it yourself

## Escalation Protocol

When escalating to the user after 2 failed retries or a systemic failure, provide:

```
⚠️ Escalation Required

Task: {task name and wave number}
Failure: {clear description of what went wrong}
Attempts: {N retries attempted}

Recovery tried:
{describe each recovery attempt and its outcome}

Specific question / decision needed:
{the exact clarification or decision required to proceed}

Other waves affected:
{yes — waves N, N+1 are blocked} or {no — other waves can proceed independently}
```

Wait for the user's response before proceeding with any affected waves.

**Error-to-GitHub issue proposal**:

After escalating, also offer to track the failure as a GitHub issue. Locate the procedure:
Glob for `**/error-report-sdlc/REFERENCE.md` under `~/.claude/plugins`, then retry with cwd.
If found, follow the procedure with:

- **Skill**: executing-plans-smartly
- **Step**: Step 6 — RECOVER (Escalation)
- **Operation**: Task execution (task name and wave from escalation output above)
- **Error**: Persistent failure after 2 retries (details from escalation output above)
- **Suggested investigation**: Review the task description for ambiguity; check whether the task's allowed file list is complete; inspect agent error output for root cause

If not found, skip — the capability is not installed.

## Rollback Strategy

When a wave produces fundamentally broken output that cannot be recovered through targeted fixes:

1. Stash all changes from the failed wave:
   ```bash
   git stash push -m "failed-wave-N-$(date +%Y%m%d-%H%M%S)"
   ```

2. Confirm the stash captured everything:
   ```bash
   git status
   git stash list
   ```

3. Re-examine the tasks in the failed wave. Common root causes:
   - Task descriptions were too vague (agents interpreted them differently)
   - Dependencies on prior wave outputs were incorrect
   - Tasks had hidden conflicts not caught by the file-conflict check

4. Present the user with options:
   - **Retry the wave** with revised task descriptions
   - **Skip the wave** and mark tasks as unimplemented (user completes manually)
   - **Abort execution** entirely (stash remains, user takes over)

5. If retrying: pop the stash only after the new wave succeeds:
   ```bash
   git stash drop stash@{0}
   ```
   If aborting: leave the stash for the user to inspect.
