#!/usr/bin/env node
/**
 * ship-prepare.js
 * Pre-computes the entire ship-sdlc pipeline plan as structured JSON.
 * The LLM calls this once at the start of the pipeline, then follows
 * the output mechanically. Skip decisions are made by deterministic code,
 * not LLM judgment.
 *
 * Usage:
 *   node ship-prepare.js [options]
 *
 * Options:
 *   --has-plan              Plan is present in conversation context
 *   --auto                  Skip interactive approval prompts
 *   --skip <csv>            Comma-separated steps to skip
 *   --preset A|B|C          Pipeline preset
 *   --bump patch|minor|major  Version bump type
 *   --draft                 Mark PR as draft
 *   --dry-run               Print plan without executing
 *   --resume                Resume from last checkpoint
 *   --workspace branch|worktree|prompt  Workspace isolation mode
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
const { exec, checkGitState, detectBaseBranch } = require('./lib/git');
const { resolveMainWorktree } = require('./lib/state');
const { readSection } = require('./lib/config');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_SKIP = ['execute', 'commit', 'review', 'version', 'pr'];

const BUILT_IN_DEFAULTS = {
  preset: 'B',
  skip: [],
  bump: 'patch',
  draft: false,
  auto: false,
  reviewThreshold: 'high',
  workspace: 'prompt',
  rebase: true,
};

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let hasPlan   = false;
  let auto      = false;
  let skip      = null;
  let preset    = null;
  let bump      = null;
  let draft     = false;
  let dryRun    = false;
  let resume    = false;
  let workspace = null;
  let rebase    = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--has-plan') {
      hasPlan = true;
    } else if (a === '--auto') {
      auto = true;
    } else if (a === '--skip' && args[i + 1]) {
      skip = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    } else if (a === '--preset' && args[i + 1]) {
      preset = args[++i];
    } else if (a === '--bump' && args[i + 1]) {
      bump = args[++i];
    } else if (a === '--draft') {
      draft = true;
    } else if (a === '--dry-run') {
      dryRun = true;
    } else if (a === '--resume') {
      resume = true;
    } else if (a === '--workspace' && args[i + 1]) {
      workspace = args[++i];
    } else if (a === '--rebase' && args[i + 1]) {
      rebase = args[++i]; // 'auto' | 'skip' | 'prompt'
    }
  }

  return { hasPlan, auto, skip, preset, bump, draft, dryRun, resume, workspace, rebase };
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

/**
 * Read .sdlc/ship-config.json if it exists, return parsed object or null.
 * @param {string} projectRoot
 * @returns {{ config: object|null, source: string }}
 */
function loadConfig(projectRoot) {
  const result = readSection(projectRoot, 'ship');
  return result
    ? { config: result, source: '.claude/sdlc.json' }
    : { config: null, source: 'defaults' };
}

// ---------------------------------------------------------------------------
// Flag merging with source tracking
// ---------------------------------------------------------------------------

/**
 * Merge CLI flags > config > built-in defaults.
 * Returns merged values and a sources map tracking which source each value came from.
 */
