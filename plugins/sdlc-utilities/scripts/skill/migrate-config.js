#!/usr/bin/env node
'use strict';

// ---------------------------------------------------------------------------
// migrate-config.js — standalone wrapper around verifyAndMigrate.
//
// Invoked by `setup-sdlc --migrate` and by setup-sdlc's migration phase.
// Calls `verifyAndMigrate(projectRoot, 'project')` then `'local'` and emits
// a JSON manifest:
//   { project: { schemaVersion, migrated, backupPath, stepsApplied },
//     local:   { ... },
//     errors:  [...] }
//
// Idempotent: re-run after success is a no-op (both calls return migrated:false).
//
// CLI: node migrate-config.js [--dry-run]
//
// Exit codes:
//   0 — success
//   1 — migration failure (schema-version too new, lock contention, step error)
//
// Implements issue #231 acceptance: --migrate dispatches this script.
// ---------------------------------------------------------------------------

const path = require('path');
const {
  verifyAndMigrate,
  ConfigVersionError,
} = require(path.resolve(__dirname, '..', 'lib', 'config-version.js'));
const { ensureSdlcInfrastructure } = require(path.resolve(__dirname, '..', 'lib', 'config.js'));

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') {
      process.stdout.write('Usage: node migrate-config.js [--dry-run]\n');
      process.exit(0);
    } else {
      process.stderr.write(`Unknown argument: ${a}\n`);
      process.exit(2);
    }
  }
  return args;
}

function main() {
  const flags = parseArgs(process.argv);
  const projectRoot = process.cwd();

  const manifest = {
    project: null,
    local: null,
    errors: [],
    dryRun: flags.dryRun,
  };

  try {
    manifest.project = verifyAndMigrate(projectRoot, 'project', { dryRun: flags.dryRun });
  } catch (err) {
    manifest.errors.push({
      role: 'project',
      step: err.step || null,
      code: err.code || 'UNKNOWN',
      message: err.message,
    });
  }

  try {
    manifest.local = verifyAndMigrate(projectRoot, 'local', { dryRun: flags.dryRun });
  } catch (err) {
    manifest.errors.push({
      role: 'local',
      step: err.step || null,
      code: err.code || 'UNKNOWN',
      message: err.message,
    });
  }

  // Layout reconciliation (gitignore, review-dimensions relocation).
  // Skipped when --dry-run to match verifyAndMigrate dry-run semantics.
  if (!flags.dryRun) {
    try {
      manifest.infrastructure = ensureSdlcInfrastructure(projectRoot);
    } catch (err) {
      manifest.errors.push({
        role: 'infrastructure',
        step: 'ensureSdlcInfrastructure',
        code: 'INFRA_FAILED',
        message: err.message,
      });
    }
  }

  process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
  process.exit(manifest.errors.length === 0 ? 0 : 1);
}

main();
