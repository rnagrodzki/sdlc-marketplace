'use strict';

/**
 * ensure-worktree-gitignore.js — SessionStart hook.
 *
 * When workspace.worktree.layout === 'inside' AND ensureGitignore !== false,
 * adds `.claude/worktrees/` to the root .gitignore managed block.
 *
 * Always exits 0 — must never fail session start.
 *
 * Self-gating: no-ops when:
 *   - workspace.worktree config is absent
 *   - layout is not 'inside'
 *   - ensureGitignore is explicitly false
 *   - git worktree resolution fails (non-git directory)
 *
 * Issue #351.
 */

const path = require('path');

// ---------------------------------------------------------------------------
// Resolve plugin root relative to this hook file.
// ---------------------------------------------------------------------------

const PLUGIN_ROOT  = path.resolve(__dirname, '..');
const LIB          = path.join(PLUGIN_ROOT, 'scripts', 'lib');

// ---------------------------------------------------------------------------
// Safe import helpers (hook must not crash on missing modules)
// ---------------------------------------------------------------------------

let resolveMainWorktreeSafe, readSection, resolveSdlcRoot, ensureRootGitignore;
try {
  ({ resolveMainWorktreeSafe } = require(path.join(LIB, 'worktree')));
  ({ readSection, resolveSdlcRoot, ensureRootGitignore } = require(path.join(LIB, 'config')));
} catch (err) {
  // Modules not available (e.g., fresh install, npm install not run).
  // Exit silently — never block session start.
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(function main() {
  let mainWorktree;
  try {
    // Use the safe variant — non-git directories return cwd without throwing.
    mainWorktree = resolveMainWorktreeSafe();
    // Verify it's actually a git repo by checking for .git
    const fs = require('fs');
    if (!fs.existsSync(path.join(mainWorktree, '.git'))) {
      // Not a git repo — silent no-op
      process.exit(0);
    }
  } catch (_) {
    process.exit(0);
  }

  // Read workspace.worktree config
  let workspaceCfg;
  try {
    const projectRoot = resolveSdlcRoot({ cwd: mainWorktree });
    const workspace = readSection(projectRoot, 'workspace');
    workspaceCfg = workspace && workspace.worktree ? workspace.worktree : null;
  } catch (_) {
    process.exit(0);
  }

  // Self-gate: only act for inside layout with ensureGitignore enabled
  if (!workspaceCfg) process.exit(0);
  if (workspaceCfg.layout !== 'inside') process.exit(0);
  if (workspaceCfg.ensureGitignore === false) process.exit(0);

  // Add .claude/worktrees/ to root .gitignore managed block
  try {
    ensureRootGitignore(mainWorktree, ['.claude/worktrees/']);
  } catch (err) {
    // Gitignore write failed — log to stderr but never block session start.
    // The hook must always exit 0 (see file header).
    process.stderr.write(
      `ensure-worktree-gitignore: failed to update root .gitignore at ${mainWorktree}: ${err.message}\n`
    );
  }

  process.exit(0);
}());
