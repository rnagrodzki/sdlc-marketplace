#!/usr/bin/env node
/**
 * received-review-prepare.js
 * Pre-computes review thread state for the received-review-sdlc skill:
 * fetches PR review threads, classifies each into one of four categories
 * (outstanding, resolved, self-replied, stale), and outputs a JSON manifest.
 *
 * Usage:
 *   node received-review-prepare.js --pr <number> [options]
 *
 * Options:
 *   --pr <number>          PR number (required)
 *   --owner <owner>        Repository owner (auto-detect from git remote if omitted)
 *   --repo <repo>          Repository name (auto-detect if omitted)
 *   --project-root <path>  Project root (default: cwd)
 *
 * Exit codes:
 *   0 = success, JSON on stdout (including when PR has no review threads)
 *   1 = missing --pr argument
 *   2 = script error
 *
 * Stdout: JSON manifest
 * Stderr: warnings/progress
 *
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const path = require('node:path');
const LIB = path.join(__dirname, '..', 'lib');

const {
  detectBaseBranch,
  getChangedFiles,
  parseRemoteOwner,
  ensureGhAccount,
  getCurrentUser,
  fetchPrReviewThreads,
} = require(path.join(LIB, 'git'));
const { writeOutput } = require(path.join(LIB, 'output'));
const { resolveSkipConfigCheck, ensureConfigVersion } = require(path.join(LIB, 'config-version-prepare'));
const { readSection, readProjectConfig } = require(path.join(LIB, 'config'));

// ---------------------------------------------------------------------------
// Severity parsing (issue #233)
// ---------------------------------------------------------------------------

const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

/**
 * Parse a severity tag from a PR review comment body.
 *
 * Recognized format (emitted by review-sdlc per REFERENCE.md):
 *   - **Severity**: critical
 *   - **Severity**: high
 *
 * The format is matched case-insensitively. Only the four user-configurable
 * severities are returned (`low|medium|high|critical`); `info` is mapped to
 * null because it cannot appear in `alwaysFixSeverities` (R18).
 *
 * @param {string} body  Comment body text
 * @returns {'low'|'medium'|'high'|'critical'|null}
 */
function parseSeverity(body) {
  if (typeof body !== 'string' || body.length === 0) return null;
  // Match `**Severity**: <value>` or `Severity: <value>`; tolerate surrounding whitespace.
  const m = body.match(/(?:^|\n)\s*[-*]?\s*\*{0,2}\s*severity\s*\*{0,2}\s*:\s*([a-zA-Z]+)/i);
  if (!m) return null;
  const value = m[1].toLowerCase();
  return VALID_SEVERITIES.has(value) ? value : null;
}

/**
 * Resolve `alwaysFixSeverities` from `.sdlc/local.json` only (R19, C15).
 * If the field appears in `.sdlc/config.json`, emit one stderr warning and ignore it.
 *
 * @param {string} projectRoot
 * @returns {string[]} severity list (empty array when unset)
 */
function resolveAlwaysFixSeverities(projectRoot) {
  // Misplacement check: warn if found in project config.
  try {
    const { config: projectConfig } = readProjectConfig(projectRoot);
    const misplaced = projectConfig?.receivedReview?.alwaysFixSeverities;
    if (misplaced !== undefined) {
      process.stderr.write(
        'warning: receivedReview.alwaysFixSeverities found in .sdlc/config.json — ' +
        'this field is local-only and will be ignored. Move it to .sdlc/local.json.\n'
      );
    }
  } catch (_) { /* missing or unreadable project config — silent */ }

  const local = readSection(projectRoot, 'receivedReview');
  const list = local?.alwaysFixSeverities;
  if (!Array.isArray(list)) return [];
  const valid = list.filter(s => typeof s === 'string' && VALID_SEVERITIES.has(s));
  const invalid = list.filter(s => !VALID_SEVERITIES.has(s));
  if (invalid.length > 0) {
    process.stderr.write(
      `[received-review] alwaysFixSeverities: unrecognized severity values ignored: ` +
      `${JSON.stringify(invalid)}. Allowed: low, medium, high, critical.\n`
    );
  }
  return valid;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let prNumber = null;
  let owner = null;
  let repo = null;
  let projectRoot = process.cwd();
  let auto = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--pr' && args[i + 1])           prNumber = parseInt(args[++i], 10);
    else if (a === '--owner' && args[i + 1])    owner = args[++i];
    else if (a === '--repo' && args[i + 1])     repo = args[++i];
    else if (a === '--project-root' && args[i + 1]) projectRoot = path.resolve(args[++i]);
    else if (a === '--auto')                    auto = true;
  }

  return { prNumber, owner, repo, projectRoot, auto };
}

// ---------------------------------------------------------------------------
// Thread classification
// ---------------------------------------------------------------------------

/**
 * Classify a single review thread into one of four statuses.
 *
 * Priority order:
 *   1. resolved   — thread is marked resolved
 *   2. self-replied — current user has replied in the thread
 *   3. stale      — thread is outdated AND its file is not in the current diff
 *   4. outstanding — none of the above
 *
 * @param {object} thread       Thread object from fetchPrReviewThreads
 * @param {string} currentUser  Authenticated GitHub username
 * @param {Set<string>} changedFileSet  Set of files changed in the current diff
 * @returns {'outstanding'|'resolved'|'self-replied'|'stale'}
 */
