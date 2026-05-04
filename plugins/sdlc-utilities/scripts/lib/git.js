/**
 * git.js
 * Shared git and GitHub utilities for sdlc-utilities scripts.
 * Zero external dependencies — Node.js built-ins only.
 *
 * Exports (shared — used by review-prepare.js and pr-prepare.js):
 *   exec, checkGitState, detectBaseBranch, getChangedFiles,
 *   getCommitLog, getCommitCount, fetchPrMetadata, fetchRepoLabels,
 *   parseRemoteOwner, getGhAccounts, ensureGhAccount
 *
 * Exports (PR-specific — used by pr-prepare.js only):
 *   getRemoteState, pushToRemote, getCommitsStructured,
 *   getDiffStat, getDiffContent
 */

'use strict';

const { execSync, spawnSync } = require('node:child_process');

// ---------------------------------------------------------------------------
// Core exec helper
// ---------------------------------------------------------------------------

/**
 * Run a shell command and return trimmed stdout, or null on failure.
 * @param {string} cmd
 * @param {object} [opts]  Passed to execSync (cwd, shell, etc.)
 * @param {boolean} [opts.throwOnError]  If true, rethrows on failure instead of returning null.
 * @returns {string|null}
 */
function exec(cmd, opts = {}) {
  const { throwOnError, ...execOpts } = opts;
  try {
    return execSync(cmd, { encoding: 'utf8', ...execOpts }).trim();
  } catch (err) {
    if (throwOnError) throw err;
    return null;
  }
}

/**
 * Run a shell command with automatic retry and exponential backoff.
 * Uses Atomics.wait for the delay — no subprocess spawned.
 * @param {string} cmd
 * @param {object} [opts]
 * @param {number} [opts.retries=3]       Maximum number of attempts (total, including the first).
 * @param {number} [opts.baseDelayMs=1000] Delay before the second attempt; doubles on each retry.
 * @param {boolean} [opts.throwOnError]    If true and all retries exhausted, throws with attempt count.
 * @returns {string|null}  Trimmed stdout, or null when all attempts fail and throwOnError is false.
 */
