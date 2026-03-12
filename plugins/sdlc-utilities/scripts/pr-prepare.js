#!/usr/bin/env node
/**
 * pr-prepare.js
 * Pre-computes all data needed for the pr-sdlc skill:
 * git state, remote sync, PR mode detection, commit history, diff, JIRA ticket.
 * Outputs JSON to stdout so the LLM can focus solely on description generation.
 *
 * Usage:
 *   node pr-prepare.js [options]
 *
 * Options:
 *   --draft           Mark PR as draft (passed through to output)
 *   --update          Force update mode (error if no existing PR found)
 *   --base <branch>   Override base branch (auto-detected if omitted)
 *
 * Exit codes:
 *   0 = success, JSON on stdout
 *   1 = fatal error, JSON with non-empty errors[] on stdout
 *   2 = unexpected script crash, message on stderr
 *
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const {
  exec,
  checkGitState,
  detectBaseBranch,
  fetchPrMetadata,
  getRemoteState,
  pushToRemote,
  getCommitsStructured,
  getDiffStat,
  getDiffContent,
  ensureGhAccount,
} = require('./lib/git');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let isDraft = false;
  let forceUpdate = false;
  let baseBranchOverride = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--draft') {
      isDraft = true;
    } else if (a === '--update') {
      forceUpdate = true;
    } else if (a === '--base' && args[i + 1]) {
      baseBranchOverride = args[++i];
    }
  }

  return { isDraft, forceUpdate, baseBranchOverride };
}

// ---------------------------------------------------------------------------
// JIRA ticket detection
// ---------------------------------------------------------------------------

const JIRA_PATTERN = /\b([A-Z]{2,10}-\d+)\b/;

/**
 * Scan branch name and commit subjects for the first JIRA-style ticket reference.
 * @param {string} branchName
 * @param {Array<{ subject: string }>} commits
 * @returns {string|null}
 */
function detectJiraTicket(branchName, commits) {
  const branchMatch = branchName.match(JIRA_PATTERN);
  if (branchMatch) return branchMatch[1];

  for (const commit of commits) {
    const m = commit.subject.match(JIRA_PATTERN);
    if (m) return m[1];
  }

  return null;
}

// ---------------------------------------------------------------------------
// PR mode detection
// ---------------------------------------------------------------------------

/**
 * Determine whether to create or update a PR based on the --update flag
 * and whether an existing PR was found.
 *
 * Mode matrix:
 *   --update + PR exists  → update
 *   --update + no PR      → fatal error
 *   no flag  + PR exists  → update
 *   no flag  + no PR      → create
 *
 * @param {boolean} forceUpdate
 * @param {{ exists: boolean, number?: number, title?: string, url?: string, state?: string }} prMeta
 * @returns {{ mode: 'create'|'update', error?: string }}
 */
