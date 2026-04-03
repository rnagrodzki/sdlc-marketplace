#!/usr/bin/env node
/**
 * plan-prepare.js
 * Pre-compute OpenSpec context and plan guardrails for plan-sdlc.
 * Uses lib/openspec.js for detection and lib/config.js for guardrail loading.
 *
 * Usage:
 *   node plan-prepare.js [--from-openspec <change-name>] [--output-file]
 *
 * Options:
 *   --from-openspec <name>  Validate a specific OpenSpec change for direct bridging
 *   --output-file           Write JSON to temp file, print path (default: stdout)
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
const { readSection } = require(path.join(LIB, 'config'));
const { writeOutput } = require(path.join(LIB, 'output'));

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let fromOpenspec = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from-openspec' && args[i + 1]) {
      fromOpenspec = args[++i];
    }
    // --output-file is handled by writeOutput
  }

  return { fromOpenspec };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { fromOpenspec } = parseArgs(process.argv);
  const projectRoot = process.cwd();
  const errors = [];

  // 1. OpenSpec detection
  const openspec = detectActiveChanges(projectRoot);

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