function retryExec(cmd, opts = {}) {
  const { retries = 3, baseDelayMs = 1000, throwOnError, ...execOpts } = opts;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = exec(cmd, execOpts);
    if (result !== null) return result;
    // All attempts exhausted — break before sleeping.
    if (attempt === retries) break;
    // Exponential backoff: 1×, 2×, 4×, …
    const delay = baseDelayMs * Math.pow(2, attempt - 1);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
  }
  if (throwOnError) {
    throw new Error(`retryExec: command failed after ${retries} attempt(s): ${cmd}`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shared helpers (used by both review-prepare.js and pr-prepare.js)
// ---------------------------------------------------------------------------

/**
 * Verify the working directory is inside a git repo and return basic state.
 * @param {string} projectRoot
 * @returns {{ currentBranch: string, uncommittedChanges: boolean, dirtyFiles: string[] }}
 * @throws {Error} if not inside a git repo
 */
function checkGitState(projectRoot) {
  const inside = exec('git rev-parse --is-inside-work-tree', { cwd: projectRoot });
  if (inside !== 'true') throw new Error('Not inside a git repository');

  const currentBranch = exec('git branch --show-current', { cwd: projectRoot }) || 'HEAD';
  const statusLines   = exec('git status --porcelain', { cwd: projectRoot }) || '';
  const dirtyFiles    = statusLines.split('\n').filter(Boolean).map(l => l.slice(3));

  return { currentBranch, uncommittedChanges: dirtyFiles.length > 0, dirtyFiles };
}

/**
 * Auto-detect the default base branch.
 * Tries: origin/HEAD symbolic ref → 'main' → 'master'.
 * @param {string} projectRoot
 * @returns {string}
 * @throws {Error} if no base branch can be detected
 */
function detectBaseBranch(projectRoot) {
  const fromRemote = exec(
    "git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'",
    { cwd: projectRoot, shell: true }
  );
  if (fromRemote) return fromRemote;

  for (const candidate of ['main', 'master']) {
    const exists = exec(`git rev-parse --verify ${candidate} 2>/dev/null`, { cwd: projectRoot, shell: true });
    if (exists) return candidate;
  }

  throw new Error('Cannot auto-detect base branch. Use --base <branch>.');
}

/**
 * List files changed depending on scope.
 * @param {string|null} base  Base branch (required for 'all', 'committed', and 'worktree' scopes)
 * @param {string} projectRoot
 * @param {'all'|'committed'|'staged'|'working'|'worktree'} [scope='all']
 * @returns {string[]}
 */
function getChangedFiles(base, projectRoot, scope = 'all') {
  let cmd;
  switch (scope) {
    case 'committed': cmd = `git diff --name-only ${base}..HEAD`; break;
    case 'staged':    cmd = 'git diff --cached --name-only';      break;
    case 'working':   cmd = 'git diff HEAD --name-only';          break;
    case 'worktree':  cmd = `git diff --name-only ${base}`;       break;
    default:          cmd = `git diff --cached --name-only ${base}`; break; // 'all'
  }
  const out = exec(cmd, { cwd: projectRoot });
  return out ? out.split('\n').filter(Boolean) : [];
}

/**
 * One-line commit log between base and HEAD.
 * @param {string} base
 * @param {string} projectRoot
 * @returns {string}
 */
function getCommitLog(base, projectRoot) {
  return exec(`git log --oneline ${base}..HEAD`, { cwd: projectRoot }) || '';
}

/**
 * Number of commits between base and HEAD.
 * @param {string} base
 * @param {string} projectRoot
 * @returns {number}
 */
function getCommitCount(base, projectRoot) {
  const count = exec(`git rev-list --count ${base}..HEAD`, { cwd: projectRoot });
  return count ? parseInt(count, 10) : 0;
}

/**
 * Fetch basic PR metadata for the current branch via `gh`.
 * Returns { exists: false } if no PR exists or gh is unavailable.
 * @returns {{ exists: boolean, number?: number, title?: string, url?: string, state?: string, owner?: string, repo?: string }}
 */
function fetchPrMetadata() {
  const prJson = exec('gh pr view --json number,title,url,state,labels');
  if (!prJson) return { exists: false };
  const repoJson = exec('gh repo view --json owner,name');
  if (!repoJson) return { exists: false };
  try {
    const pr   = JSON.parse(prJson);
    const repo = JSON.parse(repoJson);
    return { exists: true, number: pr.number, title: pr.title, url: pr.url, state: pr.state, labels: (pr.labels || []).map(l => l.name), owner: repo.owner.login, repo: repo.name };
  } catch (_) {
    return { exists: false };
  }
}

/**
 * Fetch all labels defined in the repository via `gh`.
 * Returns an empty array if `gh` is unavailable or the command fails.
 * @returns {Array<{ name: string, description: string }>}
 */
function fetchRepoLabels() {
  const raw = exec('gh label list --json name,description --limit 100');
  if (!raw) return [];
  try {
    const labels = JSON.parse(raw);
    return labels.map(l => ({ name: l.name, description: l.description || '' }));
  } catch (_) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// GitHub account switching (shared — used by pr-prepare.js and review-prepare.js)
// ---------------------------------------------------------------------------

/**
 * Parse the git remote URL to extract host, owner, and repo name.
 * Supports SSH format (git@host:owner/repo.git) and HTTPS (https://host/owner/repo.git).
 * @param {string} projectRoot
 * @returns {{ host: string, owner: string, repo: string } | null}
 */
function parseRemoteOwner(projectRoot) {
  const url = exec('git remote get-url origin', { cwd: projectRoot });
  if (!url) return null;

  // SSH: git@github.com:owner/repo.git
  const sshMatch = url.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return { host: sshMatch[1], owner: sshMatch[2], repo: sshMatch[3] };
  }

  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = url.match(/^https?:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return { host: httpsMatch[1], owner: httpsMatch[2], repo: httpsMatch[3] };
  }

  return null;
}

/**
 * Return all authenticated gh accounts for a given host.
 * @param {string} host  e.g. "github.com"
 * @returns {{ accounts: Array<{ login: string, active: boolean }>, error: string|null }}
 */
function getGhAccounts(host) {
  const raw = exec('gh auth status --json hosts');
  if (!raw) return { accounts: [], error: null }; // gh not installed — silent skip

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return { accounts: [], error: 'Could not parse gh auth status output' };
  }

  const hostEntries = parsed.hosts && parsed.hosts[host];
  if (!Array.isArray(hostEntries) || hostEntries.length === 0) {
    return { accounts: [], error: null };
  }

  const accounts = hostEntries
    .filter(e => e.state === 'success')
    .map(e => ({ login: e.login, active: Boolean(e.active) }));

  return { accounts, error: null };
}

/**
 * Ensure the active gh account is the correct one for the current repository.
 * Uses two-phase matching:
 *   Phase 1 (fast): Match account login against the remote owner name.
 *   Phase 2 (fallback): Test API access per account (handles org repos).
 *
 * The switch persists beyond this call — it changes the global gh CLI active account.
 *
 * @param {string} projectRoot
 * @returns {{ switched: boolean, account: string|null, previousAccount: string|null, warning: string|null }}
 */
function ensureGhAccount(projectRoot) {
  const noOp = { switched: false, account: null, previousAccount: null, warning: null };

  const remote = parseRemoteOwner(projectRoot);
  if (!remote) return noOp; // no origin remote, nothing to do

  const { host, owner, repo } = remote;
  const { accounts, error } = getGhAccounts(host);

  if (error) return { ...noOp, warning: `GitHub account detection failed: ${error}` };
  if (accounts.length <= 1) return noOp; // single or no accounts — nothing to switch

  const activeAccount = accounts.find(a => a.active);
  if (!activeAccount) return noOp;

  // Phase 1: Fast owner match (covers personal repos)
  const ownerLower = owner.toLowerCase();
  if (activeAccount.login.toLowerCase() === ownerLower) return noOp; // already correct

  const matchingAccount = accounts.find(a => !a.active && a.login.toLowerCase() === ownerLower);
  if (matchingAccount) {
    const switchResult = exec(`gh auth switch --user ${matchingAccount.login}`);
    if (switchResult !== null || exec('gh auth status --active') !== null) {
      return {
        switched: true,
        account: matchingAccount.login,
        previousAccount: activeAccount.login,
        warning: null,
      };
    }
    // switch command failed — fall through to phase 2
  }

  // Phase 2: API access test (covers org repos where login !== owner)
  const apiPath = `repos/${owner}/${repo}`;

  // Test active account first — maybe it has access despite not matching the name
  const activeHasAccess = exec(`gh api ${apiPath} --silent 2>/dev/null`, { shell: true });
  if (activeHasAccess !== null) return noOp; // active account works, no switch needed

  // Try each other account
  for (const candidate of accounts.filter(a => !a.active)) {
    exec(`gh auth switch --user ${candidate.login}`);
    const hasAccess = exec(`gh api ${apiPath} --silent 2>/dev/null`, { shell: true });
    if (hasAccess !== null) {
      return {
        switched: true,
        account: candidate.login,
        previousAccount: activeAccount.login,
        warning: null,
      };
    }
  }

  // No account worked — restore original and warn
  exec(`gh auth switch --user ${activeAccount.login}`);
  return {
    ...noOp,
    warning: `No authenticated gh account has access to ${owner}/${repo}. Run "gh auth switch" to select the correct account manually.`,
  };
}

/**
 * Pure helper — pick a gh account whose login matches the given repo owner (case-insensitive).
 * Used by post-failure recovery (issue #184). Pure / no I/O so it can be unit-tested
 * without mocking gh.
 *
 * @param {string} owner — repo owner from `parseRemoteOwner`
 * @param {Array<{login: string, active?: boolean}>} accounts — list of gh accounts
 * @returns {{ login: string, active: boolean }|null}
 */
function selectAccountForOwner(owner, accounts) {
  if (!owner || !Array.isArray(accounts) || accounts.length === 0) return null;
  const ownerLower = String(owner).toLowerCase();
  const match = accounts.find(
    a => a && typeof a.login === 'string' && a.login.toLowerCase() === ownerLower
  );
  if (!match) return null;
  return { login: match.login, active: Boolean(match.active) };
}

/**
 * Permission-error signature check for `gh pr create` failures (issue #184).
 * Returns true when the error text indicates the active gh account lacks
 * permission to create a pull request on this repo (vs. unrelated failures
 * like 404, network, or rate-limit).
 *
 * @param {string} errorText
 * @returns {boolean}
 */
function isGhCreatePrPermissionError(errorText) {
  if (typeof errorText !== 'string' || errorText.length === 0) return false;
  const lower = errorText.toLowerCase();
  return (
    lower.includes('does not have the correct permissions to execute') &&
    lower.includes('createpullrequest')
  );
}

/**
 * Post-failure gh-account-switch recovery for `gh pr create`.
 *
 * Composes existing helpers (`parseRemoteOwner`, `getGhAccounts`, `exec`) — no new
 * git or gh primitives. Distinct from the pre-flight `ensureGhAccount`:
 * this runs ONLY when `gh pr create` already failed with a permission error,
 * so it can confirm the recovery actually changed something.
 *
 * Behavior:
 *   - If `errorText` is not a permission error → `{ recovered: false, reason: "non-permission-error" }`
 *   - If matching account is already active → `{ recovered: false, switched: false, reason: "already-active", account }`
 *   - If matching account exists and switch succeeds → `{ recovered: true, switched: true, account, previousAccount }`
 *   - If no matching account → `{ recovered: false, switched: false, hint: "gh auth login --hostname <host>" }`
 *
 * For test injection (so promptfoo exec tests can run hermetically), pass
 * `accounts` and `remote` directly instead of letting the function call gh.
 *
 * @param {string} projectRoot
 * @param {string} errorText
 * @param {{ accounts?: Array<{login:string, active?:boolean}>, remote?: {host:string,owner:string,repo:string}, dryRun?: boolean }} [opts]
 * @returns {object}
 */
function recoverGhAccountForRepo(projectRoot, errorText, opts = {}) {
  if (!isGhCreatePrPermissionError(errorText)) {
    return { recovered: false, reason: 'non-permission-error' };
  }

  const remote = opts.remote || parseRemoteOwner(projectRoot);
  if (!remote) {
    return { recovered: false, switched: false, reason: 'no-remote' };
  }
  const { host, owner } = remote;

  let accounts = opts.accounts;
  if (!accounts) {
    const result = getGhAccounts(host);
    if (result.error) {
      return { recovered: false, switched: false, reason: 'gh-status-error', error: result.error };
    }
    accounts = result.accounts;
  }

  const match = selectAccountForOwner(owner, accounts);
  if (!match) {
    return {
      recovered: false,
      switched: false,
      hint: `gh auth login --hostname ${host}`,
      owner,
      host,
    };
  }

  const activeAccount = accounts.find(a => a && a.active) || null;
  const previousAccount = activeAccount ? activeAccount.login : null;

  if (match.active) {
    return {
      recovered: false,
      switched: false,
      reason: 'already-active',
      account: match.login,
    };
  }

  if (opts.dryRun) {
    return {
      recovered: true,
      switched: true,
      account: match.login,
      previousAccount,
      dryRun: true,
    };
  }

  const switchResult = exec(`gh auth switch --user ${match.login}`);
  // gh auth switch prints to stderr on success and may return null in our exec wrapper —
  // verify by re-querying status.
  const verify = getGhAccounts(host);
  if (verify.error || !Array.isArray(verify.accounts)) {
    return {
      recovered: false,
      switched: false,
      reason: 'switch-verify-failed',
      error: verify.error,
    };
  }
  const newActive = verify.accounts.find(a => a && a.active);
  if (newActive && newActive.login.toLowerCase() === match.login.toLowerCase()) {
    return {
      recovered: true,
      switched: true,
      account: match.login,
      previousAccount,
    };
  }

  return {
    recovered: false,
    switched: false,
    reason: 'switch-failed',
    account: match.login,
    previousAccount,
    error: switchResult,
  };
}

// ---------------------------------------------------------------------------
// PR-specific helpers (used by pr-prepare.js only)
// ---------------------------------------------------------------------------

/**
 * Check the remote tracking state of the current branch.
 * @param {string} projectRoot
 * @returns {{ hasUpstream: boolean, remoteBranch: string|null, isAhead: boolean }}
 */
function getRemoteState(projectRoot) {
  const upstream = exec(
    'git rev-parse --abbrev-ref --symbolic-full-name @{upstream} 2>/dev/null',
    { cwd: projectRoot }
  );
  if (!upstream) return { hasUpstream: false, remoteBranch: null, isAhead: false };

  const aheadBehind = exec(`git status -sb`, { cwd: projectRoot }) || '';
  const isAhead = /ahead/.test(aheadBehind);
  return { hasUpstream: true, remoteBranch: upstream, isAhead };
}

/**
 * Push the current branch to origin.
 * If no upstream exists, uses `git push -u origin <branch>`.
 * Otherwise uses `git push`.
 * @param {string} projectRoot
 * @param {boolean} hasUpstream
 * @returns {'pushed-new' | 'pushed' | 'error'}
 */
function pushToRemote(projectRoot, hasUpstream) {
  if (!hasUpstream) {
    const branch = exec('git branch --show-current', { cwd: projectRoot });
    if (!branch) return 'error';
    const result = spawnSync('git', ['push', '-u', 'origin', branch], { cwd: projectRoot, encoding: 'utf8' });
    return result.status === 0 ? 'pushed-new' : 'error';
  }
  const result = spawnSync('git', ['push'], { cwd: projectRoot, encoding: 'utf8' });
  return result.status === 0 ? 'pushed' : 'error';
}

/**
 * Return structured commit objects between base and HEAD.
 * Parses Co-authored-by trailers.
 * @param {string} base
 * @param {string} projectRoot
 * @returns {Array<{ hash: string, subject: string, body: string, coAuthors: string[] }>}
 */
function getCommitsStructured(base, projectRoot) {
  // Use a unique separator to split commits reliably
  const SEP = '---COMMIT---';
  const raw = exec(
    `git log --format="${SEP}%n%H%n%s%n%b%n%(trailers:key=Co-authored-by)" ${base}..HEAD`,
    { cwd: projectRoot }
  );
  if (!raw) return [];

  const commits = [];
  const blocks = raw.split(SEP).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    const hash    = lines[0].trim().slice(0, 8);
    const subject = lines[1].trim();
    const rest    = lines.slice(2);

    // Co-authored-by trailers are at the end; body is everything in between
    const coAuthors = rest.filter(l => /^Co-authored-by:/i.test(l.trim())).map(l => l.trim());
    const bodyLines = rest.filter(l => !/^Co-authored-by:/i.test(l.trim()));
    const body = bodyLines.join('\n').trim();

    if (hash && subject) {
      commits.push({ hash, subject, body, coAuthors });
    }
  }

  return commits;
}

