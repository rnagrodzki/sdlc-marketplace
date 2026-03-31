#!/usr/bin/env node
/**
 * ship-init.js
 * Deterministically creates the .sdlc/ directory structure and config file.
 * The LLM runs the interactive walkthrough, then calls this script with
 * the collected answers as flags.
 *
 * Usage:
 *   node ship-init.js [options]
 *
 * Options:
 *   --preset A|B|C              Pipeline preset (default: B)
 *   --skip <csv>                Comma-separated steps to skip (default: empty)
 *   --bump patch|minor|major    Version bump type (default: patch)
 *   --draft                     Mark PR as draft (default: false)
 *   --auto                      Skip interactive approval prompts (default: false)
 *   --threshold critical|high|medium  Review threshold (default: high)
 *   --workspace branch|worktree|prompt  Workspace isolation mode (default: prompt)
 *
 * Exit codes:
 *   0 = success, JSON on stdout
 *   1 = validation error, JSON with non-empty errors[] on stdout
 *   2 = unexpected script crash, message on stderr
 *
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { readSection, writeSection } = require('./lib/config');
const { writeOutput } = require('./lib/output');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let preset    = 'B';
  let skip      = [];
  let bump      = 'patch';
  let draft     = false;
  let auto      = false;
  let threshold = 'high';
  let workspace = 'prompt';
  const warnings = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--preset' && args[i + 1]) {
      preset = args[++i];
    } else if (a === '--skip' && args[i + 1]) {
      skip = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    } else if (a === '--bump' && args[i + 1]) {
      bump = args[++i];
    } else if (a === '--draft') {
      draft = true;
    } else if (a === '--auto') {
      auto = true;
    } else if (a === '--threshold' && args[i + 1]) {
      threshold = args[++i];
    } else if (a === '--workspace' && args[i + 1]) {
      workspace = args[++i];
    }
  }

  return { preset, skip, bump, draft, auto, threshold, workspace, warnings };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_PRESETS   = ['A', 'B', 'C'];
const VALID_BUMPS     = ['patch', 'minor', 'major'];
const VALID_THRESHOLD = ['critical', 'high', 'medium'];
const VALID_WORKSPACE = ['branch', 'worktree', 'prompt'];
const VALID_SKIP      = ['execute', 'commit', 'review', 'version', 'pr'];

function validate(parsed) {
  const errors = [];

  if (!VALID_PRESETS.includes(parsed.preset)) {
    errors.push(`--preset must be one of: ${VALID_PRESETS.join(', ')}. Got: "${parsed.preset}"`);
  }

  if (!VALID_BUMPS.includes(parsed.bump)) {
    errors.push(`--bump must be one of: ${VALID_BUMPS.join(', ')}. Got: "${parsed.bump}"`);
  }

  if (!VALID_THRESHOLD.includes(parsed.threshold)) {
    errors.push(`--threshold must be one of: ${VALID_THRESHOLD.join(', ')}. Got: "${parsed.threshold}"`);
  }

  if (!VALID_WORKSPACE.includes(parsed.workspace)) {
    errors.push(`--workspace must be one of: ${VALID_WORKSPACE.join(', ')}. Got: "${parsed.workspace}"`);
  }

  for (const step of parsed.skip) {
    if (!VALID_SKIP.includes(step)) {
      errors.push(`--skip contains invalid step "${step}". Valid values: ${VALID_SKIP.join(', ')}`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const projectRoot = process.cwd();
  const { preset, skip, bump, draft, auto, threshold, workspace, warnings: parseWarnings } = parseArgs(process.argv);

  const errors   = [];
  const warnings = [...parseWarnings];

  // Validate inputs
  const validationErrors = validate({ preset, skip, bump, draft, auto, threshold, workspace });
  if (validationErrors.length > 0) {
    errors.push(...validationErrors);
    writeOutput({ errors, warnings }, 'ship-init', 1);
    return;
  }

  const sdlcDir = path.join(projectRoot, '.sdlc');

  // Create .sdlc/ directory
  fs.mkdirSync(sdlcDir, { recursive: true });

  // Write .sdlc/.gitignore — skip if already exists
  const gitignorePath = path.join(sdlcDir, '.gitignore');
  let gitignoreAction;
  if (fs.existsSync(gitignorePath)) {
    gitignoreAction = 'existed';
    warnings.push('.sdlc/.gitignore already exists — skipped');
  } else {
    fs.writeFileSync(gitignorePath, '*\n!.gitignore\n', 'utf8');
    gitignoreAction = 'created';
  }

  // Build config object (no $schema or version — handled by unified config system)
  const config = {
    preset,
    skip,
    bump,
    draft,
    auto,
    reviewThreshold:  threshold,
    workspace,
  };

  // Write ship section via unified config — warn if overwriting existing ship section
  const existingShip = readSection(projectRoot, 'ship');
  let configAction;
  if (existingShip) {
    warnings.push('Overwriting existing ship config');
    configAction = 'overwritten';
  } else {
    configAction = 'created';
  }

  writeSection(projectRoot, 'ship', config);

  const result = {
    errors,
    warnings,
    created: {
      directory: '.sdlc/',
      gitignore: { path: '.sdlc/.gitignore', action: gitignoreAction },
      config:    { path: '.sdlc/local.json', action: configAction },
    },
    config,
  };

  writeOutput(result, 'ship-init', 0);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`ship-init.js error: ${err.message}\n${err.stack}\n`);
    process.exit(2);
  }
}

module.exports = { parseArgs, validate };
