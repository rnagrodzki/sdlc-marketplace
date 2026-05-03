#!/usr/bin/env node
/**
 * execute-state.js
 * CLI wrapper for managing execute-plan-sdlc execution state files.
 * Delegates all I/O to lib/state.js; zero npm dependencies.
 *
 * Usage:
 *   node execute-state.js init        --branch <b> --quality <X> --total-tasks <n> [--plan-path <p>] [--plan-hash <h>]
 *   node execute-state.js wave-start  --wave <n>
 *   node execute-state.js wave-done   --wave <n>
 *   node execute-state.js wave-fail   --wave <n>
 *   node execute-state.js task-done   --wave <n> --task <id> --name <name> --complexity <c> --risk <r> --files-changed <json>
 *   node execute-state.js task-fail   --wave <n> --task <id> --name <name> --complexity <c> --risk <r> --error <text>
 *   node execute-state.js context     --data <json>
 *   node execute-state.js read        [--branch <b>]
 *   node execute-state.js cleanup     [--branch <b>]
 *
 * Exit codes:
 *   0 = success
 *   1 = state file not found (read/cleanup)
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
    } else if (a === '--quality' && args[i + 1]) {
      result.quality = args[++i];
    } else if (a === '--preset') {
      // Hard-removed (#190): --preset renamed to --quality. Consume the
      // following value (if any) and surface a clear error so callers update
      // their invocations. The error is written to stderr and exits non-zero;
      // the orchestrator surfaces it in the agent prompt.
      if (args[i + 1] && !args[i + 1].startsWith('--')) i++;
      result._presetRejected = true;
    } else if (a === '--total-tasks' && args[i + 1]) {
      const val = parseInt(args[++i], 10);
      if (isNaN(val)) { process.stderr.write(`Error: --total-tasks requires a number, got "${args[i]}"\n`); process.exit(2); }
      result.totalTasks = val;
    } else if (a === '--plan-path' && args[i + 1]) {
      result.planPath = args[++i];
    } else if (a === '--plan-hash' && args[i + 1]) {
      result.planHash = args[++i];
    } else if (a === '--wave' && args[i + 1]) {
      const val = parseInt(args[++i], 10);
      if (isNaN(val)) { process.stderr.write(`Error: --wave requires a number, got "${args[i]}"\n`); process.exit(2); }
      result.wave = val;
    } else if (a === '--task' && args[i + 1]) {
      result.task = args[++i];
    } else if (a === '--name' && args[i + 1]) {
      result.name = args[++i];
    } else if (a === '--complexity' && args[i + 1]) {
      result.complexity = args[++i];
    } else if (a === '--risk' && args[i + 1]) {
      result.risk = args[++i];
    } else if (a === '--files-changed' && args[i + 1]) {
      result.filesChanged = args[++i];
    } else if (a === '--error' && args[i + 1]) {
      result.error = args[++i];
    } else if (a === '--data' && args[i + 1]) {
      result.data = args[++i];
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
// Wave helpers
// ---------------------------------------------------------------------------

function findOrCreateWave(waves, waveNumber) {
  let wave = waves.find(w => w.number === waveNumber);
  if (!wave) {
    wave = { number: waveNumber, status: 'in_progress', startedAt: new Date().toISOString(), tasks: [] };
    waves.push(wave);
  }
  return wave;
}

// ---------------------------------------------------------------------------
// Deep merge helper (arrays concatenate, objects merge, scalars overwrite)
// ---------------------------------------------------------------------------

function deepMerge(target, source) {
  if (source === null || typeof source !== 'object') return source;
  if (Array.isArray(source)) {
    if (Array.isArray(target)) return target.concat(source);
    return source.slice();
  }
  const result = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (
      key in result &&
      result[key] !== null &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key]) &&
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key], source[key]);
    } else if (Array.isArray(result[key]) && Array.isArray(source[key])) {
      result[key] = result[key].concat(source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

function cmdInit(opts) {
  if (opts._presetRejected) {
    process.stderr.write('Error: --preset is no longer accepted by execute-plan-sdlc state init. Use --quality <full|balanced|minimal> instead (#190).\n');
    process.exit(2);
  }
  if (!opts.branch) {
    process.stderr.write('Error: --branch is required for init\n');
    process.exit(2);
  }
  if (!opts.quality) {
    process.stderr.write('Error: --quality is required for init (--preset was renamed to --quality, #190)\n');
    process.exit(2);
  }
  if (opts.totalTasks == null || isNaN(opts.totalTasks)) {
    process.stderr.write('Error: --total-tasks is required for init\n');
    process.exit(2);
  }

  const data = {
    version: 1,
    skill: 'execute-plan-sdlc',
    startedAt: new Date().toISOString(),
    branch: opts.branch,
    planPath: opts.planPath || null,
    planHash: opts.planHash || null,
    quality: opts.quality,
    totalTasks: opts.totalTasks,
    waves: [],
    context: {},
  };

  try {
    const filePath = initState('execute', opts.branch, data);
    process.stdout.write(filePath + '\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    process.exit(2);
  }
}

function cmdWaveStart(opts) {
  if (opts.wave == null || isNaN(opts.wave)) {
    process.stderr.write('Error: --wave is required\n');
    process.exit(2);
  }

  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('execute', slug);
  if (!found) {
    process.stderr.write(`Error: no state file found for branch "${branch}"\n`);
    process.exit(1);
  }

  const { data, filePath } = found;
  if (!Array.isArray(data.waves)) data.waves = [];

  const wave = data.waves.find(w => w.number === opts.wave);
  if (wave) {
    wave.status = 'in_progress';
    wave.startedAt = new Date().toISOString();
  } else {
    data.waves.push({
      number: opts.wave,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      tasks: [],
    });
  }

  writeState(filePath, data);
  process.exit(0);
}

function cmdWaveDone(opts) {
  if (opts.wave == null || isNaN(opts.wave)) {
    process.stderr.write('Error: --wave is required\n');
    process.exit(2);
  }

  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('execute', slug);
  if (!found) {
    process.stderr.write(`Error: no state file found for branch "${branch}"\n`);
    process.exit(1);
  }

  const { data, filePath } = found;
  if (!Array.isArray(data.waves)) data.waves = [];

  const wave = findOrCreateWave(data.waves, opts.wave);
  wave.status = 'completed';
  wave.completedAt = new Date().toISOString();

  writeState(filePath, data);
  process.exit(0);
}

function cmdWaveFail(opts) {
  if (opts.wave == null || isNaN(opts.wave)) {
    process.stderr.write('Error: --wave is required\n');
    process.exit(2);
  }

  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('execute', slug);
  if (!found) {
    process.stderr.write(`Error: no state file found for branch "${branch}"\n`);
    process.exit(1);
  }

  const { data, filePath } = found;
  if (!Array.isArray(data.waves)) data.waves = [];

  const wave = findOrCreateWave(data.waves, opts.wave);
  wave.status = 'failed';
  wave.completedAt = new Date().toISOString();

  writeState(filePath, data);
  process.exit(0);
}

function cmdTaskDone(opts) {
  if (opts.wave == null || isNaN(opts.wave)) {
    process.stderr.write('Error: --wave is required\n');
    process.exit(2);
  }
  if (!opts.task) {
    process.stderr.write('Error: --task is required\n');
    process.exit(2);
  }

  let filesChanged;
  try {
    filesChanged = opts.filesChanged ? JSON.parse(opts.filesChanged) : [];
  } catch (e) {
    process.stderr.write(`Error: --files-changed is not valid JSON: ${e.message}\n`);
    process.exit(2);
  }

  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('execute', slug);
  if (!found) {
    process.stderr.write(`Error: no state file found for branch "${branch}"\n`);
    process.exit(1);
  }

  const { data, filePath } = found;
  if (!Array.isArray(data.waves)) data.waves = [];

  const wave = findOrCreateWave(data.waves, opts.wave);
  if (!Array.isArray(wave.tasks)) wave.tasks = [];

  const taskEntry = {
    id: opts.task,
    name: opts.name || '',
    complexity: opts.complexity || '',
    risk: opts.risk || '',
    status: 'completed',
    filesChanged: Array.isArray(filesChanged) ? filesChanged : [],
  };

  const existingIdx = wave.tasks.findIndex(t => t.id === opts.task);
  if (existingIdx >= 0) {
    wave.tasks[existingIdx] = taskEntry;
  } else {
    wave.tasks.push(taskEntry);
  }

  writeState(filePath, data);
  process.exit(0);
}

function cmdTaskFail(opts) {
  if (opts.wave == null || isNaN(opts.wave)) {
    process.stderr.write('Error: --wave is required\n');
    process.exit(2);
  }
  if (!opts.task) {
    process.stderr.write('Error: --task is required\n');
    process.exit(2);
  }

  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('execute', slug);
  if (!found) {
    process.stderr.write(`Error: no state file found for branch "${branch}"\n`);
    process.exit(1);
  }

  const { data, filePath } = found;
  if (!Array.isArray(data.waves)) data.waves = [];

  const wave = findOrCreateWave(data.waves, opts.wave);
  if (!Array.isArray(wave.tasks)) wave.tasks = [];

  const taskEntry = {
    id: opts.task,
    name: opts.name || '',
    complexity: opts.complexity || '',
    risk: opts.risk || '',
    status: 'failed',
    filesChanged: [],
    error: opts.error || '',
  };

  const existingIdx = wave.tasks.findIndex(t => t.id === opts.task);
  if (existingIdx >= 0) {
    wave.tasks[existingIdx] = taskEntry;
  } else {
    wave.tasks.push(taskEntry);
  }

  writeState(filePath, data);
  process.exit(0);
}

function cmdContext(opts) {
  if (!opts.data) {
    process.stderr.write('Error: --data is required\n');
    process.exit(2);
  }

  let incoming;
  try {
    incoming = JSON.parse(opts.data);
  } catch (e) {
    process.stderr.write(`Error: --data is not valid JSON: ${e.message}\n`);
    process.exit(2);
  }

  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('execute', slug);
  if (!found) {
    process.stderr.write(`Error: no state file found for branch "${branch}"\n`);
    process.exit(1);
  }

  const { data, filePath } = found;
  if (!data.context || typeof data.context !== 'object') data.context = {};
  data.context = deepMerge(data.context, incoming);

  writeState(filePath, data);
  process.exit(0);
}

function cmdRead(opts) {
  const branch = resolveBranchOrExit(opts.branch);
  const slug = slugifyBranch(branch);
  const found = readState('execute', slug);
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
  const found = readState('execute', slug);
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
    case 'init':        cmdInit(opts);       break;
    case 'wave-start':  cmdWaveStart(opts);  break;
    case 'wave-done':   cmdWaveDone(opts);   break;
    case 'wave-fail':   cmdWaveFail(opts);   break;
    case 'task-done':   cmdTaskDone(opts);   break;
    case 'task-fail':   cmdTaskFail(opts);   break;
    case 'context':     cmdContext(opts);    break;
    case 'read':        cmdRead(opts);       break;
    case 'cleanup':     cmdCleanup(opts);    break;
    default:
      process.stderr.write(`Error: unknown subcommand "${opts.subcommand}"\n`);
      process.stderr.write('Usage: node execute-state.js <init|wave-start|wave-done|wave-fail|task-done|task-fail|context|read|cleanup> [options]\n');
      process.exit(2);
  }
} catch (e) {
  process.stderr.write(`Unexpected error: ${e.message}\n`);
  process.exit(2);
}