/**
 * Return diff statistics between base and HEAD.
 * @param {string} base
 * @param {string} projectRoot
 * @returns {{ filesChanged: number, insertions: number, deletions: number, summary: string }}
 */
function getDiffStat(base, projectRoot) {
  const stat = exec(`git diff --stat ${base}..HEAD`, { cwd: projectRoot }) || '';
  const summary = stat.split('\n').filter(Boolean).pop() || '';

  // Parse "N files changed, N insertions(+), N deletions(-)"
  const filesMatch = summary.match(/(\d+) files? changed/);
  const insMatch   = summary.match(/(\d+) insertions?\(\+\)/);
  const delMatch   = summary.match(/(\d+) deletions?\(-\)/);

  const insertions = insMatch ? parseInt(insMatch[1], 10) : 0;
  const deletions  = delMatch ? parseInt(delMatch[1], 10) : 0;
  return {
    filesChanged:      filesMatch ? parseInt(filesMatch[1], 10) : 0,
    insertions,
    deletions,
    totalLinesChanged: insertions + deletions,
    summary,
  };
}

/**
 * Return the full unified diff between base and HEAD.
 * @param {string} base
 * @param {string} projectRoot
 * @returns {string}
 */
function getDiffContent(base, projectRoot) {
  return exec(`git diff ${base}..HEAD`, { cwd: projectRoot }) || '';
}

