#!/usr/bin/env node
/**
 * run-plan-state.js
 * Test wrapper for skill/plan.js prune-at-init behavior (issue #334).
 *
 * Runs plan.js --output-file against a fixture project, then emits a JSON
 * object describing the post-run state of .sdlc/execution/ for assertion.
 *
 * This is needed because plan.js --output-file writes to a temp file, and
 * the script-runner provider auto-reads that temp file as the output. By
 * running the script ourselves and reporting the filesystem state, all
 * assertions can be `contains` checks over the JSON output.
 *
 * Args:
 *   --project-root <path>   Working directory (fixture, git-init'd via setup.sh)
 *
 * Output JSON:
 *   {
 *     exitCode: number,
 *     stateFiles: string[],   // .sdlc/execution/ file list after run
 *     planFileCount: number,  // how many plan-*.json files remain
 *     otherBranchFilesPresent: boolean  // plan files for other branches survive
 *   }
 */

'use strict';

const path        = require('path');
const fs          = require('fs');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let projectRoot = process.cwd();

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project-root' && args[i + 1]) {
    projectRoot = path.resolve(args[++i]);
  }
}

// ---------------------------------------------------------------------------
// Locate plan.js
// ---------------------------------------------------------------------------

let repoRoot = null;
let dir = __dirname;
while (dir !== path.dirname(dir)) {
  if (fs.existsSync(path.join(dir, 'plugins', 'sdlc-utilities', 'scripts', 'skill', 'plan.js'))) {
    repoRoot = dir;
    break;
  }
  dir = path.dirname(dir);
}

if (!repoRoot) {
  console.log(JSON.stringify({ error: 'Could not find repo root with plan.js' }));
  process.exit(0);
}

const planScript = path.join(repoRoot, 'plugins', 'sdlc-utilities', 'scripts', 'skill', 'plan.js');

// ---------------------------------------------------------------------------
// Set SDLC_STATE_DIR_OVERRIDE so plan.js writes state to the fixture dir
// ---------------------------------------------------------------------------

const stateDir = path.join(projectRoot, '.sdlc', 'execution');
const env = { ...process.env, SDLC_STATE_DIR_OVERRIDE: stateDir, SDLC_SKIP_CONFIG_CHECK: '1' };

// ---------------------------------------------------------------------------
// Run plan.js --output-file
// ---------------------------------------------------------------------------

const result = spawnSync('node', [planScript, '--output-file'], {
  cwd: projectRoot,
  env,
  encoding: 'utf8',
  timeout: 15_000,
});

// ---------------------------------------------------------------------------
// Report post-run state
// ---------------------------------------------------------------------------

let stateFiles = [];
try {
  stateFiles = fs.existsSync(stateDir) ? fs.readdirSync(stateDir) : [];
} catch (_) {}

// The fixture branch is "current-branch"; count only plan files for that branch
const planFiles = stateFiles.filter(f => /^plan-current-branch-/.test(f));
// Other-branch files should survive prune
const otherBranchFiles = stateFiles.filter(f => f.startsWith('plan-other-branch-'));

const output = {
  exitCode: result.status ?? -1,
  stateFiles,
  planFileCount: planFiles.length,
  otherBranchFilesPresent: otherBranchFiles.length > 0,
};

console.log(JSON.stringify(output));
