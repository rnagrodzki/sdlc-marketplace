'use strict';

/**
 * state.js
 * Shared execution-state file utilities for sdlc-utilities scripts.
 * Used by both ship-state.js and execute-state.js.
 *
 * Zero npm dependencies — Node.js built-ins only.
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { exec } = require('./git');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Write content to filePath atomically: write to a .tmp sibling, then rename.
 * The tmp file is placed in the same directory so fs.renameSync works across
 * same-filesystem paths without a copy.
 * @param {string} filePath  Absolute destination path
 * @param {string} content   String content to write
 */
function atomicWriteSync(filePath, content) {
  const dir    = path.dirname(filePath);
  const suffix = crypto.randomBytes(4).toString('hex');
  const tmp    = path.join(dir, path.basename(filePath) + '.' + suffix + '.tmp');
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// Worktree helpers
// ---------------------------------------------------------------------------

/**
 * Return the path of the main (primary) worktree by parsing
 * `git worktree list --porcelain`.
 * @returns {string} Absolute path to the main worktree
 */
function resolveMainWorktree() {
  const out = exec('git worktree list --porcelain');
  if (!out) throw new Error('Could not determine main worktree (git worktree list failed)');

  // The first "worktree <path>" entry is always the main worktree.
  const match = out.match(/^worktree (.+)$/m);
  if (!match) throw new Error('Could not parse main worktree path from git worktree list output');

  return match[1].trim();
}

// ---------------------------------------------------------------------------
// Branch slug helpers
// ---------------------------------------------------------------------------

/**
 * Convert a branch name to a filesystem-safe slug.
 * Replaces any character that is not alphanumeric or a hyphen with `-`.
 * E.g. `feat/my-feature` → `feat-my-feature`
 * @param {string} branch
 * @returns {string}
 */
function slugifyBranch(branch) {
  return branch.replace(/[^a-zA-Z0-9-]/g, '-');
}

// ---------------------------------------------------------------------------
// State directory
// ---------------------------------------------------------------------------

/**
 * Return the canonical execution state directory path.
 * Always resolves relative to the main worktree so all worktrees share state.
 * @returns {string} Absolute path: `<mainWorktree>/.sdlc/execution/`
 */
function resolveStateDir() {
  const mainWorktree = resolveMainWorktree();
  return path.join(mainWorktree, '.sdlc', 'execution');
}

// ---------------------------------------------------------------------------
// File lookup
// ---------------------------------------------------------------------------

/**
 * Find the most recent state file matching `<prefix>-<branchSlug>-*.json`.
 * @param {string} prefix      e.g. `"ship"` or `"execute"`
 * @param {string} branchSlug  Slugified branch name (via slugifyBranch)
 * @returns {{ file: string, fullPath: string } | null}
 *   `file` is relative to the state directory parent (`".sdlc/execution/<filename>"`),
 *   `fullPath` is the absolute path.
 */
function findStateFile(prefix, branchSlug) {
  const stateDir = resolveStateDir();
  if (!fs.existsSync(stateDir)) return null;

  let entries;
  try {
    entries = fs.readdirSync(stateDir);
  } catch (_) {
    return null;
  }

  // Match files like: <prefix>-<branchSlug>-<timestamp>.json
  // Use delimiter-aware matching to avoid "main" matching "fix-maintain-feature"
  const slugPattern = `${prefix}-${branchSlug}-`;
  const matching = entries
    .filter(f =>
      f.startsWith(slugPattern) &&
      f.endsWith('.json')
    )
    .map(f => {
      const fullPath = path.join(stateDir, f);
      try {
        const stat = fs.statSync(fullPath);
        return { file: path.join('.sdlc', 'execution', f), fullPath, mtime: stat.mtimeMs };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);

  if (matching.length === 0) return null;

  return { file: matching[0].file, fullPath: matching[0].fullPath };
}

// ---------------------------------------------------------------------------
// Read / write / init / delete
// ---------------------------------------------------------------------------

/**
 * Read and parse the most recent state file for a given prefix + branch.
 * @param {string} prefix
 * @param {string} branchSlug
 * @returns {{ data: object, filePath: string } | null}
 */
function readState(prefix, branchSlug) {
  const found = findStateFile(prefix, branchSlug);
  if (!found) return null;

  try {
    const raw = fs.readFileSync(found.fullPath, 'utf8');
    const data = JSON.parse(raw);
    return { data, filePath: found.fullPath };
  } catch (_) {
    process.stderr.write(`[state] Warning: corrupt or unreadable state file: ${found.fullPath}\n`);
    return null;
  }
}

/**
 * Write JSON state to an existing file path (overwrites).
 * @param {string} filePath  Absolute path to the state file
 * @param {object} data
 */
function writeState(filePath, data) {
  atomicWriteSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Create a new state file in the state directory.
 * File name format: `<prefix>-<branchSlug>-<YYYYMMDDTHHmmssZ>.json`
 * @param {string} prefix   e.g. `"ship"` or `"execute"`
 * @param {string} branch   Raw branch name (will be slugified internally)
 * @param {object} data     Initial state data
 * @returns {string}  Absolute path to the created file
 */
function initState(prefix, branch, data) {
  const stateDir = resolveStateDir();
  fs.mkdirSync(stateDir, { recursive: true });

  const branchSlug = slugifyBranch(branch);
  const timestamp  = new Date()
    .toISOString()
    .replace(/[-:]/g, '')   // remove dashes and colons
    .replace(/\.\d+Z$/, 'Z'); // drop milliseconds, keep Z

  const fileName = `${prefix}-${branchSlug}-${timestamp}.json`;
  const filePath = path.join(stateDir, fileName);

  atomicWriteSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

/**
 * Delete a state file. Ignores errors if the file does not exist.
 * @param {string} filePath  Absolute path to the state file
 */
function deleteState(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (_) {
    // Intentionally ignored — file may have already been removed.
  }
}

// ---------------------------------------------------------------------------
// Branch resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the current git branch name. Uses the provided argument if given,
 * otherwise detects via `git branch --show-current`.
 * @param {string|undefined} argBranch  Explicit branch name from CLI args
 * @returns {string}
 */
function resolveBranch(argBranch) {
  if (argBranch) return argBranch;
  const branch = exec('git branch --show-current');
  if (!branch) {
    throw new Error('Could not determine current branch');
  }
  return branch;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  resolveMainWorktree,
  slugifyBranch,
  resolveStateDir,
  findStateFile,
  readState,
  writeState,
  initState,
  deleteState,
  resolveBranch,
};