/**
 * Split a raw unified diff string into per-file chunks.
 * @param {string} rawDiff  Full unified diff output from git
 * @returns {Map<string, string>}  Map of file path → diff chunk
 */
function splitDiffByFile(rawDiff) {
  const fileDiffs = new Map();
  const chunks    = rawDiff.split(/(?=^diff --git )/m);

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const m = chunk.match(/^diff --git a\/.+ b\/(.+)/m);
    if (m) fileDiffs.set(m[1].trim(), chunk);
  }

  return fileDiffs;
}

// ---------------------------------------------------------------------------
// Version-specific helpers (used by version-prepare.js only)
// ---------------------------------------------------------------------------

/**
 * List all semver-like tags, sorted by descending version (latest first).
 * Includes tags with or without a 'v' prefix (e.g., 'v1.2.3' or '1.2.3').
 * @param {string} projectRoot
 * @returns {string[]}
 */
function getTagList(projectRoot) {
  const out = exec('git tag --list --sort=-v:refname', { cwd: projectRoot });
  if (!out) return [];
  return out.split('\n').filter(tag => /^v?\d+\.\d+\.\d+/.test(tag));
}

/**
 * Return structured commit objects since a given ref (tag, commit, etc.) up to HEAD.
 * If sinceRef is empty or null, returns ALL commits in the repository.
 * Uses the same separator-based parsing as getCommitsStructured.
 * @param {string|null} sinceRef - tag name, commit SHA, or null for all commits
 * @param {string} projectRoot
 * @returns {Array<{ hash: string, subject: string, body: string, coAuthors: string[] }>}
 */
