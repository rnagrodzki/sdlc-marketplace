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
 *   --steps <csv>           Comma-separated steps to run (overrides config)
 *   --quality full|balanced|minimal  Forwarded to execute-plan-sdlc as --quality (only when explicitly passed)
 *   --bump patch|minor|major  Version bump type
 *   --draft                 Mark PR as draft
 *   --dry-run               Print plan without executing
 *   --resume                Resume from last checkpoint
 *   --workspace branch|worktree|prompt  Workspace isolation mode
 *
 * Removed (legacy CLI sugar — passing these now produces a hard error):
 *   --preset                Use --steps <csv> instead.
 *   --skip                  Use --steps <csv> with the desired steps listed instead.
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

const { exec, checkGitState, detectBaseBranch } = require(path.join(LIB, 'git'));
const { resolveMainWorktree } = require(path.join(LIB, 'state'));
const { readSection } = require(path.join(LIB, 'config'));
const { writeOutput } = require(path.join(LIB, 'output'));
const { VALID_STEPS, BUILT_IN_DEFAULTS, CANONICAL_STEPS } = require(path.join(LIB, 'ship-fields'));
const { detectActiveChanges, isArchived } = require(path.join(LIB, 'openspec'));
const { getAdvisory } = require(path.join(LIB, 'context-advisory'));

const VALID_QUALITY = ['full', 'balanced', 'minimal'];

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let hasPlan   = false;
  let auto      = false;
  let steps     = null;
  let quality   = null;
  let bump      = null;
  let draft     = false;
  let dryRun    = false;
  let resume    = false;
  let workspace       = null;
  let rebase          = null;
  let openspecChange  = null;
  const errors = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--has-plan') {
      hasPlan = true;
    } else if (a === '--auto') {
      auto = true;
    } else if (a === '--steps' && args[i + 1]) {
      steps = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    } else if (a === '--quality' && args[i + 1]) {
      quality = args[++i];
    } else if (a === '--preset') {
      // Hard-removed: --preset is no longer accepted (#190). Consume the
      // following value (if any) so it doesn't get parsed as a positional.
      if (args[i + 1] && !args[i + 1].startsWith('--')) i++;
      errors.push('--preset is no longer accepted by ship-sdlc. Use --steps <csv> to control which steps run, or --quality <full|balanced|minimal> to set the model tier forwarded to execute-plan-sdlc.');
    } else if (a === '--skip') {
      if (args[i + 1] && !args[i + 1].startsWith('--')) i++;
      errors.push('--skip is no longer accepted by ship-sdlc. Use --steps <csv> with the desired steps listed instead.');
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
    } else if (a === '--openspec-change' && args[i + 1]) {
      openspecChange = args[++i];
    }
  }

  return { hasPlan, auto, steps, quality, bump, draft, dryRun, resume, workspace, rebase, openspecChange, errors };
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

/**
 * Read ship config from .sdlc/local.json if it exists, return parsed object or null.
 * @param {string} projectRoot
 * @returns {{ config: object|null, source: string }}
 */
