#!/usr/bin/env node
/**
 * plan-prepare.js
 * Pre-compute OpenSpec context and plan guardrails for plan-sdlc.
 * Uses lib/openspec.js for detection and lib/config.js for guardrail loading.
 *
 * Usage:
 *   node plan-prepare.js [--from-openspec <change-name>] [--output-file]
 *   node plan-prepare.js --mark <name> [--path <abs>]
 *
 * Options:
 *   --from-openspec <name>  Validate a specific OpenSpec change for direct bridging
 *   --output-file           Write JSON to temp file, print path (default: stdout)
 *   --mark <name>           Update the latest plan state file with a checkpoint marker.
 *                           Valid names: plan-file, guardrailsEvaluated, critiqueRan
 *   --path <abs>            Absolute path to the plan file (required when --mark plan-file)
 *
 * Exit codes: 0 = success, 1 = validation error, 2 = unexpected crash
 * Stdout: JSON (or file path with --output-file)
 * Stderr: warnings/progress
 *
 * Uses only Node.js built-in modules + lib/*.js. No npm install required.
 */

'use strict';

const path = require('node:path');
const LIB = path.join(__dirname, '..', 'lib');

const { detectActiveChanges, validateChange } = require(path.join(LIB, 'openspec'));
const { readSection, resolveSdlcRoot } = require(path.join(LIB, 'config'));
const { writeOutput } = require(path.join(LIB, 'output'));
const { resolveSkipConfigCheck, ensureConfigVersion } = require(path.join(LIB, 'config-version-prepare'));
const { initState, findStateFile, readState, writeState, slugifyBranch, pruneStateFiles } = require(path.join(LIB, 'state'));
const { exec } = require(path.join(LIB, 'git'));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_MARK_NAMES = ['plan-file', 'guardrailsEvaluated', 'critiqueRan'];

/**
 * Map CLI --mark name to the JSON key in planIntegrity.
 * 'plan-file' → 'planFile'; others map identity.
 */
function markerKey(name) {
  return name === 'plan-file' ? 'planFile' : name;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let fromOpenspec = null;
  let markName = null;
  let markPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from-openspec' && args[i + 1]) {
      fromOpenspec = args[++i];
    } else if (args[i] === '--mark' && args[i + 1]) {
      markName = args[++i];
    } else if (args[i] === '--path' && args[i + 1]) {
      markPath = args[++i];
    }
    // --output-file is handled by writeOutput
  }

  return { fromOpenspec, markName, markPath };
}

// ---------------------------------------------------------------------------
// --mark mode: update the latest plan state file with a checkpoint marker
// ---------------------------------------------------------------------------

function runMarkMode(markName, markPath) {
  if (!VALID_MARK_NAMES.includes(markName)) {
    process.stderr.write(
      `[plan-prepare] --mark: unknown marker name "${markName}". ` +
      `Valid names: ${VALID_MARK_NAMES.join(', ')}\n`
    );
    process.exit(1);
  }

  if (markName === 'plan-file' && !markPath) {
    process.stderr.write('[plan-prepare] --mark plan-file requires --path <abs>\n');
    process.exit(1);
  }

  const branch = exec('git branch --show-current');
  if (!branch) {
    process.stderr.write('[plan-prepare] --mark: could not determine current branch\n');
    process.exit(1);
  }

  const branchSlug = slugifyBranch(branch);
  const found = findStateFile('plan', branchSlug);
  if (!found) {
    process.stderr.write(
      `[plan-prepare] --mark: no plan state file found for branch "${branch}". ` +
      `Run plan-prepare.js --output-file first.\n`
    );
    process.exit(1);
  }

  const existing = readState('plan', branchSlug);
  const data = (existing && existing.data) ? existing.data : {};

  if (!data.planIntegrity || typeof data.planIntegrity !== 'object') {
    data.planIntegrity = {};
  }

  const key = markerKey(markName);
  data.planIntegrity[key] = new Date().toISOString();

  if (markName === 'plan-file') {
    data.planFilePath = markPath;
  }

  writeState(found.fullPath, data);
  process.stderr.write(`[plan-prepare] marker "${key}" written to ${found.fullPath}\n`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { fromOpenspec, markName, markPath } = parseArgs(process.argv);

  // --mark mode: short-circuit before normal prepare flow
  if (markName !== null) {
    runMarkMode(markName, markPath);
    return; // runMarkMode calls process.exit(); this is a safeguard
  }

  const projectRoot = resolveSdlcRoot(); // issue #351: route to main worktree .sdlc/
  const errors = [];

  // Issue #232: verifyAndMigrate gate (CLI > env > default false).
  const skipConfigCheck = resolveSkipConfigCheck(process.argv);
  const cv = ensureConfigVersion(projectRoot, { skip: skipConfigCheck, roles: ['project'] });
  if (cv.errors.length > 0) {
    for (const e of cv.errors) errors.push(`config-version: ${e.role}: ${e.message}`);
    writeOutput({ errors, flags: { skipConfigCheck }, migration: cv.migration }, 'plan-prepare', 1);
    return;
  }

  // Write skillInvoked marker (R20) — plan-sdlc was invoked (issue #285).
  // Done early so the marker is present even if later steps fail.
  // Prune prior plan markers for this branch before writing a new one (issue #334):
  // ensures at most one plan-<branchSlug>-*.json exists per branch.
  try {
    const branch = exec('git branch --show-current');
    if (branch) {
      pruneStateFiles('plan', slugifyBranch(branch));
      initState('plan', branch, {
        planIntegrity: { skillInvoked: new Date().toISOString() },
      });
    }
  } catch (_) {
    // Non-fatal: marker write failures must not block prepare output.
  }

  // 1. OpenSpec detection
  const openspec = detectActiveChanges(projectRoot);

  // Add authoritative evidence when OpenSpec is present
  if (openspec.present) {
    openspec.authoritative = {
      path: 'openspec/config.yaml',
      specsCount: openspec.specsCount,
    };
  }

  // 2. --from-openspec validation
  let fromOpenspecResult = null;
  if (fromOpenspec) {
    const validation = validateChange(projectRoot, fromOpenspec);
    fromOpenspecResult = {
      valid: validation.valid,
      changeName: fromOpenspec,
      hasProposal: validation.hasProposal,
      deltaSpecCount: validation.deltaSpecCount,
      hasDesign: validation.hasDesign,
      hasTasks: validation.hasTasks,
      tasksDone: validation.tasksDone,
      tasksTotal: validation.tasksTotal,
      stage: validation.stage,
    };

    if (!validation.valid) {
      for (const err of validation.errors) {
        if (!err.startsWith('Warning:')) {
          errors.push(err);
        }
      }
    }
  }

  // 3. Guardrail loading from plan config section
  let guardrails = [];
  try {
    const planConfig = readSection(projectRoot, 'plan');
    if (planConfig && Array.isArray(planConfig.guardrails)) {
      guardrails = planConfig.guardrails;
    }
  } catch (err) {
    errors.push(`Failed to read plan config: ${err.message}`);
  }

  // 4. Output
  const output = {
    openspec,
    fromOpenspec: fromOpenspecResult,
    guardrails,
    errors,
  };

  writeOutput(output, 'plan-prepare', errors.length > 0 ? 1 : 0);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`plan-prepare.js error: ${err.message}\n${err.stack}\n`);
    process.exit(2);
  }
}

module.exports = { main };
