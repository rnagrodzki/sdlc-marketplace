#!/usr/bin/env node
/**
 * run-ship-detect-resume.js
 * Test wrapper for lib/state.js::detectResumeState()'s `worktreeMismatch`
 * field (issue #503), which this plan promotes from diagnostic-only to a
 * resume gate consumed by skill/ship.js's implicit-resume check (see
 * state-format.md's `worktree` field documentation).
 *
 * Stamps a FRESH ship state file (mtime "now", well inside
 * COMPACT_RECOVERY_TTL_MS) at --state-rel, with a `worktree` field driven by
 * --scenario, then either:
 *   - calls lib/state.js::detectResumeState({prefix:'ship', branch}) directly
 *     in-process (scenarios: match | mismatch | absent), or
 *   - spawns the real skill/ship.js prepare pipeline (scenario:
 *     ship-resume-mismatch) to prove the mismatch actually gates implicit
 *     resume end-to-end, reading back its output manifest (ship.js's
 *     writeOutput() prints only a temp-file path on stdout; this scenario
 *     reads that file to get the structured result).
 *
 * Args:
 *   --project-root <path>   Fixture working dir (the tmp-copied fixture; cwd)
 *   --state-rel <path>      State file path relative to project-root
 *   --branch <name>         Branch name (must match the fixture's checked-out
 *                           branch and the state filename's slug)
 *   --scenario <name>       match | mismatch | absent | ship-resume-mismatch
 *
 * Output JSON (match | mismatch | absent):
 *   { scenario, found, fresh, worktreeMismatch }
 *
 * Output JSON (ship-resume-mismatch):
 *   { scenario, exitCode, worktreeMismatch, implicitResume, warnings }
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const args = process.argv.slice(2);
let projectRoot = process.cwd();
let stateRel = null;
let branch = 'main';
let scenario = 'match';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project-root' && args[i + 1]) projectRoot = path.resolve(args[++i]);
  else if (args[i] === '--state-rel' && args[i + 1]) stateRel = args[++i];
  else if (args[i] === '--branch' && args[i + 1]) branch = args[++i];
  else if (args[i] === '--scenario' && args[i + 1]) scenario = args[++i];
}

function emit(obj) {
  console.log(JSON.stringify(obj));
}

if (!stateRel) {
  emit({ error: '--state-rel is required' });
  process.exit(0);
}

// Locate repo root with lib/state.js.
let repoRoot = null;
let dir = __dirname;
while (dir !== path.dirname(dir)) {
  if (fs.existsSync(path.join(dir, 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'state.js'))) {
    repoRoot = dir;
    break;
  }
  dir = path.dirname(dir);
}
if (!repoRoot) {
  emit({ error: 'Could not find repo root with lib/state.js' });
  process.exit(0);
}

const stateFile = path.join(projectRoot, stateRel);

function activeWorktree() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: projectRoot, encoding: 'utf8' }).trim();
}

const baseState = {
  version: 1,
  startedAt: '2026-01-01T00:00:00Z',
  branch,
  sessionId: 'sess-fixture',
  flags: { auto: true, steps: ['commit'] },
  steps: [{ name: 'commit', status: 'pending' }],
  decisions: [],
  deferredFindings: [],
};

let data;
switch (scenario) {
  case 'match':
    data = Object.assign({}, baseState, { worktree: activeWorktree() });
    break;
  case 'mismatch':
  case 'ship-resume-mismatch':
    // A different, but real, directory: the fixture's own tmp copy is a
    // subdirectory of os.tmpdir(), so os.tmpdir() itself is guaranteed to
    // resolve to a distinct realpath.
    data = Object.assign({}, baseState, { worktree: fs.realpathSync(os.tmpdir()) });
    break;
  case 'absent':
    data = Object.assign({}, baseState); // no `worktree` key — pre-#501 state file
    break;
  default:
    emit({ error: `unknown scenario: ${scenario}` });
    process.exit(0);
}

fs.mkdirSync(path.dirname(stateFile), { recursive: true });
fs.writeFileSync(stateFile, JSON.stringify(data));

if (scenario === 'match' || scenario === 'mismatch' || scenario === 'absent') {
  const { detectResumeState } = require(path.join(repoRoot, 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'state.js'));
  const result = detectResumeState({ prefix: 'ship', branch });
  emit({
    scenario,
    found: result.found,
    fresh: result.fresh,
    worktreeMismatch: result.worktreeMismatch,
  });
  process.exit(0);
}

// ship-resume-mismatch: drive the real ship.js prepare pipeline and read
// back its output manifest.
const shipScript = path.join(repoRoot, 'plugins', 'sdlc-utilities', 'scripts', 'skill', 'ship.js');
const res = spawnSync('node', [shipScript, '--steps', 'commit'], {
  cwd: projectRoot,
  env: { ...process.env },
  encoding: 'utf8',
  timeout: 15_000,
});

const stdoutPath = (res.stdout || '').trim();
let manifest = null;
try {
  manifest = JSON.parse(fs.readFileSync(stdoutPath, 'utf8'));
} catch (_) {
  // Leave manifest null — surfaced as nulls below for assertion visibility.
}

emit({
  scenario,
  exitCode: res.status,
  stderr: (res.stderr || '').trim(),
  worktreeMismatch: manifest && manifest.resume ? manifest.resume.worktreeMismatch : null,
  implicitResume: manifest && manifest.flags ? manifest.flags.implicitResume : null,
  warnings: manifest ? manifest.warnings : null,
});
