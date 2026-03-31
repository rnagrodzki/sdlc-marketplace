#!/usr/bin/env node
/**
 * commit-prepare.js
 * Pre-computes all data needed for the commit-sdlc skill:
 * staged/unstaged state, diff content, recent commit history, and flag overrides.
 * Outputs JSON to stdout so the LLM can focus solely on message generation.
 *
 * Usage:
 *   node commit-prepare.js [options]
 *
 * Options:
 *   --no-stash     Skip stashing unstaged changes (passed through to output)
 *   --scope <s>    Override conventional commit scope (passed through to output)
 *   --type <t>     Override conventional commit type (passed through to output)
 *   --amend        Amend last commit instead of creating new (passed through to output)
 *   --auto         Skip interactive approval prompts (passed through to output)
 *
 * Exit codes:
 *   0 = success, JSON on stdout
 *   1 = fatal error, JSON with non-empty errors[] on stdout
 *   2 = unexpected script crash, message on stderr
 *
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const { exec, checkGitState } = require('./lib/git');
const { readSection } = require('./lib/config');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let noStash = false;
  let scope   = null;
  let type    = null;
  let amend   = false;
  let auto    = false;
  const warnings = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--no-stash') {
      noStash = true;
    } else if (a === '--amend') {
      amend = true;
    } else if (a === '--scope' && args[i + 1]) {
      scope = args[++i];
    } else if (a === '--type' && args[i + 1]) {
      type = args[++i];
    } else if (a === '--auto') {
      auto = true;
    }
  }

  return { noStash, scope, type, amend, auto, warnings };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const projectRoot = process.cwd();
  const { noStash, scope, type, amend, auto, warnings: parseWarnings } = parseArgs(process.argv);

  const errors   = [];
  const warnings = [...parseWarnings];

  const flags = { noStash, scope, type, amend, auto };

  // Step 3: Validate git repo and get current branch
  let gitState;
  try {
    gitState = checkGitState(projectRoot);
  } catch (err) {
    errors.push(err.message);
    output({ errors, warnings }, 1);
    return;
  }

  const { currentBranch } = gitState;

  // Step 3b: Read commit config
  let commitConfig = null;
  try {
    commitConfig = readSection(projectRoot, 'commit');
  } catch (err) {
    warnings.push(`Could not read commit config: ${err.message}`);
  }

  // Step 3c: Validate flags against config
  if (type && commitConfig?.allowedTypes && Array.isArray(commitConfig.allowedTypes) && commitConfig.allowedTypes.length > 0) {
    if (!commitConfig.allowedTypes.includes(type)) {
      errors.push(`Commit type "${type}" is not allowed. Allowed types: ${commitConfig.allowedTypes.join(', ')}`);
    }
  }

  if (scope && commitConfig?.allowedScopes && Array.isArray(commitConfig.allowedScopes) && commitConfig.allowedScopes.length > 0) {
    if (!commitConfig.allowedScopes.includes(scope)) {
      errors.push(`Commit scope "${scope}" is not allowed. Allowed scopes: ${commitConfig.allowedScopes.join(', ')}`);
    }
  }

  // Step 4: Get staged files
  const stagedRaw   = exec('git diff --cached --name-only', { cwd: projectRoot });
  const stagedFiles = stagedRaw ? stagedRaw.split('\n').filter(Boolean) : [];

  // Step 5: Error if nothing staged and not amending
  if (stagedFiles.length === 0 && !amend) {
    errors.push('No staged changes. Use `git add` to stage files before committing.');
    output({ errors, warnings, currentBranch, flags }, 1);
    return;
  }

  // Step 5b: Warn when amending with no staged files
  if (stagedFiles.length === 0 && amend) {
    warnings.push('No staged changes. The amended commit will have the same file changes as the original.');
  }

  // Step 6: Get staged diff (may be empty when --amend with nothing staged)
  const stagedDiff = exec('git diff --cached', { cwd: projectRoot }) || '';

  // Step 7: Get staged diff stat
  const stagedDiffStat = exec('git diff --cached --stat', { cwd: projectRoot }) || '';

  // Step 8: Get unstaged files
  const unstagedRaw   = exec('git diff --name-only', { cwd: projectRoot });
  const unstagedFiles = unstagedRaw ? unstagedRaw.split('\n').filter(Boolean) : [];

  // Step 9: Get untracked files
  const untrackedRaw   = exec('git ls-files --others --exclude-standard', { cwd: projectRoot });
  const untrackedFiles = untrackedRaw ? untrackedRaw.split('\n').filter(Boolean) : [];

  // Step 10: Get recent commits
  const commitsRaw    = exec('git log --oneline -15', { cwd: projectRoot });
  const recentCommits = commitsRaw ? commitsRaw.split('\n').filter(Boolean) : [];

  // Step 11: Get last commit message when amending
  let lastCommitMessage = null;
  if (amend) {
    const raw = exec('git log -1 --format=%B', { cwd: projectRoot });
    lastCommitMessage = raw !== null ? raw.trim() : null;
  }

  // Step 12: Warn when amending on a protected branch
  if (amend && (currentBranch === 'main' || currentBranch === 'master')) {
    warnings.push(`You are on ${currentBranch}. Amending commits on a protected branch may cause issues.`);
  }

  const result = {
    errors,
    warnings,
    currentBranch,
    flags,
    commitConfig,
    staged: {
      files:     stagedFiles,
      fileCount: stagedFiles.length,
      diff:      stagedDiff,
      diffStat:  stagedDiffStat,
    },
    unstaged: {
      files:      unstagedFiles,
      fileCount:  unstagedFiles.length,
      hasChanges: unstagedFiles.length > 0,
    },
    untracked: {
      files:     untrackedFiles,
      fileCount: untrackedFiles.length,
    },
    recentCommits,
    lastCommitMessage,
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
    process.stderr.write(`commit-prepare.js error: ${err.message}\n${err.stack}\n`);
    process.exit(2);
  }
}

module.exports = { parseArgs };
