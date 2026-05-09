#!/usr/bin/env node
/**
 * run-session-start-state.js
 * Test wrapper for session-start.js stale compact-recovery sweep (issue #334).
 *
 * Runs session-start.js against a fixture project, then emits a JSON object
 * describing the post-run state of .sdlc/execution/ for assertion.
 *
 * Args:
 *   --project-root <path>   Working directory (fixture, git-init'd via setup.sh)
 *
 * Output JSON:
 *   {
 *     exitCode: number,
 *     stdout: string,
 *     stderr: string,
 *     stateFiles: string[],   // .sdlc/execution/ visible files after run
 *     hiddenFiles: string[],  // .sdlc/execution/ hidden files (dot-prefixed) after run
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
// Locate session-start.js
// ---------------------------------------------------------------------------

let repoRoot = null;
let dir = __dirname;
while (dir !== path.dirname(dir)) {
  if (fs.existsSync(path.join(dir, 'plugins', 'sdlc-utilities', 'hooks', 'session-start.js'))) {
    repoRoot = dir;
    break;
  }
  dir = path.dirname(dir);
}

if (!repoRoot) {
  console.log(JSON.stringify({ error: 'Could not find repo root with session-start.js' }));
  process.exit(0);
}

const hookScript = path.join(repoRoot, 'plugins', 'sdlc-utilities', 'hooks', 'session-start.js');

// ---------------------------------------------------------------------------
// Set SDLC_STATE_DIR_OVERRIDE so state.js resolves to the fixture dir
// ---------------------------------------------------------------------------

const stateDir = path.join(projectRoot, '.sdlc', 'execution');
const env = { ...process.env, SDLC_STATE_DIR_OVERRIDE: stateDir };

// ---------------------------------------------------------------------------
// Run session-start.js
// ---------------------------------------------------------------------------

const result = spawnSync('node', [hookScript], {
  cwd: projectRoot,
  env,
  encoding: 'utf8',
  timeout: 15_000,
});

// ---------------------------------------------------------------------------
// Report post-run state
// ---------------------------------------------------------------------------

let allFiles = [];
try {
  allFiles = fs.existsSync(stateDir) ? fs.readdirSync(stateDir) : [];
} catch (_) {}

const output = {
  exitCode: result.status ?? -1,
  stdout: result.stdout || '',
  stderr: result.stderr || '',
  stateFiles: allFiles.filter(f => !f.startsWith('.')),
  hiddenFiles: allFiles.filter(f => f.startsWith('.')),
};

console.log(JSON.stringify(output));
