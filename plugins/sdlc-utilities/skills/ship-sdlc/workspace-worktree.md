# Ship Pipeline — Worktree-Mode Operations

On-demand companion for `ship-sdlc/SKILL.md` (implements R-progressive-disclosure). Read this file ONLY when `WORKSPACE_MODE` (resolved from `flags.workspace`) is `worktree`. Branch-mode runs (`flags.workspace === 'branch'`, the default) never read this file — their worktree-creation step does nothing and there is no worktree to clean up.

> **Branch-mode-active gates stay in SKILL.md, not here.** The post-version ancestry HARD GATE (fires when `NEW_TAG` is set — branch mode, since version auto-skips in worktree per R12) and the cwd-assertion diagnostic (`requireMainWorktreeCwd` true only in branch mode) remain inline in SKILL.md. They run on the default branch-mode path and must not be gated behind this worktree-only Read.

## Worktree create — Step 3b (pre-execute workspace isolation)

This is step 3b of the five-step pre-execute workspace-isolation skeleton. Steps 1 (branch-name derivation), 2 (state migration), and 3a (`git checkout -b` for branch mode) run inline in SKILL.md. When `WORKSPACE_MODE` is `worktree`, run the following bash **in the main shell** (not a subshell, not an Agent dispatch) so the final `cd "$WORKTREE_PATH"` propagates to every subsequent Bash invocation and Agent-tool dispatch:

```bash
# Step 3b: --workspace worktree — create worktree+branch, cd in main shell.
if [ "$WORKSPACE_MODE" = "worktree" ]; then
  WORKTREE_CREATE_SCRIPT=$(find ~/.claude/plugins -name "worktree-create.js" -path "*/sdlc*/scripts/util/worktree-create.js" 2>/dev/null | sort -V | tail -1)
  [ -z "$WORKTREE_CREATE_SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/util/worktree-create.js" ] && WORKTREE_CREATE_SCRIPT="plugins/sdlc-utilities/scripts/util/worktree-create.js"
  [ -z "$WORKTREE_CREATE_SCRIPT" ] && { echo "ERROR: Could not locate scripts/util/worktree-create.js. Is the sdlc plugin installed?" >&2; exit 2; }
  result=$(node "$WORKTREE_CREATE_SCRIPT" --name "$EXECUTE_BRANCH")
  WORKTREE_PATH=$(echo "$result" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).path)")
  # worktree-create.js may collision-suffix; use the resolved branch name.
  EXECUTE_BRANCH=$(echo "$result" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).branch)")
  # Step 4: cd in main shell — Bash cwd persists across subsequent dispatches.
  cd "$WORKTREE_PATH"
fi
```

**Cwd propagation contract:** The single `cd "$WORKTREE_PATH"` above sets the main-context shell cwd. Bash cwd persists across subsequent Bash invocations in the same agent context. Agent-tool dispatches inherit the parent's cwd — so commit-sdlc, review-sdlc, pr-sdlc, verify-pipeline-sdlc, version-sdlc, received-review-sdlc, learnings-commit, verify-openspec, and archive-openspec all start in the new worktree automatically. No per-prompt `cd` prepend is needed.

After running this block, return to SKILL.md and continue with Step 5 (pass `--branch "$EXECUTE_BRANCH"` to execute-plan-sdlc).

## Worktree cleanup (Step 6 REPORT)

Read this section during Step 6 (REPORT) only when running in worktree mode. Detect if running in a linked worktree:
```bash
main_wt=$(git worktree list --porcelain | head -1 | sed 's/worktree //')
current=$(git rev-parse --show-toplevel)
```
If `$main_wt != $current`, a worktree is active.

**Auto mode:** keep (default). Print path and action:
```
Worktree kept: <current path>
  Branch: <branch name>
  To remove later: cd <main_wt> && git worktree remove <current>
```

**Interactive mode:** Use AskUserQuestion — keep or remove.
If remove: `cd "$main_wt" && git worktree remove "$current"`

If `git worktree remove` fails, warn but don't fail the pipeline.
