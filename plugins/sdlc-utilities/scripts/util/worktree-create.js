#!/usr/bin/env node
/**
 * worktree-create.js
 * Collision-safe git worktree creation for sdlc-utilities.
 *
 * Usage:
 *   node worktree-create.js --name <branch-name>
 *
 * Outputs JSON to stdout:
 *   Success: { "branch": "<final-name>", "path": ".claude/worktrees/<slugified-name>" }
 *   Failure: { "error": "<message>" }
 *
 * Exit codes:
 *   0 = success
 *   1 = failure (JSON error object on stdout)
 *
 * Zero npm dependencies — Node.js built-ins only.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const LIB = path.join(__dirname, '..', 'lib');

const { exec } = require(path.join(LIB, 'git'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a branch name to a filesystem-safe slug.
 * Replaces any character that is not alphanumeric or a hyphen with `-`.
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  return name.replace(/[^a-zA-Z0-9-]/g, '-');
}

/**
 * Validate that a branch name contains only safe characters for git refs.
 * Rejects shell metacharacters to prevent command injection via exec().
 * Allowed: alphanumeric, forward slash, hyphen, underscore, dot.
 * @param {string} name
 * @returns {boolean}
 */
function isValidBranchName(name) {
  return /^[a-zA-Z0-9/_.\-]+$/.test(name) && !/\.\./.test(name) && !name.endsWith('.lock');
}

/**
 * Check whether a local git branch already exists.
 * @param {string} branchName
 * @returns {boolean}
 */
function branchExists(branchName) {
  const result = exec(`git show-ref --verify --quiet refs/heads/${branchName}`);
  // exec returns null on non-zero exit, non-null (even empty string) on success
  return result !== null;
}

/**
 * Check whether a worktree directory already exists on disk.
 * @param {string} worktreePath  Path relative to cwd
 * @returns {boolean}
 */
function worktreePathExists(worktreePath) {
  return fs.existsSync(worktreePath);
}

/**
 * Generate a short unique suffix from the last 5 digits of Date.now().
 * @returns {string}
 */
function shortSuffix() {
  return String(Date.now()).slice(-5);
}

/**
 * Given a desired branch name, find a variant that does not collide with
 * any existing branch name or worktree path.
 * @param {string} desiredName
 * @returns {{ finalName: string, sluggedPath: string }}
 */
function resolveUniqueName(desiredName) {
  let candidate = desiredName;

  // Retry up to 10 times (astronomically unlikely to need more than 1-2)
  for (let i = 0; i < 10; i++) {
    const slugged = slugify(candidate);
    const worktreePath = path.join('.claude', 'worktrees', slugged);

    if (!branchExists(candidate) && !worktreePathExists(worktreePath)) {
      return { finalName: candidate, sluggedPath: worktreePath };
    }

    // Append suffix to the original desired name (not to a previously suffixed one)
    candidate = `${desiredName}-${shortSuffix()}`;
  }

  throw new Error(`Could not find a unique branch name for "${desiredName}" after 10 attempts`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let name = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[++i];
    }
  }

  return { name };
}

function fail(message) {
  process.stdout.write(JSON.stringify({ error: message }) + '\n');
  process.exit(1);
}

function main() {
  const { name } = parseArgs(process.argv);

  if (!name) {
    fail('Missing required argument: --name <branch-name>');
    return;
  }

  if (!isValidBranchName(name)) {
    fail(`Invalid branch name "${name}". Only alphanumeric, /, -, _, and . characters are allowed.`);
    return;
  }

  // Resolve a unique branch name / worktree path
  let finalName, sluggedPath;
  try {
    ({ finalName, sluggedPath } = resolveUniqueName(name));
  } catch (err) {
    fail(err.message);
    return;
  }

  // Ensure the parent directory exists (.claude/worktrees)
  const parentDir = path.join('.claude', 'worktrees');
  try {
    fs.mkdirSync(parentDir, { recursive: true });
  } catch (err) {
    fail(`Failed to create parent directory "${parentDir}": ${err.message}`);
    return;
  }

  // Create the worktree (git creates the worktree directory itself)
  try {
    exec(
      `git worktree add ${sluggedPath} -b ${finalName}`,
      { throwOnError: true }
    );
  } catch (err) {
    fail(`git worktree add failed for branch "${finalName}" at path "${sluggedPath}": ${err.message}`);
    return;
  }

  process.stdout.write(JSON.stringify({ branch: finalName, path: sluggedPath }) + '\n');
  process.exit(0);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: `Unexpected error: ${err.message}` }) + '\n');
    process.exit(1);
  }
}