function getCommitsSinceRef(sinceRef, projectRoot) {
  const SEP   = '---COMMIT---';
  const range = sinceRef ? `${sinceRef}..HEAD` : 'HEAD';
  const raw   = exec(
    `git log --format="${SEP}%n%H%n%s%n%b%n%(trailers:key=Co-authored-by)" ${range}`,
    { cwd: projectRoot }
  );
  if (!raw) return [];

  const commits = [];
  const blocks  = raw.split(SEP).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    const hash    = lines[0].trim().slice(0, 8);
    const subject = lines[1].trim();
    const rest    = lines.slice(2);

    const coAuthors = rest.filter(l => /^Co-authored-by:/i.test(l.trim())).map(l => l.trim());
    const bodyLines = rest.filter(l => !/^Co-authored-by:/i.test(l.trim()));
    const body      = bodyLines.join('\n').trim();

    if (hash && subject) {
      commits.push({ hash, subject, body, coAuthors });
    }
  }

  return commits;
}

/**
 * Get commits between two git refs using a `fromRef..toRef` range.
 *
 * Unlike `getCommitsSinceRef` (which always ends at HEAD), this function
 * targets a closed range — useful for collecting exactly the commits that
 * make up a specific release.
 *
 * Edge cases:
 * - `fromRef` null/undefined → range = `toRef` (all commits up to toRef)
 * - `toRef` null/undefined   → falls back to `fromRef..HEAD` (same as getCommitsSinceRef)
 * - both null/undefined      → range = `HEAD`
 *
 * @param {string|null|undefined} fromRef    - Start of range (exclusive); e.g. previous tag
 * @param {string|null|undefined} toRef      - End of range (inclusive); e.g. current tag
 * @param {string}                projectRoot - Working directory for git
 * @returns {Array<{ hash: string, subject: string, body: string, coAuthors: string[] }>}
 */
