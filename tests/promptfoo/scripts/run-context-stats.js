#!/usr/bin/env node
/**
 * run-context-stats.js
 * Test driver for hooks/context-stats.js. The hook reads a JSON payload
 * `{transcript_path: ...}` from stdin and writes a sidecar to
 * `$TMPDIR/sdlc-context-stats.json`. The script-runner provider does not pipe
 * stdin to scripts, so this driver:
 *   1. Resolves the transcript path from a fixture root passed as argv[2].
 *   2. Spawns the hook with a fresh stdin payload.
 *   3. Reads the resulting sidecar and prints it to stdout for the test asserts.
 *
 * Usage: node run-context-stats.js <fixture-project-root>
 *
 * The fixture directory MUST contain `transcript.jsonl` and `tmp/`.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const HOOK_PATH = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'hooks', 'context-stats.js');

const fixtureRoot = process.argv[2];
if (!fixtureRoot) {
  process.stderr.write('Usage: run-context-stats.js <fixture-project-root>\n');
  process.exit(2);
}

const transcriptPath = path.join(fixtureRoot, 'transcript.jsonl');
const tmpDir         = path.join(fixtureRoot, 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });

const sidecarPath = path.join(tmpDir, 'sdlc-context-stats.json');
// Remove any leftover sidecar so the hook produces a fresh write we can verify.
try { fs.unlinkSync(sidecarPath); } catch (_) { /* none */ }

const payload = JSON.stringify({ transcript_path: transcriptPath });

const result = spawnSync('node', [HOOK_PATH], {
  input: payload,
  env: Object.assign({}, process.env, { TMPDIR: tmpDir }),
  encoding: 'utf8',
});

if (result.status !== 0) {
  process.stderr.write(`hook exited ${result.status}\nstderr:\n${result.stderr}\n`);
  process.exit(1);
}

if (!fs.existsSync(sidecarPath)) {
  process.stdout.write('NO_SIDECAR\n');
  process.exit(0);
}

process.stdout.write(fs.readFileSync(sidecarPath, 'utf8'));
