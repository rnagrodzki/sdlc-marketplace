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
const { exec }         = require('./git');
const { readSection }  = require('./config');

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
// Garbage collection
// ---------------------------------------------------------------------------

/**
 * Parse a state-file basename into its components.
 * Format: <prefix>-<branchSlug>-<timestamp>.json
 *
 * The slug may itself contain dashes (e.g. `fix-220-foo`) and the timestamp
 * is always 16 chars of `YYYYMMDDTHHmmssZ`. We anchor on the trailing
 * `-<timestamp>.json` so the slug captures everything between the prefix and
 * the timestamp regardless of internal dashes.
 *
 * @param {string} name  basename (no directory)
 * @returns {{prefix: string, slug: string, timestamp: string} | null}
 */
function parseStateFilename(name) {
  // Trailing `-<16 chars>.json` where timestamp pattern is ISO-compact:
  // 8 digits (date) + 'T' + 6 digits (time) + 'Z'.
  const m = name.match(/^(ship|execute)-(.+)-(\d{8}T\d{6}Z)\.json$/);
  if (!m) return null;
  return { prefix: m[1], slug: m[2], timestamp: m[3] };
}

/**
 * Garbage-collect stale state files in `<mainWorktree>/.sdlc/execution/`.
 *
 * Pure function: takes an explicit `knownBranches` list and `now` timestamp
 * (no shell-out, no clock read) so it is deterministic and unit-testable.
 *
 * Pruning rule:
 *   - File mtime within TTL → KEEP, reason "ttl-fresh".
 *   - File branch (slug-matched against knownBranches) is currently live → KEEP, reason "branch-exists".
 *   - File is older than TTL AND its branch is gone → DELETE, reason "stale+branch-gone".
 *   - Filename does not match `<prefix>-<slug>-<timestamp>.json` → KEEP, reason "unparseable-name" (warn-and-skip).
 *
 * Slug matching: branches in `knownBranches` may contain `/` and other chars
 * that get collapsed by `slugifyBranch`. Match by slug equality after
 * slugifying every known branch, NOT by reverse-mapping the slug.
 *
 * @param {object} opts
 * @param {string|null} [opts.prefix]    "ship" | "execute" | null (both)
 * @param {number}      [opts.ttlDays=7] retention window in days
 * @param {string[]}    opts.knownBranches  current `git branch --list` output
 * @param {number}      [opts.now]       current time (ms); defaults to Date.now()
 * @returns {{ deleted: Array<{file,prefix,branch,mtime,reason}>, kept: Array<{file,prefix,branch,reason}> }}
 */
