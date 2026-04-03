#!/usr/bin/env node
/**
 * ship-state.js
 * CLI wrapper for managing ship-sdlc execution state files.
 * Delegates all I/O to lib/state.js; zero npm dependencies.
 *
 * Usage:
 *   node ship-state.js init     --branch <b> --flags <json>
 *   node ship-state.js start    --step <name>
 *   node ship-state.js complete --step <name> --result <text>
 *   node ship-state.js skip     --step <name> --reason <text>
 *   node ship-state.js fail     --step <name> --error <text>
 *   node ship-state.js decide   --step <name> --text <text>
 *   node ship-state.js defer    --severity <s> --file <f> [--line <n>] --title <t>
 *   node ship-state.js read     [--branch <b>]
 *   node ship-state.js cleanup  [--branch <b>]
 *
 * Exit codes:
 *   0 = success
 *   1 = state file not found (read/cleanup) or step not found
 *   2 = unexpected error
 */

'use strict';

const path = require('node:path');
const LIB = path.join(__dirname, '..', 'lib');

const { slugifyBranch, readState, writeState, initState, deleteState, resolveBranch } = require(path.join(LIB, 'state'));

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { subcommand: args[0] || null };

  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--branch' && args[i + 1]) {
      result.branch = args[++i];
    } else if (a === '--flags' && args[i + 1]) {
      result.flags = args[++i];
    } else if (a === '--step' && args[i + 1]) {
      result.step = args[++i];
    } else if (a === '--result' && args[i + 1]) {
      result.result = args[++i];
    } else if (a === '--reason' && args[i + 1]) {
      result.reason = args[++i];
    } else if (a === '--error' && args[i + 1]) {
      result.error = args[++i];
    } else if (a === '--text' && args[i + 1]) {
      result.text = args[++i];
    } else if (a === '--severity' && args[i + 1]) {
      result.severity = args[++i];
    } else if (a === '--file' && args[i + 1]) {
      result.file = args[++i];
    } else if (a === '--line' && args[i + 1]) {
      result.line = args[++i];
    } else if (a === '--title' && args[i + 1]) {
      result.title = args[++i];
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Branch resolution
// ---------------------------------------------------------------------------

function resolveBranchOrExit(argBranch) {
  try {
    return resolveBranch(argBranch);
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

function cmdInit(opts) {
  if (!opts.branch) {
    process.stderr.write('Error: --branch is required for init\n');
    process.exit(2);
  }

  let flags;
  try {
    flags = opts.flags ? JSON.parse(opts.flags) : {};
  } catch (e) {
    process.stderr.write(`Error: --flags is not valid JSON: ${e.message}\n`);
    process.exit(2);
  }

  const data = {
    version: 1,
    startedAt: new Date().toISOString(),
    branch: opts.branch,
    flags,
    steps: [
      { name: 'execute',         status: 'pending' },
      { name: 'commit',          status: 'pending' },
      { name: 'review',          status: 'pending' },
      { name: 'received-review', status: 'pending', condition: 'if critical/high findings' },
      { name: 'commit-fixes',    status: 'pending', condition: 'if received-review made changes' },
      { name: 'version',         status: 'pending' },
      { name: 'pr',              status: 'pending' },
    ],
    decisions: [],
    deferredFindings: [],
  };

  try {
    const filePath = initState('ship', opts.branch, data);
    process.stdout.write(filePath + '\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    process.exit(2);
  }
}

function cmdStart(opts) {
  if (!opts.step) {
    process.stderr.write('Error: --step is required\n');
    process.exit(2);
  }

  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('ship', slug);
  if (!found) {
    process.stderr.write(`Error: no state file found for branch "${branch}"\n`);
    process.exit(1);
  }

  const { data, filePath } = found;
  const step = data.steps.find(s => s.name === opts.step);
  if (!step) {
    process.stderr.write(`Error: step "${opts.step}" not found\n`);
    process.exit(1);
  }

  step.status = 'in_progress';
  step.startedAt = new Date().toISOString();

  writeState(filePath, data);
  process.exit(0);
}

function cmdComplete(opts) {
  if (!opts.step) {
    process.stderr.write('Error: --step is required\n');
    process.exit(2);
  }

  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('ship', slug);
  if (!found) {
    process.stderr.write(`Error: no state file found for branch "${branch}"\n`);
    process.exit(1);
  }

  const { data, filePath } = found;
  const step = data.steps.find(s => s.name === opts.step);
  if (!step) {
    process.stderr.write(`Error: step "${opts.step}" not found\n`);
    process.exit(1);
  }

  step.status = 'completed';
  step.completedAt = new Date().toISOString();
  if (opts.result !== undefined) step.result = opts.result;

  writeState(filePath, data);
  process.exit(0);
}

function cmdSkip(opts) {
  if (!opts.step) {
    process.stderr.write('Error: --step is required\n');
    process.exit(2);
  }

  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('ship', slug);
  if (!found) {
    process.stderr.write(`Error: no state file found for branch "${branch}"\n`);
    process.exit(1);
  }

  const { data, filePath } = found;
  const step = data.steps.find(s => s.name === opts.step);
  if (!step) {
    process.stderr.write(`Error: step "${opts.step}" not found\n`);
    process.exit(1);
  }

  step.status = 'skipped';
  step.completedAt = new Date().toISOString();
  if (opts.reason !== undefined) step.reason = opts.reason;

  writeState(filePath, data);
  process.exit(0);
}

function cmdFail(opts) {
  if (!opts.step) {
    process.stderr.write('Error: --step is required\n');
    process.exit(2);
  }

  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('ship', slug);
  if (!found) {
    process.stderr.write(`Error: no state file found for branch "${branch}"\n`);
    process.exit(1);
  }

  const { data, filePath } = found;
  const step = data.steps.find(s => s.name === opts.step);
  if (!step) {
    process.stderr.write(`Error: step "${opts.step}" not found\n`);
    process.exit(1);
  }

  step.status = 'failed';
  if (opts.error !== undefined) step.error = opts.error;

  writeState(filePath, data);
  process.exit(0);
}

function cmdDecide(opts) {
  if (!opts.step) {
    process.stderr.write('Error: --step is required\n');
    process.exit(2);
  }

  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('ship', slug);
  if (!found) {
    process.stderr.write(`Error: no state file found for branch "${branch}"\n`);
    process.exit(1);
  }

  const { data, filePath } = found;
  if (!Array.isArray(data.decisions)) data.decisions = [];
  data.decisions.push({ step: opts.step, decision: opts.text || '' });

  writeState(filePath, data);
  process.exit(0);
}

function cmdDefer(opts) {
  if (!opts.severity || !opts.file || !opts.title) {
    process.stderr.write('Error: --severity, --file, and --title are required\n');
    process.exit(2);
  }

  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('ship', slug);
  if (!found) {
    process.stderr.write(`Error: no state file found for branch "${branch}"\n`);
    process.exit(1);
  }

  const { data, filePath } = found;
  if (!Array.isArray(data.deferredFindings)) data.deferredFindings = [];
  data.deferredFindings.push({
    severity: opts.severity,
    file: opts.file,
    line: opts.line != null ? opts.line : null,
    title: opts.title,
  });

  writeState(filePath, data);
  process.exit(0);
}

function cmdRead(opts) {
  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('ship', slug);
  if (!found) {
    process.stderr.write(`Error: no state file found for branch "${branch}"\n`);
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(found.data, null, 2) + '\n');
  process.exit(0);
}

function cmdCleanup(opts) {
  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('ship', slug);
  if (!found) {
    // Nothing to delete — treat as success
    process.exit(0);
  }

  deleteState(found.filePath);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

try {
  const opts = parseArgs(process.argv);

  switch (opts.subcommand) {
    case 'init':     cmdInit(opts);     break;
    case 'start':    cmdStart(opts);    break;
    case 'complete': cmdComplete(opts); break;
    case 'skip':     cmdSkip(opts);     break;
    case 'fail':     cmdFail(opts);     break;
    case 'decide':   cmdDecide(opts);   break;
    case 'defer':    cmdDefer(opts);    break;
    case 'read':     cmdRead(opts);     break;
    case 'cleanup':  cmdCleanup(opts);  break;
    default:
      process.stderr.write(`Error: unknown subcommand "${opts.subcommand}"\n`);
      process.stderr.write('Usage: node ship-state.js <init|start|complete|skip|fail|decide|defer|read|cleanup> [options]\n');
      process.exit(2);
  }
} catch (e) {
  process.stderr.write(`Unexpected error: ${e.message}\n`);
  process.exit(2);
}