function loadConfig(projectRoot) {
  const result = readSection(projectRoot, 'ship');
  return result
    ? { config: result, source: '.sdlc/local.json' }
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

  // Value flags
  for (const key of ['bump', 'workspace']) {
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

  // -- Step resolution --
  //
  // Single source of truth: `ship.steps[]`. Resolution order:
  //   1. CLI --steps (one-shot override; fully replaces resolved list)
  //   2. config.steps from .sdlc/local.json
  //   3. BUILT_IN_DEFAULTS.steps
  //
  // No --preset/--skip override paths exist (#190 — hard-removed).
  let stepsList;
  let stepsSource;
  if (Array.isArray(cli.steps) && cli.steps.length > 0) {
    stepsList   = cli.steps.slice();
    stepsSource = 'cli';
  } else if (Array.isArray(cfg.steps)) {
    stepsList   = cfg.steps.slice();
    stepsSource = 'config';
  } else {
    stepsList   = BUILT_IN_DEFAULTS.steps.slice();
    stepsSource = 'default';
  }

  merged.steps  = stepsList;
  sources.steps = stepsSource;

  // -- Quality (model tier forwarded to execute-plan-sdlc) --
  //
  // Only emitted when CLI explicitly passed --quality. When absent, ship does
  // not forward the flag and execute-plan-sdlc applies its own selection
  // logic (interactive prompt or its own config default).
  if (cli.quality !== null && cli.quality !== undefined) {
    merged.quality  = cli.quality;
    sources.quality = 'cli';
  }
  // Otherwise: no merged.quality / no sources.quality — intentionally absent.

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
  merged.hasPlan        = cli.hasPlan;
  merged.dryRun         = cli.dryRun;
  merged.resume         = cli.resume;
  merged.openspecChange = cli.openspecChange || null;

  return { merged, sources };
}

// ---------------------------------------------------------------------------
// Step computation
// ---------------------------------------------------------------------------

function computeSteps(flags, flagSources, { openspecContext } = {}) {
  // Steps[] is the canonical source of truth for which top-level steps run.
  // A step IS skipped when it is NOT in flags.steps. The provenance for an
  // exclusion is whatever determined the resolved steps[] (cli --steps /
  // config / built-in default).
  const stepsSet = new Set(Array.isArray(flags.steps) ? flags.steps : []);

  // Derive the skipSource for a given step name. Convention preserved for
  // downstream consumers (state files, hooks, learnings).
  function skipSource(name) {
    if (stepsSet.has(name)) return 'none';
    const src = flagSources && flagSources.steps;
    if (src === 'cli')    return 'cli';
    if (src === 'config') return 'config';
    return 'default';
  }

  const isIn = (name) => stepsSet.has(name);

  const steps = [
    {
      name: 'execute',
      skill: 'execute-plan-sdlc',
      model: 'opus',
      status: (!flags.hasPlan || !isIn('execute')) ? 'skipped' : 'will_run',
      skipSource: !flags.hasPlan && isIn('execute')
        ? 'none'
        : !flags.hasPlan
          ? 'condition'
          : skipSource('execute'),
      args: [
        // Forward --quality to execute-plan-sdlc only when the user
        // explicitly passed --quality to ship. Otherwise execute-plan-sdlc
        // applies its own selection logic (interactive or its own default).
        flags.quality ? `--quality ${flags.quality}` : '',
        flags.workspace !== 'prompt' ? `--workspace ${flags.workspace}` : '',
        flags.rebase !== 'prompt' ? `--rebase ${flags.rebase}` : '',
      ].filter(Boolean).join(' '),
      reason: !flags.hasPlan
        ? 'no plan in context'
        : !isIn('execute')
          ? 'not in steps[]'
          : 'plan detected in context',
      pause: false,
    },
    {
      name: 'commit',
      skill: 'commit-sdlc',
      model: 'haiku',
      status: isIn('commit') ? 'will_run' : 'skipped',
      skipSource: skipSource('commit'),
      args: flags.auto ? '--auto' : '',
      reason: isIn('commit') ? 'pending (will check after execute)' : 'not in steps[]',
      pause: false,
    },
    {
      name: 'review',
      skill: 'review-sdlc',
      model: 'sonnet',
      status: isIn('review') ? 'will_run' : 'skipped',
      skipSource: skipSource('review'),
      args: '--committed',
      reason: isIn('review') ? 'in steps[]' : 'not in steps[]',
      pause: false,
    },
    {
      name: 'received-review',
      skill: 'received-review-sdlc',
      model: 'sonnet',
      status: 'conditional',
      skipSource: 'none',
      args: flags.auto ? '--auto' : '',
      reason: 'triggered by review verdict (critical/high findings)',
      pause: true,
    },
    {
      name: 'commit-fixes',
      skill: 'commit-sdlc',
      model: 'haiku',
      status: 'conditional',
      skipSource: 'none',
      args: flags.auto ? '--auto' : '',
      reason: 'triggered if review fixes applied',
      pause: false,
    },
    // archive-openspec: conditional step between commit-fixes and version
    (() => {
      const oc = openspecContext || {};
      const changeName = flags.openspecChange || oc.branchMatch || null;
      const archiveActionable = changeName && !oc.isAlreadyArchived;

      if (!isIn('archive-openspec')) {
        return {
          name: 'archive-openspec',
          skill: null,
          model: 'haiku',
          status: 'skipped',
          skipSource: skipSource('archive-openspec'),
          args: '',
          reason: 'not in steps[]',
          pause: false,
        };
      }
      if (!archiveActionable) {
        return {
          name: 'archive-openspec',
          skill: null,
          model: 'haiku',
          status: 'skipped',
          skipSource: 'condition',
          args: '',
          reason: !changeName
            ? 'no matching openspec change for current branch'
            : 'change already archived',
          pause: false,
        };
      }
      return {
        name: 'archive-openspec',
        skill: null,
        model: 'haiku',
        status: 'conditional',
        skipSource: 'none',
        args: `--change ${changeName}${flags.auto ? ' --auto' : ''}`,
        reason: `openspec change "${changeName}" ready for archive`,
        pause: !flags.auto,
      };
    })(),
    {
      name: 'version',
      skill: 'version-sdlc',
      model: 'sonnet',
      status: (!isIn('version') || flags.workspace === 'worktree') ? 'skipped' : 'will_run',
      skipSource: !isIn('version')
        ? skipSource('version')
        : flags.workspace === 'worktree'
          ? 'auto'
          : 'none',
      args: [
        flags.bump || 'patch',
        flags.auto ? '--auto' : '',
      ].filter(Boolean).join(' '),
      reason: !isIn('version')
        ? 'not in steps[]'
        : flags.workspace === 'worktree'
          ? 'auto-skipped — tags are repo-global, not safe from worktrees'
          : 'in steps[]',
      pause: true,
    },
    {
      name: 'pr',
      skill: 'pr-sdlc',
      model: 'sonnet',
      status: isIn('pr') ? 'will_run' : 'skipped',
      skipSource: skipSource('pr'),
      args: [
        flags.auto ? '--auto' : '',
        flags.draft ? '--draft' : '',
        flags.workspace === 'worktree' ? '--label skip-version-check' : '',
      ].filter(Boolean).join(' '),
      reason: !isIn('pr')
        ? 'not in steps[]'
        : flags.workspace === 'worktree'
          ? 'in steps[]; --label skip-version-check added (version auto-skipped)'
          : 'in steps[]',
      pause: false,
    },
  ];

  for (const step of steps) {
    step.invocation = step.args
      ? `skill: "${step.skill}", args: "${step.args}"`
      : `skill: "${step.skill}"`;
  }

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

function runValidation(flags, flagSources, steps, context) {
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

  // All steps[] values must be recognized; CLI --steps unrecognized values
  // are errors (the user passed something invalid). Config-sourced unknowns
  // remain warnings to avoid breaking pre-existing configs that drift.
  let stepValuesRecognized = true;
  if (Array.isArray(flags.steps)) {
    for (const s of flags.steps) {
      if (!VALID_STEPS.includes(s)) {
        if (flagSources.steps === 'cli') {
          errors.push(`Unrecognized step "${s}" in --steps. Valid values: ${VALID_STEPS.join(', ')}`);
          stepValuesRecognized = false;
        } else {
          warnings.push(`Unrecognized step "${s}" in steps[]. Valid values: ${VALID_STEPS.join(', ')}`);
        }
      }
    }
  }

  // Validate --quality value when forwarded
  if (flags.quality !== undefined && !VALID_QUALITY.includes(flags.quality)) {
    errors.push(`Invalid --quality "${flags.quality}". Valid values: ${VALID_QUALITY.join(', ')}`);
  }

  // At least one non-conditional step must run (conditional steps only
  // fire in response to other steps, so they don't count on their own)
  const atLeastOneStepRuns = steps.some(s => s.status === 'will_run');
  if (!atLeastOneStepRuns) {
    errors.push('All steps are skipped. At least one step must run.');
  }

  // --bump without version step (only error when user explicitly set bump on
  // the CLI — config-level/default bump is just a no-op when version is
  // excluded from steps[]).
  let coherentFlags = true;
  const versionStep = steps.find(s => s.name === 'version');
  if (flags.bump && flagSources.bump === 'cli' && versionStep && versionStep.status === 'skipped') {
    errors.push(`--bump "${flags.bump}" specified but version step is skipped — resolve by removing --bump or adding "version" to ship.steps[].`);
    coherentFlags = false;
  }

  // Always note conditional pause
  warnings.push('If review finds critical/high issues, pipeline will pause for fix approval');

  return {
    ghAuth: context.ghAuthenticated,
    notOnDefault,
    stepValuesRecognized,
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

  // Surface argument-parsing errors first (legacy --preset/--skip rejection).
  if (Array.isArray(cli.errors) && cli.errors.length > 0) {
    errors.push(...cli.errors);
  }

  // Load config
  const { config: fileConfig, source: configSource } = loadConfig(projectRoot);

  // Merge flags
  const { merged: flags, sources: flagSources } = mergeFlags(cli, fileConfig);

  // Auto mode: override workspace default/config from 'prompt' to 'branch'
  if (flags.auto && flags.workspace === 'prompt' && flagSources.workspace !== 'cli') {
    flags.workspace = 'branch';
    flagSources.workspace = `${flagSources.workspace} (auto)`;
  }

  // Check git state
  let gitState;
  try {
    gitState = checkGitState(projectRoot);
  } catch (err) {
    errors.push(err.message);
    writeOutput({ errors, warnings }, 'ship-prepare', 1);
    return;
  }

  // Detect base branch
  let defaultBranch;
  try {
    defaultBranch = detectBaseBranch(projectRoot);
  } catch (err) {
    errors.push(err.message);
    writeOutput({ errors, warnings }, 'ship-prepare', 1);
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

  // Check OpenSpec (use shared lib for consistent detection)
  const openspecResult = detectActiveChanges(projectRoot);
  const openspecDetected = openspecResult.present;
  const openspecAuthoritative = openspecResult.present
    ? { path: 'openspec/config.yaml', specsCount: openspecResult.specsCount }
    : null;

  // Check .sdlc/ gitignore status
  // git check-ignore returns non-null (empty string) if ignored, null if not ignored.
  // Also detect .sdlc/.gitignore (self-ignoring pattern created by setup-sdlc).
  const sdlcGitignored =
    exec('git check-ignore -q .sdlc/', { cwd: projectRoot }) !== null ||
    fs.existsSync(path.join(projectRoot, '.sdlc', '.gitignore'));

  // Detect worktree context
  const worktreeInfo = detectWorktree(projectRoot);

  // Compute openspec archive actionability
  const openspecBranchMatch = openspecResult.branchMatch || null;
  const openspecChangeName  = flags.openspecChange || openspecBranchMatch;
  const openspecIsArchived  = openspecChangeName
    ? isArchived(projectRoot, openspecChangeName)
    : false;

  // Build context
  const context = {
    currentBranch: gitState.currentBranch,
    defaultBranch,
    uncommittedChanges: gitState.dirtyFiles.length,
    dirtyFiles: gitState.dirtyFiles,
    ghAuthenticated,
    ghUser,
    openspecDetected,
    openspecAuthoritative,
    openspecBranchMatch,
    openspecArchiveActionable: !!(openspecChangeName && !openspecIsArchived),
    sdlcGitignored,
    worktree: worktreeInfo,
  };

  // Compute steps (pass openspec context for archive-openspec step)
  const openspecContext = {
    branchMatch: openspecBranchMatch,
    isAlreadyArchived: openspecIsArchived,
  };
  const steps = computeSteps(flags, flagSources, { openspecContext });

  // Run validation
  const validation = runValidation(flags, flagSources, steps, context);

  // Collect validation errors/warnings into top-level arrays
  errors.push(...validation.errors);
  warnings.push(...validation.warnings);

  // Detect resume state
  const resume = detectResumeState(projectRoot, gitState.currentBranch);

  // Context-heaviness advisory (implements R35) — sourced from the sidecar
  // written by hooks/context-stats.js on UserPromptSubmit. Returns null when
  // the sidecar is missing, malformed, or transcript is below the heavy
  // threshold. Surfaced verbatim by SKILL.md Step 1c when non-null.
  const contextAdvisory = getAdvisory({ skill: 'ship-sdlc' });

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
      steps: flags.steps,
      // quality is included only when explicitly passed via CLI (forwarded to
      // execute-plan-sdlc as --quality); absent otherwise so downstream
      // consumers can rely on `flags.quality === undefined` to detect "user
      // did not specify".
      ...(flags.quality !== undefined ? { quality: flags.quality } : {}),
      bump: flags.bump,
      draft: flags.draft,
      dryRun: flags.dryRun,
      resume: flags.resume,
      hasPlan: flags.hasPlan,
      workspace: flags.workspace,
      rebase: flags.rebase,
      openspecChange: flags.openspecChange,
      sources: flagSources,
    },
    context,
    steps,
    validation: {
      ghAuth: validation.ghAuth,
      notOnDefault: validation.notOnDefault,
      stepValuesRecognized: validation.stepValuesRecognized,
      atLeastOneStepRuns: validation.atLeastOneStepRuns,
      coherentFlags: validation.coherentFlags,
      warnings: validation.warnings,
    },
    resume,
    contextAdvisory,
  };

  // Exit with 1 if there are fatal errors, 0 otherwise
  const exitCode = errors.length > 0 ? 1 : 0;
  writeOutput(result, 'ship-prepare', exitCode);
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