function mergeFlags(cli, config) {
  const cfg = config || {};
  const merged  = {};
  const sources = {};

  // Boolean flags: CLI true overrides; otherwise config; otherwise default.
  // For booleans, CLI "wins" only if the flag was explicitly passed (true).
  // --auto, --draft are boolean flags that default to false when not passed.
  for (const key of ['auto', 'draft']) {
    if (cli[key] === true) {
      merged[key]  = true;
      sources[key] = 'cli';
    } else if (cfg[key] !== undefined) {
      merged[key]  = cfg[key];
      sources[key] = 'config';
    } else {
      merged[key]  = BUILT_IN_DEFAULTS[key];
      sources[key] = 'default';
    }
  }

  // Value flags: CLI non-null overrides; otherwise config; otherwise default.
  for (const key of ['preset', 'bump', 'workspace']) {
    if (cli[key] !== null && cli[key] !== undefined) {
      merged[key]  = cli[key];
      sources[key] = 'cli';
    } else if (cfg[key] !== undefined) {
      merged[key]  = cfg[key];
      sources[key] = 'config';
    } else {
      merged[key]  = BUILT_IN_DEFAULTS[key];
      sources[key] = 'default';
    }
  }

  // skip: CLI non-null array overrides; otherwise config; otherwise default.
  if (cli.skip !== null && cli.skip !== undefined) {
    merged.skip  = cli.skip;
    sources.skip = 'cli';
  } else if (cfg.skip !== undefined) {
    merged.skip  = Array.isArray(cfg.skip) ? cfg.skip : [];
    sources.skip = 'config';
  } else {
    merged.skip  = BUILT_IN_DEFAULTS.skip;
    sources.skip = 'default';
  }

  // reviewThreshold: not a CLI flag, comes from config or default.
  if (cfg.reviewThreshold !== undefined) {
    merged.reviewThreshold  = cfg.reviewThreshold;
    sources.reviewThreshold = 'config';
  } else {
    merged.reviewThreshold  = BUILT_IN_DEFAULTS.reviewThreshold;
    sources.reviewThreshold = 'default';
  }

  // rebase: CLI non-null string wins; otherwise map config boolean/string to
  // 'auto' | 'skip' | 'prompt'; otherwise default (true → 'auto').
  if (cli.rebase !== null && cli.rebase !== undefined) {
    merged.rebase  = cli.rebase; // already a string: 'auto' | 'skip' | 'prompt'
    sources.rebase = 'cli';
  } else if (cfg.rebase !== undefined) {
    // Config may store true/false booleans or the string "prompt"
    if (cfg.rebase === true) {
      merged.rebase = 'auto';
    } else if (cfg.rebase === false) {
      merged.rebase = 'skip';
    } else {
      merged.rebase = cfg.rebase; // "prompt" or any future string value
    }
    sources.rebase = 'config';
  } else {
    // Default is true → 'auto'
    merged.rebase  = 'auto';
    sources.rebase = 'default';
  }

  // Pass-through flags that don't come from config.
  merged.hasPlan = cli.hasPlan;
  merged.dryRun  = cli.dryRun;
  merged.resume  = cli.resume;

  return { merged, sources };
}

// ---------------------------------------------------------------------------
// Step computation
// ---------------------------------------------------------------------------

function computeSteps(flags) {
  const skipSet = new Set(flags.skip);

  const steps = [
    {
      name: 'execute',
      skill: 'execute-plan-sdlc',
      status: (!flags.hasPlan || skipSet.has('execute')) ? 'skipped' : 'will_run',
      args: [
        flags.preset ? `--preset ${flags.preset}` : '',
        flags.workspace !== 'prompt' ? `--workspace ${flags.workspace}` : '',
        flags.rebase !== 'prompt' ? `--rebase ${flags.rebase}` : '',
      ].filter(Boolean).join(' '),
      reason: !flags.hasPlan
        ? 'no plan in context'
        : skipSet.has('execute')
          ? 'in skip set'
          : 'plan detected in context',
      pause: false,
    },
    {
      name: 'commit',
      skill: 'commit-sdlc',
      status: skipSet.has('commit') ? 'skipped' : 'will_run',
      args: flags.auto ? '--auto' : '',
      reason: skipSet.has('commit') ? 'in skip set' : 'pending (will check after execute)',
      pause: false,
    },
    {
      name: 'review',
      skill: 'review-sdlc',
      status: skipSet.has('review') ? 'skipped' : 'will_run',
      args: '--committed',
      reason: skipSet.has('review') ? 'in skip set' : 'not in skip set',
      pause: false,
    },
    {
      name: 'received-review',
      skill: 'received-review-sdlc',
      status: 'conditional',
      args: '',
      reason: 'triggered by review verdict (critical/high findings)',
      pause: true,
    },
    {
      name: 'commit-fixes',
      skill: 'commit-sdlc',
      status: 'conditional',
      args: flags.auto ? '--auto' : '',
      reason: 'triggered if review fixes applied',
      pause: false,
    },
    {
      name: 'version',
      skill: 'version-sdlc',
      status: (skipSet.has('version') || flags.workspace === 'worktree') ? 'skipped' : 'will_run',
      args: [
        flags.bump || 'patch',
        flags.auto ? '--auto' : '',
      ].filter(Boolean).join(' '),
      reason: skipSet.has('version')
        ? 'in skip set'
        : flags.workspace === 'worktree'
          ? 'auto-skipped — tags are repo-global, not safe from worktrees'
          : 'not in skip set',
      pause: true,
    },
    {
      name: 'pr',
      skill: 'pr-sdlc',
      status: skipSet.has('pr') ? 'skipped' : 'will_run',
      args: [
        flags.auto ? '--auto' : '',
        flags.draft ? '--draft' : '',
      ].filter(Boolean).join(' '),
      reason: skipSet.has('pr') ? 'in skip set' : 'not in skip set',
      pause: false,
    },
  ];

  return steps;
}

