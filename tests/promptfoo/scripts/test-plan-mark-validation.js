#!/usr/bin/env node
/**
 * test-plan-mark-validation.js
 * Validates plan.js --mark error cases (R20, issue #285):
 *   - Unknown marker name → exit 1 + stderr listing valid names
 *   - --mark plan-file without --path → exit 1
 *   - --mark <name> with no existing state file → exit 1
 *
 * Args:
 *   --project-root <path>  Working directory (a git-init'd fixture, no state file)
 *
 * Outputs JSON for promptfoo assertions.
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let projectRoot = process.cwd();

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project-root' && args[i + 1]) {
    projectRoot = path.resolve(args[++i]);
    i++;
  }
}

let repoRoot = null;
let dir = __dirname;
while (dir !== path.dirname(dir)) {
  if (fs.existsSync(path.join(dir, 'plugins/sdlc-utilities/scripts/skill/plan.js'))) {
    repoRoot = dir;
    break;
  }
  dir = path.dirname(dir);
}

if (!repoRoot) {
  console.log(JSON.stringify({ error: 'repo root not found' }));
  process.exit(1);
}

const planScript = path.join(repoRoot, 'plugins/sdlc-utilities/scripts/skill/plan.js');

function runPlan(extraArgs) {
  const result = spawnSync('node', [planScript, ...extraArgs], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 10_000,
    env: Object.assign({}, process.env, { SDLC_SKIP_CONFIG_CHECK: '1' }),
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
}

// Case 1: unknown marker name
const unknownName = runPlan(['--mark', 'bogusMarker']);

// Case 2: plan-file without --path
const noPath = runPlan(['--mark', 'plan-file']);

// Case 3: valid marker but no state file — use a fresh temp git repo with no state
const os = require('os');
const noStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-mark-nostate-'));
// Initialize a fresh git repo so git branch --show-current works
spawnSync('git', ['init', '-q'], { cwd: noStateDir });
spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: noStateDir });
spawnSync('git', ['config', 'user.name', 'Test'], { cwd: noStateDir });
spawnSync('git', ['commit', '--allow-empty', '-q', '-m', 'init'], { cwd: noStateDir });

const noStateFile = spawnSync('node', [planScript, '--mark', 'critiqueRan'], {
  cwd: noStateDir,
  encoding: 'utf8',
  timeout: 10_000,
  env: Object.assign({}, process.env, { SDLC_SKIP_CONFIG_CHECK: '1' }),
});
const noStateResult = { stdout: noStateFile.stdout || '', stderr: noStateFile.stderr || '', status: noStateFile.status };

// Cleanup temp dir
try { fs.rmSync(noStateDir, { recursive: true, force: true }); } catch (_) {}

const result = {
  unknownName: {
    exitCode: unknownName.status,
    stderr: unknownName.stderr.trim(),
    stderrContainsValidNames: unknownName.stderr.includes('plan-file') && unknownName.stderr.includes('critiqueRan'),
  },
  missingPath: {
    exitCode: noPath.status,
    stderr: noPath.stderr.trim(),
    stderrMentionsPath: noPath.stderr.includes('--path'),
  },
  noStateFile: {
    exitCode: noStateResult.status,
    stderr: noStateResult.stderr.trim(),
    stderrMentionsOutputFile: noStateResult.stderr.includes('--output-file'),
  },
};

console.log(JSON.stringify(result, null, 2));
