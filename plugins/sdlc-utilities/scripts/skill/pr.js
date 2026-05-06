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
 *   --auto            Skip interactive approval prompts (passed through to output)
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
const LIB = path.join(__dirname, '..', 'lib');

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
  fetchRepoLabels,
  getChangedFiles,
  parseRemoteOwner,
} = require(path.join(LIB, 'git'));

const { readSection } = require(path.join(LIB, 'config'));
const { writeOutput } = require(path.join(LIB, 'output'));
const { resolveSkipConfigCheck, ensureConfigVersion } = require(path.join(LIB, 'config-version-prepare'));
const { validateLinks, formatViolations } = require(path.join(LIB, 'links'));

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let isDraft = false;
  let forceUpdate = false;
  let baseBranchOverride = null;
  let isAuto = false;
  let forcedLabels = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--draft') {
      isDraft = true;
    } else if (a === '--update') {
      forceUpdate = true;
    } else if (a === '--base' && args[i + 1]) {
      baseBranchOverride = args[++i];
    } else if (a === '--auto') {
      isAuto = true;
    } else if (a === '--label' && args[i + 1]) {
      forcedLabels.push(args[++i]);
    }
  }

  return { isDraft, forceUpdate, baseBranchOverride, isAuto, forcedLabels: [...new Set(forcedLabels)] };
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
  const { isDraft, forceUpdate, baseBranchOverride, isAuto, forcedLabels } = parseArgs(process.argv);

  const errors   = [];
  const warnings = [];

  // Issue #232: verifyAndMigrate gate (CLI > env > default false).
  const skipConfigCheck = resolveSkipConfigCheck(process.argv);
  const cv = ensureConfigVersion(projectRoot, { skip: skipConfigCheck, roles: ['project'] });
  if (cv.errors.length > 0) {
    for (const e of cv.errors) errors.push(`config-version: ${e.role}: ${e.message}`);
    writeOutput({ errors, warnings, flags: { skipConfigCheck }, migration: cv.migration }, 'pr-context', 1);
    return;
  }

  // Step 1–2: Validate git repo and get current branch
  let gitState;
  try {
    gitState = checkGitState(projectRoot);
  } catch (err) {
    errors.push(err.message);
    writeOutput({ errors, warnings }, 'pr-context', 1);
    return;
  }

  const { currentBranch, uncommittedChanges, dirtyFiles } = gitState;

  // Step 3: Reject protected branches
  if (currentBranch === 'main' || currentBranch === 'master') {
    errors.push(`You are on the ${currentBranch} branch. Switch to a feature branch before creating a PR.`);
    writeOutput({ errors, warnings, currentBranch }, 'pr-context', 1);
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
      writeOutput({ errors, warnings, currentBranch, baseBranchOverride }, 'pr-context', 1);
      return;
    }
    baseBranch = baseBranchOverride;
  } else {
    try {
      baseBranch = detectBaseBranch(projectRoot);
    } catch (err) {
      errors.push(err.message);
      writeOutput({ errors, warnings, currentBranch }, 'pr-context', 1);
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

  // `pushed` reports whether the branch is in sync with origin (issue #214) —
  // not whether *this run* performed a push. The `action` field below is the
  // audit log of what this run did. A branch already pushed and current
  // returns `pushed: true, action: 'none'`. After a successful push
  // (`pushed`/`pushed-new`), the branch is in sync regardless of the
  // pre-push cached `isAhead` snapshot. A push failure returns
  // `pushed: false, action: 'error'`.
  const justPushed = remoteAction === 'pushed' || remoteAction === 'pushed-new';
  const inSyncWithOrigin = remoteInfo.hasUpstream && !remoteInfo.isAhead && !remoteInfo.isBehind;
  const remoteState = {
    pushed:       justPushed || inSyncWithOrigin,
    remoteBranch: remoteInfo.remoteBranch || `origin/${currentBranch}`,
    action:       remoteAction,
  };

  // Step 7: Detect PR mode
  const prMeta  = fetchPrMetadata();
  const { mode, error: modeError } = detectPrMode(forceUpdate, prMeta);

  if (modeError) {
    errors.push(modeError);
    writeOutput({ errors, warnings, currentBranch, baseBranch, remoteState, forceUpdate }, 'pr-context', 1);
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

  const changedFiles = getChangedFiles(baseBranch, projectRoot, 'committed');

  // Step 10: Extract JIRA ticket
  const jiraTicket = detectJiraTicket(currentBranch, commits);

  const repoLabels = fetchRepoLabels();

  // Step 10b: Validate forced labels against repoLabels
  const repoLabelNames = repoLabels.map(label => label.name);
  for (const label of forcedLabels) {
    if (!repoLabelNames.includes(label)) {
      warnings.push(`Label "${label}" does not exist in the repository. It will be created during execution if needed.`);
    }
  }

  // Step 10c: Read PR config
  let prConfig = null;
  try {
    prConfig = readSection(projectRoot, 'pr');
  } catch (err) {
    warnings.push(`Could not read PR config: ${err.message}`);
  }

  // Step 10d: Validate pr.labels.rules against repoLabels (issue #197)
  // When mode = "rules", every rule's label must exist in the repo. Unknown
  // labels produce warnings (not errors) and are stripped from the emitted
  // prConfig.labels.rules — same posture as forced label validation above.
  // mode = "off" or "llm" leaves rules untouched.
  if (prConfig && prConfig.labels && prConfig.labels.mode === 'rules' && Array.isArray(prConfig.labels.rules)) {
    const validRules = [];
    const knownSignals = ['branchPrefix', 'commitType', 'pathGlob', 'jiraType', 'diffSizeUnder'];
    for (const rule of prConfig.labels.rules) {
      if (!rule || typeof rule !== 'object' || typeof rule.label !== 'string') {
        continue;
      }
      // Validate structural correctness of rule.when (implements R-labels-2)
      if (!rule.when || typeof rule.when !== 'object') {
        warnings.push(`Rule for label "${rule.label}" is missing a "when" condition. Rule will be ignored.`);
        continue;
      }
      const whenKeys = Object.keys(rule.when);
      if (whenKeys.length !== 1) {
        warnings.push(`Rule for label "${rule.label}" has ${whenKeys.length === 0 ? 'no' : 'multiple'} signal keys in "when" (expected exactly 1). Rule will be ignored.`);
        continue;
      }
      if (!knownSignals.includes(whenKeys[0])) {
        warnings.push(`Rule for label "${rule.label}" uses unknown signal "${whenKeys[0]}" in "when". Valid signals: ${knownSignals.join(', ')}. Rule will be ignored.`);
        continue;
      }
      if (!repoLabelNames.includes(rule.label)) {
        warnings.push(`Label "${rule.label}" referenced in pr.labels.rules does not exist in the repo. Rule will be ignored.`);
        continue;
      }
      validRules.push(rule);
    }
    prConfig = {
      ...prConfig,
      labels: { ...prConfig.labels, rules: validRules },
    };
  }

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
    isAuto,
    ghAuth: ghAuth.switched
      ? { switched: true, account: ghAuth.account, previousAccount: ghAuth.previousAccount }
      : null,
    existingPr: prMeta.exists
      ? { number: prMeta.number, title: prMeta.title, url: prMeta.url, state: prMeta.state, labels: prMeta.labels || [] }
      : null,
    jiraTicket,
    customTemplate,
    prConfig,
    commits,
    changedFiles,
    diffStat,
    diffContent,
    repoLabels,
    forcedLabels,
    remoteState,
    warnings,
    errors,
  };

  writeOutput(result, 'pr-context', 0);
}

// ---------------------------------------------------------------------------
// --validate-body mode: link verification (issue #198, R15)
// ---------------------------------------------------------------------------

/**
 * Read the proposed PR body from stdin and validate every embedded URL via
 * `lib/links.js`. The expected GitHub repo identity is derived deterministically
 * from `parseRemoteOwner(projectRoot)` — the SKILL.md never constructs ctx.
 *
 * Exit codes:
 *   0 — ok (no violations)
 *   1 — violations found (formatted list on stderr; JSON result on stdout when --json)
 *   2 — usage error
 */
async function validateBodyMode(argv) {
  const projectRoot = process.cwd();
  const wantJson = argv.includes('--json');
  const fileIdx = argv.indexOf('--file');
  let body = '';
  if (fileIdx !== -1 && argv[fileIdx + 1]) {
    body = fs.readFileSync(argv[fileIdx + 1], 'utf8');
  } else {
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) body += chunk;
  }

  const expectedRepo = parseRemoteOwner(projectRoot);
  const result = await validateLinks(body, { projectRoot, expectedRepo });

  if (wantJson) {
    process.stdout.write(JSON.stringify(result) + '\n');
  } else if (result.ok) {
    const skipNote = result.skipped.length ? ` (${result.skipped.length} skipped)` : '';
    process.stdout.write('OK: PR body link verification passed' + skipNote + '\n');
  } else {
    process.stderr.write('PR body link verification FAILED before gh pr create/edit:\n');
    process.stderr.write(formatViolations(result.violations));
    process.stderr.write('\n');
  }
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--validate-body')) {
    validateBodyMode(process.argv).catch(err => {
      process.stderr.write(`pr.js --validate-body error: ${err && err.stack || err}\n`);
      process.exit(2);
    });
  } else {
    try {
      main();
    } catch (err) {
      process.stderr.write(`pr-prepare.js error: ${err.message}\n${err.stack}\n`);
      process.exit(2);
    }
  }
}

module.exports = { parseArgs, detectJiraTicket, detectPrMode };
