#!/usr/bin/env node
/**
 * setup-init.js
 * Deterministically creates the .sdlc/ directory structure and config files.
 * The LLM runs the interactive walkthrough, then calls this script with
 * the collected answers as flags.
 *
 * Usage:
 *   node setup-init.js [options]
 *
 * Options:
 *   --project-config '<json>'  JSON object for .claude/sdlc.json sections
 *   --local-config '<json>'    JSON object for .sdlc/local.json sections
 *   --output-file              Write JSON to temp file (path on stdout)
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
const LIB = path.join(__dirname, '..', 'lib');

const {
  readProjectConfig,
  readLocalConfig,
  writeProjectConfig,
  writeLocalConfig,
  ensureSdlcGitignore,
} = require(path.join(LIB, 'config'));
const { writeOutput } = require(path.join(LIB, 'output'));

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let projectConfig = null;
  let localConfig   = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--project-config' && args[i + 1]) {
      projectConfig = args[++i];
    } else if (a === '--local-config' && args[i + 1]) {
      localConfig = args[++i];
    }
  }

  return { projectConfig, localConfig };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validate(parsed) {
  const errors = [];

  if (parsed.projectConfig !== null) {
    try {
      JSON.parse(parsed.projectConfig);
    } catch (e) {
      errors.push(`--project-config is not valid JSON: ${e.message}`);
    }
  }

  if (parsed.localConfig !== null) {
    try {
      JSON.parse(parsed.localConfig);
    } catch (e) {
      errors.push(`--local-config is not valid JSON: ${e.message}`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const projectRoot = process.cwd();
  const cli = parseArgs(process.argv);

  const errors   = [];
  const warnings = [];

  // Validate inputs
  const validationErrors = validate(cli);
  if (validationErrors.length > 0) {
    errors.push(...validationErrors);
    writeOutput({ errors, warnings }, 'setup-init', 1);
    return;
  }

  // 1. Create .sdlc/ directory and .gitignore
  const gitignoreAction = ensureSdlcGitignore(projectRoot);
  if (gitignoreAction === 'existed') {
    warnings.push('.sdlc/.gitignore already exists — skipped');
  }

  // 2. Write project config (.claude/sdlc.json) if sections provided
  let projectConfigAction = 'skipped';
  if (cli.projectConfig !== null) {
    const config = JSON.parse(cli.projectConfig);
    if (Object.keys(config).length > 0) {
      const existing = readProjectConfig(projectRoot);
      projectConfigAction = existing.config ? 'overwritten' : 'created';
      writeProjectConfig(projectRoot, config);
    }
  }

  // 3. Write local config (.sdlc/local.json) if sections provided
  let localConfigAction = 'skipped';
  if (cli.localConfig !== null) {
    const config = JSON.parse(cli.localConfig);
    if (Object.keys(config).length > 0) {
      const existing = readLocalConfig(projectRoot);
      localConfigAction = existing.config ? 'overwritten' : 'created';
      writeLocalConfig(projectRoot, config);
    }
  }

  const result = {
    errors,
    warnings,
    created: {
      directory: '.sdlc/',
      gitignore:     { path: '.sdlc/.gitignore',  action: gitignoreAction },
      projectConfig: { path: '.claude/sdlc.json',  action: projectConfigAction },
      localConfig:   { path: '.sdlc/local.json',   action: localConfigAction },
    },
  };

  writeOutput(result, 'setup-init', 0);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`setup-init.js error: ${err.message}\n${err.stack}\n`);
    process.exit(2);
  }
}

module.exports = { parseArgs, validate };
