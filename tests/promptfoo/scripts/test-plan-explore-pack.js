#!/usr/bin/env node
/**
 * test-plan-explore-pack.js
 * Tests plan.js explorePack integration (Task 5 / P8–P12).
 *
 * Two modes (controlled by --mode):
 *   --mode clean   Clean invocation: verify explorePack has all 5 P8–P12 keys
 *   --mode error   Forced failure: SDLC_PLAN_EXPLORE_SCRIPT points to a stub
 *                  that exits 1; verify explorePack.error non-null + plan.js exits 0
 *
 * Args:
 *   --project-root <path>  Working directory (a git-init'd fixture)
 *   --mode <clean|error>
 *
 * Outputs: JSON { explorerPackPresent, allKeysPresent, explorerPackError,
 *                 planExitCode, manifestPathNull }
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let projectRoot = process.cwd();
let mode = 'clean';
let repoRoot = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project-root' && args[i + 1]) {
    projectRoot = path.resolve(args[++i]);
  } else if (args[i] === '--mode' && args[i + 1]) {
    mode = args[++i];
  } else if (args[i] === '--repo-root' && args[i + 1]) {
    repoRoot = path.resolve(args[++i]);
  }
}

// Auto-discover repo root
if (!repoRoot) {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'plugins/sdlc-utilities/scripts/skill/plan.js'))) {
      repoRoot = dir;
      break;
    }
    dir = path.dirname(dir);
  }
}

if (!repoRoot) {
  console.log(JSON.stringify({ error: 'could not locate repo root (plan.js not found)' }));
  process.exit(1);
}

const planScript = path.join(repoRoot, 'plugins/sdlc-utilities/scripts/skill/plan.js');

// ---------------------------------------------------------------------------
// Stub script for error mode
// ---------------------------------------------------------------------------

let stubPath = null;

if (mode === 'error') {
  // Write a temporary stub that exits 1 (simulates broken plan-explore.js)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-explore-stub-'));
  stubPath = path.join(tmpDir, 'plan-explore-stub.js');
  fs.writeFileSync(stubPath,
    '#!/usr/bin/env node\n' +
    'process.stderr.write("stub error\\n");\n' +
    'process.exit(1);\n',
    'utf8'
  );
}

// ---------------------------------------------------------------------------
// Run plan.js
// ---------------------------------------------------------------------------

const env = Object.assign({}, process.env, { SDLC_SKIP_CONFIG_CHECK: '1' });
if (mode === 'error' && stubPath) {
  env.SDLC_PLAN_EXPLORE_SCRIPT = stubPath;
}

const result = spawnSync('node', [planScript, '--output-file'], {
  cwd: projectRoot,
  encoding: 'utf8',
  timeout: 30_000,
  env,
});

// ---------------------------------------------------------------------------
// Parse output
// ---------------------------------------------------------------------------

const planExitCode = result.status;
const outputFilePath = (result.stdout || '').trim();

let packData = null;
if (outputFilePath && fs.existsSync(outputFilePath)) {
  try {
    packData = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
    // Clean up temp output file
    try { fs.unlinkSync(outputFilePath); } catch (_) {}
  } catch (_) {}
}

// Clean up stub
if (stubPath) {
  try { fs.rmSync(path.dirname(stubPath), { recursive: true, force: true }); } catch (_) {}
}

// ---------------------------------------------------------------------------
// Build result
// ---------------------------------------------------------------------------

const REQUIRED_KEYS = ['manifestPath', 'outDir', 'scopeHintCount', 'webResearchSignal', 'error'];

const explorerPackPresent = !!(packData && packData.explorePack);
const explorePack = packData ? packData.explorePack : null;
const allKeysPresent = explorerPackPresent
  ? REQUIRED_KEYS.every(k => k in explorePack)
  : false;

const output = {
  planExitCode,
  explorerPackPresent,
  allKeysPresent,
  explorerPackError: explorePack ? explorePack.error : 'no-pack',
  manifestPathNull: explorePack ? explorePack.manifestPath === null : true,
  webResearchSignalPresent: explorePack ? typeof explorePack.webResearchSignal === 'boolean' : false,
  scopeHintCountPresent: explorePack ? typeof explorePack.scopeHintCount === 'number' : false,
};

console.log(JSON.stringify(output, null, 2));