function getCommitsBetweenRefs(fromRef, toRef, projectRoot) {
  if (!toRef) return getCommitsSinceRef(fromRef, projectRoot);

  const SEP   = '---COMMIT---';
  const range = fromRef ? `${fromRef}..${toRef}` : toRef;
  const raw   = exec(
    `git log --format="${SEP}%n%H%n%s%n%b%n%(trailers:key=Co-authored-by)" ${range}`,
    { cwd: projectRoot }
  );
  if (!raw) return [];

  const commits = [];
  const blocks  = raw.split(SEP).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    const hash    = lines[0].trim().slice(0, 8);
    const subject = lines[1].trim();
    const rest    = lines.slice(2);

    const coAuthors = rest.filter(l => /^Co-authored-by:/i.test(l.trim())).map(l => l.trim());
    const bodyLines = rest.filter(l => !/^Co-authored-by:/i.test(l.trim()));
    const body      = bodyLines.join('\n').trim();

    if (hash && subject) {
      commits.push({ hash, subject, body, coAuthors });
    }
  }

  return commits;
}

// ---------------------------------------------------------------------------
// Received-review-specific helpers
// ---------------------------------------------------------------------------

/**
 * Return the authenticated GitHub username via `gh api user --jq .login`.
 * Returns null if `gh` is unavailable or the command fails.
 * @returns {string|null}
 */
