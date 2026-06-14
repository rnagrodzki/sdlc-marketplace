'use strict';

/**
 * worktree.js
 * Main-worktree detection helpers — shared by config.js and state.js.
 *
 * Zero npm dependencies — Node.js built-ins only.
 * Must NOT import ./config or ./state (prevents circular dependency).
 */

const path = require('path');
const { execFileSync } = require('child_process');

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the absolute path of the main (primary) worktree by parsing
 * `git worktree list --porcelain`.
 *
 * @param {string} [cwd=process.cwd()] Working directory for the git command.
 * @returns {string} Absolute path to the main worktree.
 * @throws {Error} When git fails or the output cannot be parsed.
 */
function resolveMainWorktree(cwd) {
  const workingDir = cwd || process.cwd();
  let out;
  try {
    out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: workingDir,
      encoding: 'utf8',
    });
  } catch (err) {
    throw new Error(
      `Could not determine main worktree (git worktree list failed in ${workingDir}): ${err.message}`
    );
  }

  if (!out) {
    throw new Error(`Could not determine main worktree (git worktree list returned empty in ${workingDir})`);
  }

  // The first "worktree <path>" entry is always the main worktree.
  const match = out.match(/^worktree (.+)$/m);
  if (!match) {
    throw new Error(`Could not parse main worktree path from git worktree list output in ${workingDir}`);
  }

  return match[1].trim();
}

/**
 * Same as resolveMainWorktree, but never throws.
 *
 * On failure: writes a warning to stderr ONLY when SDLC_DEBUG is set, then
 * returns `cwd` as the fallback. Silent by default to avoid polluting
 * prepare-script output in non-git fixtures and first-time setup runs.
 *
 * @param {string} [cwd=process.cwd()] Working directory for the git command.
 * @returns {string} Main worktree path, or `cwd` on failure.
 */
function resolveMainWorktreeSafe(cwd) {
  const workingDir = cwd || process.cwd();
  try {
    return resolveMainWorktree(workingDir);
  } catch (_) {
    if (process.env.SDLC_DEBUG) {
      process.stderr.write(
        `[sdlc] could not resolve main worktree from cwd ${workingDir}; using cwd as fallback\n`
      );
    }
    return workingDir;
  }
}

/**
 * Return the absolute path of the ACTIVE worktree's top level — the root of the
 * working tree for the current checkout, even when invoked from a subdirectory.
 *
 * Unlike resolveMainWorktreeSafe (which always walks back to the primary
 * worktree for .sdlc/ config/state anchoring per issue #351), this resolves the
 * tree on the active branch — correct for content scans (openspec/changes/,
 * openspec/specs/) that live on the active branch in a linked worktree (#457).
 *
 * When not in a linked worktree, `git rev-parse --show-toplevel` returns the
 * main worktree path — identical to resolveSdlcRoot() — so callers see
 * `contentRoot === projectRoot` in the single-worktree case (no behavior change).
 *
 * Never throws. On failure: writes a warning to stderr ONLY when SDLC_DEBUG is
 * set, then returns `cwd` as the fallback. Silent by default to avoid polluting
 * prepare-script output in non-git fixtures and first-time setup runs.
 *
 * @param {string} [cwd=process.cwd()] Working directory for the git command.
 * @returns {string} Active worktree top-level path, or `cwd` on failure.
 */
function resolveActiveWorktreeSafe(cwd) {
  const workingDir = cwd || process.cwd();
  try {
    const out = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: workingDir,
      encoding: 'utf8',
    });
    return out.trim();
  } catch (_) {
    if (process.env.SDLC_DEBUG) {
      process.stderr.write(
        `[sdlc] could not resolve active worktree from cwd ${workingDir}; using cwd as fallback\n`
      );
    }
    return workingDir;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  resolveMainWorktree,
  resolveMainWorktreeSafe,
  resolveActiveWorktreeSafe,
};