function detectPrMode(forceUpdate, prMeta) {
  if (forceUpdate && !prMeta.exists) {
    return { mode: 'create', error: 'No existing PR found for this branch. Remove --update to create a new PR.' };
  }
  if (prMeta.exists) return { mode: 'update' };
  return { mode: 'create' };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const projectRoot = process.cwd();
  const { isDraft, forceUpdate, baseBranchOverride } = parseArgs(process.argv);

  const errors   = [];
  const warnings = [];

  // Step 1–2: Validate git repo and get current branch
  let gitState;
  try {
    gitState = checkGitState(projectRoot);
  } catch (err) {
    errors.push(err.message);
    output({ errors, warnings }, 1);
    return;
  }

  const { currentBranch, uncommittedChanges, dirtyFiles } = gitState;

  // Step 3: Reject protected branches
  if (currentBranch === 'main' || currentBranch === 'master') {
    errors.push(`You are on the ${currentBranch} branch. Switch to a feature branch before creating a PR.`);
    output({ errors, warnings, currentBranch }, 1);
    return;
  }

  // Step 4: Warn about uncommitted changes
  if (uncommittedChanges) {
    warnings.push(`Uncommitted changes detected (${dirtyFiles.length} file(s)). They will NOT be included in the PR.`);
  }

  // Step 5: Detect base branch
  let baseBranch;
  if (baseBranchOverride) {
    const exists = exec(
      `git rev-parse --verify origin/${baseBranchOverride} 2>/dev/null`,
      { cwd: projectRoot, shell: true }
    );
    if (!exists) {
      errors.push(`Base branch "origin/${baseBranchOverride}" does not exist on the remote.`);
      output({ errors, warnings, currentBranch }, 1);
      return;
    }
    baseBranch = baseBranchOverride;
  } else {
    try {
      baseBranch = detectBaseBranch(projectRoot);
    } catch (err) {
      errors.push(err.message);
      output({ errors, warnings, currentBranch }, 1);
      return;
    }
  }

  // Step 5b: Ensure the correct GitHub account is active for this repo
  const ghAuth = ensureGhAccount(projectRoot);
  if (ghAuth.warning) {
    warnings.push(ghAuth.warning);
  }

  // Step 6: Check remote state and push if needed
  const remoteInfo = getRemoteState(projectRoot);
  let remoteAction = 'none';

  if (!remoteInfo.hasUpstream) {
    const result = pushToRemote(projectRoot, false);
    remoteAction = result === 'pushed-new' ? 'pushed-new' : 'error';
    if (remoteAction === 'error') {
      warnings.push('Could not push branch to remote. You may need to push manually before creating a PR.');
    }
  } else if (remoteInfo.isAhead) {
    const result = pushToRemote(projectRoot, true);
    remoteAction = result === 'pushed' ? 'pushed' : 'error';
    if (remoteAction === 'error') {
      warnings.push('Could not push to remote. You may need to push manually.');
    }
  }

  const remoteState = {
    pushed:       remoteAction !== 'none' && remoteAction !== 'error',
    remoteBranch: remoteInfo.remoteBranch || `origin/${currentBranch}`,
    action:       remoteAction,
  };

  // Step 7: Detect PR mode
  const prMeta  = fetchPrMetadata();
  const { mode, error: modeError } = detectPrMode(forceUpdate, prMeta);

  if (modeError) {
    errors.push(modeError);
    output({ errors, warnings, currentBranch, baseBranch, remoteState }, 1);
    return;
  }

  // Step 8: Gather commits
  const commits = getCommitsStructured(baseBranch, projectRoot);
  if (commits.length === 0) {
    warnings.push(`No commits found between "${baseBranch}" and HEAD. The PR description may be sparse.`);
  }

  // Step 9: Gather diff
  const diffStat    = getDiffStat(baseBranch, projectRoot);
  const diffContent = getDiffContent(baseBranch, projectRoot);

  if (!diffContent) {
    warnings.push(`No diff found between "${baseBranch}" and HEAD.`);
  }

  // Step 10: Extract JIRA ticket
  const jiraTicket = detectJiraTicket(currentBranch, commits);

  // Step 11: Read custom PR template
  const templatePath = path.join(projectRoot, '.claude', 'pr-template.md');
  const customTemplate = fs.existsSync(templatePath)
    ? fs.readFileSync(templatePath, 'utf8')
    : null;

  // Build output
  const result = {
    mode,
    baseBranch,
    currentBranch,
    isDraft,
    ghAuth: ghAuth.switched
      ? { switched: true, account: ghAuth.account, previousAccount: ghAuth.previousAccount }
      : null,
    existingPr: prMeta.exists
      ? { number: prMeta.number, title: prMeta.title, url: prMeta.url, state: prMeta.state }
      : null,
    jiraTicket,
    customTemplate,
    commits,
    diffStat,
    diffContent,
    remoteState,
    warnings,
    errors,
  };

  output(result, 0);
}

function output(data, exitCode) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  process.exit(exitCode);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`pr-prepare.js error: ${err.message}\n${err.stack}\n`);
    process.exit(2);
  }
}

module.exports = { parseArgs, detectJiraTicket, detectPrMode };
