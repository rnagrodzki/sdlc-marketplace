#!/usr/bin/env node
/**
 * test-ship-gc-explore-tempdirs.js
 * Verifies that ship.js --gc sweeps stale sdlc-explore-* tempdirs (issue #408 / T8).
 *
 * The fixture (project-ship-gc-explore-tempdirs) sets up:
 *   fake-tmpdir/sdlc-explore-dead-branch-abc123  (stale mtime, branch gone)
 *   fake-tmpdir/sdlc-explore-main-xyz789         (fresh mtime, branch lives)
 *
 * This script:
 *   1. Runs ship.js --gc with SDLC_EXPLORE_TMPDIR_OVERRIDE=<fixture>/fake-tmpdir
 *      and SDLC_STATE_DIR_OVERRIDE=<fixture>/.sdlc/execution (no state-file noise).
 *   2. Parses the output and validates:
 *      - exploreTempdirs bucket exists in report
 *      - stale dir was deleted (removed count >= 1)
 *      - fresh dir was kept (kept count >= 1)
 *
 * Args:
 *   --project-root <path>  Working directory (the fixture directory)
 *
 * Outputs: JSON { explorerTempdirsPresent, staleRemoved, freshKept, planExitCode }
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let projectRoot = process.cwd();
let repoRoot = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project-root' && args[i + 1]) {
    projectRoot = path.resolve(args[++i]);
  } else if (args[i] === '--repo-root' && args[i + 1]) {
    repoRoot = path.resolve(args[++i]);
  }
}

// Auto-discover repo root
if (!repoRoot) {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'plugins/sdlc-utilities/scripts/skill/ship.js'))) {
      repoRoot = dir;
      break;
    }
    dir = path.dirname(dir);
  }
}

if (!repoRoot) {
  console.log(JSON.stringify({ error: 'could not locate repo root (ship.js not found)' }));
  process.exit(1);
}

const shipScript = path.join(repoRoot, 'plugins/sdlc-utilities/scripts/skill/ship.js');
const fakeTmpdir = path.join(projectRoot, 'fake-tmpdir');
const stateDir   = path.join(projectRoot, '.sdlc', 'execution');

// Ensure the fake-tmpdir and stale entry exist (setup.sh runs as git init, may not be rerun)
fs.mkdirSync(fakeTmpdir, { recursive: true });
const staleDir = path.join(fakeTmpdir, 'sdlc-explore-dead-branch-abc123');
const freshDir = path.join(fakeTmpdir, 'sdlc-explore-main-xyz789');
if (!fs.existsSync(staleDir)) fs.mkdirSync(staleDir);
if (!fs.existsSync(freshDir)) fs.mkdirSync(freshDir);

// Back-date the stale dir to 2024-01-01
try {
  const staleDate = new Date('2024-01-01T00:00:00Z');
  fs.utimesSync(staleDir, staleDate, staleDate);
} catch (_) {}

// ---------------------------------------------------------------------------
// Run ship.js --gc
// ---------------------------------------------------------------------------

const result = spawnSync('node', [shipScript, '--gc'], {
  cwd: projectRoot,
  encoding: 'utf8',
  timeout: 30_000,
  env: Object.assign({}, process.env, {
    SDLC_SKIP_CONFIG_CHECK: '1',
    SDLC_STATE_DIR_OVERRIDE: stateDir,
    SDLC_EXPLORE_TMPDIR_OVERRIDE: fakeTmpdir,
  }),
});

const exitCode = result.status;
const outputFilePath = (result.stdout || '').trim();

let gcData = null;
if (outputFilePath && fs.existsSync(outputFilePath)) {
  try {
    gcData = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
    try { fs.unlinkSync(outputFilePath); } catch (_) {}
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Build result
// ---------------------------------------------------------------------------

const report = gcData ? gcData.report : null;
const exploreTempdirs = report ? report.exploreTempdirs : null;

const staleRemoved = exploreTempdirs
  ? (Array.isArray(exploreTempdirs.deleted) ? exploreTempdirs.deleted.length : 0)
  : 0;
const freshKept = exploreTempdirs
  ? (Array.isArray(exploreTempdirs.kept) ? exploreTempdirs.kept.length : 0)
  : 0;

const output = {
  planExitCode: exitCode,
  explorerTempdirsPresent: !!exploreTempdirs,
  staleRemoved,
  freshKept,
  staleRemovedNames: exploreTempdirs
    ? (Array.isArray(exploreTempdirs.deleted) ? exploreTempdirs.deleted.map(d => d.dir) : [])
    : [],
};

console.log(JSON.stringify(output, null, 2));