function getCurrentUser() {
  return exec('gh api user --jq .login');
}

/**
 * Fetch all review threads for a PR via GitHub GraphQL API.
 * Handles pagination automatically (100 threads per page).
 * Returns an empty array on any failure (gh unavailable, API error, etc.).
 *
 * @param {string} owner      - Repository owner (org or user login)
 * @param {string} repo       - Repository name
 * @param {number} prNumber   - Pull request number
 * @returns {Array<{
 *   id: string,
 *   isResolved: boolean,
 *   isOutdated: boolean,
 *   path: string,
 *   line: number|null,
 *   startLine: number|null,
 *   comments: Array<{
 *     id: string,
 *     databaseId: number,
 *     body: string,
 *     authorLogin: string,
 *     createdAt: string
 *   }>
 * }>}
 */
function fetchPrReviewThreads(owner, repo, prNumber) {
  const query = `
    query($owner: String!, $repo: String!, $prNumber: Int!, $after: String) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $prNumber) {
          reviewThreads(first: 100, after: $after) {
            nodes {
              id
              isResolved
              isOutdated
              path
              line
              startLine
              diffSide
              comments(first: 100) {
                nodes {
                  id
                  databaseId
                  body
                  author {
                    login
                  }
                  createdAt
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }
  `;

  const threads = [];
  let cursor = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const cursorArg = cursor ? ` -F after=${cursor}` : '';
    const raw = exec(
      `gh api graphql -f query='${query.replace(/'/g, "'\\''")}' -F owner=${owner} -F repo=${repo} -F prNumber=${prNumber}${cursorArg}`
    );

    if (!raw) return [];

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      return [];
    }

    const reviewThreads =
      parsed &&
      parsed.data &&
      parsed.data.repository &&
      parsed.data.repository.pullRequest &&
      parsed.data.repository.pullRequest.reviewThreads;

    if (!reviewThreads) return [];

    for (const node of (reviewThreads.nodes || [])) {
      const comments = (node.comments && node.comments.nodes || []).map(c => ({
        id: c.id,
        databaseId: c.databaseId,
        body: c.body,
        authorLogin: c.author ? c.author.login : null,
        createdAt: c.createdAt,
      }));

      threads.push({
        id: node.id,
        isResolved: node.isResolved,
        isOutdated: node.isOutdated,
        path: node.path,
        line: node.line,
        startLine: node.startLine,
        comments,
      });
    }

    const pageInfo = reviewThreads.pageInfo;
    if (!pageInfo || !pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor;
  }

  return threads;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Core
  exec,
  retryExec,
  // Shared
  checkGitState,
  detectBaseBranch,
  getChangedFiles,
  getCommitLog,
  getCommitCount,
  fetchPrMetadata,
  fetchRepoLabels,
  parseRemoteOwner,
  getGhAccounts,
  ensureGhAccount,
  selectAccountForOwner,
  isGhCreatePrPermissionError,
  recoverGhAccountForRepo,
  // PR-specific
  getRemoteState,
  pushToRemote,
  getCommitsStructured,
  getDiffStat,
  getDiffContent,
  splitDiffByFile,
  // Version-specific
  getTagList,
  getCommitsSinceRef,
  getCommitsBetweenRefs,
  // Received-review-specific
  getCurrentUser,
  fetchPrReviewThreads,
};