function classifyThread(thread, currentUser, changedFileSet) {
  if (thread.isResolved) return 'resolved';

  const hasUserReply = thread.comments.some(c => c.authorLogin === currentUser);
  if (hasUserReply) return 'self-replied';

  if (thread.isOutdated && !changedFileSet.has(thread.path)) return 'stale';

  return 'outstanding';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { prNumber, owner: cliOwner, repo: cliRepo, projectRoot, auto } = parseArgs(process.argv);

  // Issue #232: verifyAndMigrate gate (CLI > env > default false).
  const skipConfigCheck = resolveSkipConfigCheck(process.argv);
  const cv = ensureConfigVersion(projectRoot, { skip: skipConfigCheck, roles: ['project'] });
  if (cv.errors.length > 0) {
    writeOutput({
      errors: cv.errors.map(e => `config-version: ${e.role}: ${e.message}`),
      warnings: [],
      flags: { skipConfigCheck },
      migration: cv.migration,
    }, 'received-review-manifest', 1);
    return;
  }

  // Validate required --pr argument
  if (prNumber == null || isNaN(prNumber)) {
    process.stderr.write('Error: --pr <number> is required.\n');
    process.exit(1);
  }

  // Ensure correct GitHub account
  const ghAuth = ensureGhAccount(projectRoot);
  if (ghAuth.warning) process.stderr.write(`Warning: ${ghAuth.warning}\n`);
  if (ghAuth.switched) process.stderr.write(`Switched GitHub account to "${ghAuth.account}" (was "${ghAuth.previousAccount}")\n`);

  // Auto-detect owner/repo from git remote if not provided
  let owner = cliOwner;
  let repo = cliRepo;

  if (!owner || !repo) {
    const remote = parseRemoteOwner(projectRoot);
    if (!remote) {
      process.stderr.write('Error: could not detect owner/repo from git remote. Provide --owner and --repo explicitly.\n');
      process.exit(2);
    }
    if (!owner) owner = remote.owner;
    if (!repo) repo = remote.repo;
  }

  // Get current user login
  const currentUser = getCurrentUser();
  if (!currentUser) {
    process.stderr.write('Warning: could not determine current GitHub user. Thread classification may be incomplete.\n');
  }

  // Fetch review threads
  process.stderr.write(`Fetching review threads for ${owner}/${repo}#${prNumber}...\n`);
  const rawThreads = fetchPrReviewThreads(owner, repo, prNumber);

  // Detect changed files in current diff (for stale classification)
  let changedFiles = [];
  try {
    const base = detectBaseBranch(projectRoot);
    changedFiles = getChangedFiles(base, projectRoot);
  } catch (_) {
    process.stderr.write('Warning: could not detect base branch; stale classification will be skipped.\n');
  }
  const changedFileSet = new Set(changedFiles);

  // Resolve alwaysFixSeverities (issue #233, R18/R19) — single source: .sdlc/local.json
  const alwaysFixSeverities = resolveAlwaysFixSeverities(projectRoot);

  // Classify threads and build output
  const threads = rawThreads.map(thread => {
    const status = classifyThread(thread, currentUser, changedFileSet);
    const firstComment = thread.comments[0] || null;
    const hasUserReply = thread.comments.some(c => c.authorLogin === currentUser);
    // Per-thread severity parsed from the first comment body (issue #233, P9).
    // null when severity cannot be parsed; such threads NEVER bypass consent (R18).
    const severity = firstComment ? parseSeverity(firstComment.body) : null;

    return {
      id: thread.id,
      status,
      path: thread.path,
      line: thread.line,
      isResolved: thread.isResolved,
      isOutdated: thread.isOutdated,
      severity,
      firstComment: firstComment
        ? {
            id: firstComment.id,
            databaseId: firstComment.databaseId,
            body: firstComment.body,
            authorLogin: firstComment.authorLogin,
            createdAt: firstComment.createdAt,
          }
        : null,
      replyCount: Math.max(0, thread.comments.length - 1),
      hasUserReply,
      allComments: thread.comments,
    };
  });

  // Compute summary counts
  const summary = {
    total: threads.length,
    outstanding: threads.filter(t => t.status === 'outstanding').length,
    resolved: threads.filter(t => t.status === 'resolved').length,
    selfReplied: threads.filter(t => t.status === 'self-replied').length,
    stale: threads.filter(t => t.status === 'stale').length,
  };

  const manifest = {
    version: 1,
    timestamp: new Date().toISOString(),
    pr: { number: prNumber, owner, repo },
    currentUser,
    flags: { auto, alwaysFixSeverities },
    threads,
    summary,
  };

  writeOutput(manifest, 'received-review-manifest');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`received-review-prepare.js error: ${err.message}\n${err.stack}\n`);
    process.exit(2);
  }
}

module.exports = { parseArgs, classifyThread };