// ---------------------------------------------------------------------------
// Worktree detection
// ---------------------------------------------------------------------------

/**
 * Detect whether the current process is running inside a linked (non-main) git worktree.
 * @param {string} projectRoot  The working directory to inspect (typically process.cwd())
 * @returns {{
 *   inLinkedWorktree: boolean,
 *   currentPath: string|null,
 *   mainWorktreePath: string
 * }}
 */
function detectWorktree(projectRoot) {
  let mainPath;
  try {
    mainPath = resolveMainWorktree();
  } catch (_) {
    // If git worktree list fails (e.g. very old git), assume we are in the main worktree.
    const cwd = fs.realpathSync(projectRoot);
    return { inLinkedWorktree: false, currentPath: null, mainWorktreePath: cwd };
  }

  const cwd         = fs.realpathSync(projectRoot);
  const mainResolved = fs.realpathSync(mainPath);

  return {
    inLinkedWorktree: cwd !== mainResolved,
    currentPath: cwd !== mainResolved ? cwd : null,
    mainWorktreePath: mainResolved,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function runValidation(flags, steps, context) {
  const errors   = [];
  const warnings = [];

  // gh auth must be true
  if (!context.ghAuthenticated) {
    errors.push('GitHub CLI is not authenticated. Run "gh auth login" before using ship-sdlc.');
  }

  // Current branch should not equal base branch
  const notOnDefault = context.currentBranch !== context.defaultBranch;
  if (!notOnDefault) {
    warnings.push(`You are on the default branch "${context.defaultBranch}". Ship pipelines should run on feature branches.`);
  }

  // All skip values must be recognized
  let skipValuesRecognized = true;
  for (const s of flags.skip) {
    if (!VALID_SKIP.includes(s)) {
      warnings.push(`Unrecognized skip value "${s}". Valid values: ${VALID_SKIP.join(', ')}`);
      skipValuesRecognized = false;
    }
  }

  // At least one non-conditional step must run (conditional steps only
  // fire in response to other steps, so they don't count on their own)
  const atLeastOneStepRuns = steps.some(s => s.status === 'will_run');
  if (!atLeastOneStepRuns) {
    errors.push('All steps are skipped. At least one step must run.');
  }

  // --bump without version step
  let coherentFlags = true;
  const versionStep = steps.find(s => s.name === 'version');
  if (flags.bump && versionStep && versionStep.status === 'skipped') {
    warnings.push(`--bump "${flags.bump}" specified but version step is skipped.`);
    coherentFlags = false;
  }

  // Always note conditional pause
  warnings.push('If review finds critical/high issues, pipeline will pause for fix approval');

  return {
    ghAuth: context.ghAuthenticated,
    notOnDefault,
    skipValuesRecognized,
    atLeastOneStepRuns,
    coherentFlags,
    warnings,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Resume state detection
// ---------------------------------------------------------------------------

/**
 * Look for the most recent ship state file matching the current branch.
 * @param {string} projectRoot
 * @param {string} currentBranch
 * @returns {{ stateFile: string|null, found: boolean }}
 */
function detectResumeState(projectRoot, currentBranch) {
  const execDir = path.join(projectRoot, '.sdlc', 'execution');
  if (!fs.existsSync(execDir)) {
    return { stateFile: null, found: false };
  }

  let entries;
  try {
    entries = fs.readdirSync(execDir);
  } catch (_) {
    return { stateFile: null, found: false };
  }

  // Slugify the branch name the same way a filename would be created
  const branchSlug = currentBranch.replace(/[^a-zA-Z0-9-]/g, '-');

  const matching = entries
    .filter(f => f.startsWith('ship-') && f.endsWith('.json') && f.includes(branchSlug))
    .map(f => {
      const fullPath = path.join(execDir, f);
      try {
        const stat = fs.statSync(fullPath);
        return { file: path.join('.sdlc', 'execution', f), mtime: stat.mtimeMs };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);

  if (matching.length === 0) {
    return { stateFile: null, found: false };
  }

  return { stateFile: matching[0].file, found: true };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const projectRoot = process.cwd();
  const cli = parseArgs(process.argv);

  const errors   = [];
  const warnings = [];

  // Load config
  const { config: fileConfig, source: configSource } = loadConfig(projectRoot);

  // Merge flags
  const { merged: flags, sources: flagSources } = mergeFlags(cli, fileConfig);

  // Check git state
  let gitState;
  try {
    gitState = checkGitState(projectRoot);
  } catch (err) {
    errors.push(err.message);
    output({ errors, warnings }, 1);
    return;
  }

  // Detect base branch
  let defaultBranch;
  try {
    defaultBranch = detectBaseBranch(projectRoot);
  } catch (err) {
    errors.push(err.message);
    output({ errors, warnings }, 1);
    return;
  }

  // Check gh auth
  let ghAuthenticated = false;
  let ghUser = null;
  const ghAuthOutput = exec('gh auth status 2>&1', { shell: true });
  if (ghAuthOutput !== null && /Logged in to/.test(ghAuthOutput)) {
    ghAuthenticated = true;
    const userMatch = ghAuthOutput.match(/Logged in to [^ ]+ account ([^ ]+)/);
    if (userMatch) {
      ghUser = userMatch[1];
    } else {
      // Try alternate format: "Logged in to github.com as <user>"
      const altMatch = ghAuthOutput.match(/Logged in to [^ ]+ as ([^\s(]+)/);
      if (altMatch) {
        ghUser = altMatch[1];
      }
    }
  }

  // Check OpenSpec
  const openspecDetected = fs.existsSync(path.join(projectRoot, 'openspec', 'config.yaml'));

  // Check .sdlc/ gitignore status
  // git check-ignore returns non-null (empty string) if ignored, null if not ignored
  const sdlcGitignored = exec('git check-ignore -q .sdlc/', { cwd: projectRoot }) !== null;

  // Detect worktree context
  const worktreeInfo = detectWorktree(projectRoot);

  // Build context
  const context = {
    currentBranch: gitState.currentBranch,
    defaultBranch,
    uncommittedChanges: gitState.dirtyFiles.length,
    dirtyFiles: gitState.dirtyFiles,
    ghAuthenticated,
    ghUser,
    openspecDetected,
    sdlcGitignored,
    worktree: worktreeInfo,
  };

  // Compute steps
  const steps = computeSteps(flags);

  // Run validation
  const validation = runValidation(flags, steps, context);

  // Collect validation errors/warnings into top-level arrays
  errors.push(...validation.errors);
  warnings.push(...validation.warnings);

  // Detect resume state
  const resume = detectResumeState(projectRoot, gitState.currentBranch);

  // Build config values for output
  const configValues = {};
  for (const key of Object.keys(BUILT_IN_DEFAULTS)) {
    configValues[key] = flags[key] !== undefined ? flags[key] : BUILT_IN_DEFAULTS[key];
  }

  const result = {
    errors,
    warnings,
    config: {
      source: configSource,
      values: configValues,
    },
    flags: {
      auto: flags.auto,
      preset: flags.preset,
      skip: flags.skip,
      bump: flags.bump,
      draft: flags.draft,
      dryRun: flags.dryRun,
      resume: flags.resume,
      hasPlan: flags.hasPlan,
      workspace: flags.workspace,
      rebase: flags.rebase,
      sources: flagSources,
    },
    context,
    steps,
    validation: {
      ghAuth: validation.ghAuth,
      notOnDefault: validation.notOnDefault,
      skipValuesRecognized: validation.skipValuesRecognized,
      atLeastOneStepRuns: validation.atLeastOneStepRuns,
      coherentFlags: validation.coherentFlags,
      warnings: validation.warnings,
    },
    resume,
  };

  // Exit with 1 if there are fatal errors, 0 otherwise
  const exitCode = errors.length > 0 ? 1 : 0;
  output(result, exitCode);
}

function output(data, exitCode) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  process.exit(exitCode);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`ship-prepare.js error: ${err.message}\n${err.stack}\n`);
    process.exit(2);
  }
}

module.exports = { parseArgs, computeSteps, mergeFlags, loadConfig, detectWorktree };