function gcStateFiles({ prefix = null, ttlDays = 7, knownBranches = [], now } = {}) {
  const stateDir = resolveStateDir();
  const result = { deleted: [], kept: [] };

  if (!fs.existsSync(stateDir)) return result;

  let entries;
  try {
    entries = fs.readdirSync(stateDir);
  } catch (_) {
    return result;
  }

  const nowMs = typeof now === 'number' ? now : Date.now();
  const ttlMs = ttlDays * 86400000;
  const liveSlugs = new Set(knownBranches.map(slugifyBranch));

  for (const name of entries) {
    if (!name.endsWith('.json')) continue;

    const parsed = parseStateFilename(name);
    if (!parsed) {
      result.kept.push({ file: name, prefix: null, branch: null, reason: 'unparseable-name' });
      continue;
    }

    if (prefix && parsed.prefix !== prefix) continue;

    const fullPath = path.join(stateDir, name);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (_) {
      continue;
    }

    const ageMs = nowMs - stat.mtimeMs;
    const branchExists = liveSlugs.has(parsed.slug);

    if (ageMs < ttlMs) {
      result.kept.push({ file: name, prefix: parsed.prefix, branch: parsed.slug, reason: 'ttl-fresh' });
      continue;
    }

    if (branchExists) {
      result.kept.push({ file: name, prefix: parsed.prefix, branch: parsed.slug, reason: 'branch-exists' });
      continue;
    }

    try {
      fs.unlinkSync(fullPath);
      result.deleted.push({
        file: name,
        prefix: parsed.prefix,
        branch: parsed.slug,
        mtime: stat.mtimeMs,
        reason: 'stale+branch-gone',
      });
    } catch (_) {
      // Best-effort: another process may have deleted it; report as kept.
      result.kept.push({ file: name, prefix: parsed.prefix, branch: parsed.slug, reason: 'unlink-failed' });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Branch-slug migration
// ---------------------------------------------------------------------------

/**
 * Rename a state file to use a new branch slug, preserving its timestamp,
 * and update `data.branch` to the new branch name.
 *
 * Atomicity: we read the JSON, atomic-write to the new path (via temp
 * file + rename), then unlink the old path. This is the same pattern used
 * for `writeState`/`initState` — a brief window where both files exist on
 * disk after the new write but before the old delete is acceptable; readers
 * (`findStateFile`) sort by mtime descending and would pick the newest.
 *
 * @param {object} opts
 * @param {string} opts.prefix     "ship" | "execute"
 * @param {string} opts.fromSlug   Current slug (already slugified)
 * @param {string} opts.toBranch   New branch name (raw — slugified internally)
 * @returns {{migrated: true, from: string, to: string, filePath: string}
 *         | {migrated: false, reason: string}}
 */
function migrateBranchSlug({ prefix, fromSlug, toBranch }) {
  if (!prefix || !fromSlug || !toBranch) {
    return { migrated: false, reason: 'missing-args' };
  }

  const found = findStateFile(prefix, fromSlug);
  if (!found) {
    return { migrated: false, reason: 'no-state-file' };
  }

  const stateDir   = resolveStateDir();
  const oldName    = path.basename(found.fullPath);
  const parsed     = parseStateFilename(oldName);
  if (!parsed) {
    return { migrated: false, reason: 'unparseable-name' };
  }

  const newSlug = slugifyBranch(toBranch);
  if (newSlug === parsed.slug) {
    return { migrated: false, reason: 'same-slug' };
  }

  const newName = `${prefix}-${newSlug}-${parsed.timestamp}.json`;
  const newPath = path.join(stateDir, newName);

  let raw;
  try {
    raw = fs.readFileSync(found.fullPath, 'utf8');
  } catch (e) {
    return { migrated: false, reason: `read-failed: ${e.message}` };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { migrated: false, reason: `parse-failed: ${e.message}` };
  }

  data.branch = toBranch;

  try {
    atomicWriteSync(newPath, JSON.stringify(data, null, 2));
  } catch (e) {
    return { migrated: false, reason: `write-failed: ${e.message}` };
  }

  // Unlink the old file. If the new and old paths somehow collide
  // (shouldn't, since slugs differ by check above), don't delete what we just wrote.
  if (newPath !== found.fullPath) {
    try {
      fs.unlinkSync(found.fullPath);
    } catch (_) {
      // Non-fatal: the new file is in place; orphan will be GC'd.
    }
  }

  return {
    migrated: true,
    from: oldName,
    to: newName,
    filePath: newPath,
  };
}

// ---------------------------------------------------------------------------
// GC helpers shared by state/ship.js and state/execute.js
// ---------------------------------------------------------------------------

/**
 * Return list of local branch names via `git branch --list`.
 * @returns {string[]}
 */
function listBranches() {
  try {
    const out = exec("git branch --list --format='%(refname:short)'");
    return out.split('\n').map(s => s.trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

/**
 * Read `state.gc.ttlDays` from `.sdlc/config.json`, falling back to 7.
 * @returns {number}
 */
function readTtlDaysFromConfig() {
  try {
    const stateCfg = readSection(process.cwd(), 'state');
    const v = stateCfg && stateCfg.gc && stateCfg.gc.ttlDays;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  } catch (_) {
    // fall through to default
  }
  return 7;
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
  parseStateFilename,
  gcStateFiles,
  migrateBranchSlug,
  listBranches,
  readTtlDaysFromConfig,
};
