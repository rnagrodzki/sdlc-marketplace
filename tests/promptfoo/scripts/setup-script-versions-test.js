/**
 * setup-script-versions-test.js — exec-only tests for the scriptVersions[]
 * prepare-output block added to setup.js by R-SCRIPT-VERSIONS (#424).
 *
 * Tests that setup.js correctly emits scriptVersions.outdatedCount and
 * per-file action/version triplets. No LLM provider — exec-only.
 *
 * Operations (--op):
 *   all-current     — all CI scripts current → outdatedCount=0
 *   one-outdated    — one CI script outdated → outdatedCount≥1
 *   all-missing     — no CI scripts installed → outdatedCount=N (all missing)
 */

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT   = path.resolve(__dirname, '../../..');
const SETUP_JS    = path.join(REPO_ROOT, 'plugins/sdlc-utilities/scripts/skill/setup.js');
const FIXTURES_FS = path.join(REPO_ROOT, 'tests/promptfoo/fixtures-fs/setup-script-versions');

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return def;
  return process.argv[i + 1];
}

function emit(ok, details) {
  console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'} ${details}`);
  process.exitCode = ok ? 0 : 1;
}

function copyDirRecursive(src, dst) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function runSetupJs(tmpRoot) {
  const env = { ...process.env, SDLC_ROOT: tmpRoot, SDLC_SKIP_CONFIG_CHECK: '1' };
  const r = spawnSync('node', [SETUP_JS, '--output-file'], {
    cwd: tmpRoot,
    env,
    encoding: 'utf8',
    timeout: 15000,
  });
  const outPath = (r.stdout || '').trim();
  let json = null;
  try {
    if (outPath && fs.existsSync(outPath)) {
      json = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      fs.unlinkSync(outPath);
    }
  } catch (_) {}
  return { exitCode: r.status, stderr: r.stderr, json };
}

// ---- Scenarios ----

function testAllMissing() {
  // all-missing: no .github/scripts/ dir → all CI files missing
  const fixture = path.join(FIXTURES_FS, 'missing');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-sv-missing-'));
  try {
    copyDirRecursive(fixture, tmp);
    const r = runSetupJs(tmp);
    if (!r.json) return emit(false, `no json: exit=${r.exitCode} stderr=${r.stderr}`);
    const sv = r.json.scriptVersions;
    if (!sv) return emit(false, 'scriptVersions missing from output');
    const outdatedCount = sv.outdatedCount !== undefined ? sv.outdatedCount : (sv.files || []).filter(f => f.action === 'missing' || f.action === 'outdated').length;
    if (outdatedCount === 0) return emit(false, `expected outdatedCount>0 for all-missing, got ${outdatedCount}`);
    emit(true, `all-missing: outdatedCount=${outdatedCount}`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

function testAllCurrent() {
  // all-current: copy actual CI files from plugin so they match → action=current
  const fixture = path.join(FIXTURES_FS, 'current');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-sv-current-'));
  try {
    copyDirRecursive(fixture, tmp);
    // Install the actual retag-release.cjs from the plugin
    const pluginRoot = path.resolve(REPO_ROOT, 'plugins/sdlc-utilities');
    const ciSrc = path.join(pluginRoot, 'scripts', 'ci', 'retag-release.cjs');
    if (fs.existsSync(ciSrc)) {
      const destDir = path.join(tmp, '.github', 'scripts');
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(ciSrc, path.join(destDir, 'retag-release.cjs'));
    }
    const r = runSetupJs(tmp);
    if (!r.json) return emit(false, `no json: exit=${r.exitCode} stderr=${r.stderr}`);
    const sv = r.json.scriptVersions;
    if (!sv) return emit(false, 'scriptVersions missing from output');
    const outdatedCount = sv.outdatedCount !== undefined ? sv.outdatedCount : (sv.files || []).filter(f => f.action !== 'current').length;
    // When CI files are at current version, outdatedCount should be 0
    if (outdatedCount !== 0) return emit(false, `expected outdatedCount=0 for all-current, got ${outdatedCount}`);
    emit(true, `all-current: outdatedCount=0`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

function testOneOutdated() {
  // one-outdated: install a retag-release.cjs with version=0 (very old)
  const fixture = path.join(FIXTURES_FS, 'outdated');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-sv-outdated-'));
  try {
    copyDirRecursive(fixture, tmp);
    // Write a stale retag-release.cjs
    const destDir = path.join(tmp, '.github', 'scripts');
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(
      path.join(destDir, 'retag-release.cjs'),
      '// stub\nconst RETAG_SCRIPT_VERSION = 0;\n',
      'utf8'
    );
    const r = runSetupJs(tmp);
    if (!r.json) return emit(false, `no json: exit=${r.exitCode} stderr=${r.stderr}`);
    const sv = r.json.scriptVersions;
    if (!sv) return emit(false, 'scriptVersions missing from output');
    const files = sv.files || sv;
    const outdated = Array.isArray(files) ? files.filter(f => f.action === 'outdated') : [];
    if (outdated.length === 0) return emit(false, `expected ≥1 outdated entry, got 0. files=${JSON.stringify(files)}`);
    emit(true, `one-outdated: ${outdated.length} outdated file(s)`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

// ---- Dispatch ----
const op = arg('--op', '');
switch (op) {
  case 'all-missing':   testAllMissing(); break;
  case 'all-current':   testAllCurrent(); break;
  case 'one-outdated':  testOneOutdated(); break;
  default:
    console.log(`RESULT: FAIL unknown --op: ${op}`);
    process.exitCode = 1;
}
