/**
 * version-retag-test.js — exec-only tests for version.js --retag flag.
 *
 * Tests the R-RETAG prepare-contract: mode field, exclusivity validation,
 * tag-existence pre-check. No destructive git ops — prepare script only.
 * Implements Task 15 (Fixes #424).
 *
 * Operations (--op):
 *   retag-with-tag      — --retag alone with existing tag → mode=retag, no errors
 *   retag-no-tag        — --retag without existing tag → errors[] contains requires-tag msg
 *   retag-with-patch    — --retag patch → exclusivity error
 *   retag-with-init     — --retag --init → exclusivity error
 *   retag-with-changelog — --retag --changelog → exclusivity error
 *   retag-with-hotfix   — --retag --hotfix → exclusivity error
 *   retag-multi-conflict — --retag patch --hotfix → multiple errors (no short-circuit)
 */

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT     = path.resolve(__dirname, '../../..');
const VERSION_JS    = path.join(REPO_ROOT, 'plugins/sdlc-utilities/scripts/skill/version.js');
const FIXTURES_FS   = path.join(REPO_ROOT, 'tests/promptfoo/fixtures-fs/version-retag');

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

function runVersionJs(tmpRoot, extraArgs = []) {
  const env = { ...process.env, SDLC_ROOT: tmpRoot, SDLC_SKIP_CONFIG_CHECK: '1' };
  const outputFile = path.join(os.tmpdir(), `version-retag-out-${Date.now()}.json`);
  const r = spawnSync('node', [VERSION_JS, '--output-file', ...extraArgs], {
    cwd: tmpRoot,
    env,
    encoding: 'utf8',
    timeout: 15000,
  });
  // The output file path is on stdout
  const outPath = (r.stdout || '').trim();
  let json = null;
  try {
    if (outPath && fs.existsSync(outPath)) {
      json = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      fs.unlinkSync(outPath);
    } else if (r.stdout) {
      json = JSON.parse(r.stdout.trim());
    }
  } catch (_) {}
  return { exitCode: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

// ---- Scenarios ----

function testRetagWithTag() {
  const fixture = path.join(FIXTURES_FS, 'tag-exists');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vretag-tag-'));
  try {
    copyDirRecursive(fixture, tmp);
    const r = runVersionJs(tmp, ['--retag']);
    if (!r.json) return emit(false, `no json output: exit=${r.exitCode} stderr=${r.stderr}`);
    if (r.json.mode !== 'retag') return emit(false, `expected mode=retag, got ${r.json.mode}`);
    if (r.json.errors && r.json.errors.length > 0) return emit(false, `unexpected errors: ${JSON.stringify(r.json.errors)}`);
    if (!r.json.currentTag) return emit(false, 'currentTag missing');
    if (!r.json.oldSha) return emit(false, 'oldSha missing (tag may not have resolved in fake git)');
    emit(true, `retag-with-tag: mode=retag currentTag=${r.json.currentTag}`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

function testRetagNoTag() {
  const fixture = path.join(FIXTURES_FS, 'no-tag');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vretag-notag-'));
  try {
    copyDirRecursive(fixture, tmp);
    const r = runVersionJs(tmp, ['--retag']);
    if (!r.json) return emit(false, `no json output: exit=${r.exitCode} stderr=${r.stderr}`);
    if (r.json.mode !== 'retag') return emit(false, `expected mode=retag, got ${r.json.mode}`);
    const errors = r.json.errors || [];
    const hasTagError = errors.some(e => String(e).includes('requires tag') || String(e).includes('to already exist'));
    if (!hasTagError) return emit(false, `expected tag-not-found error in errors: ${JSON.stringify(errors)}`);
    emit(true, `retag-no-tag: tag-not-found error present`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

function testRetagWithPatch() {
  const fixture = path.join(FIXTURES_FS, 'no-tag');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vretag-patch-'));
  try {
    copyDirRecursive(fixture, tmp);
    const r = runVersionJs(tmp, ['--retag', 'patch']);
    if (!r.json) return emit(false, `no json output: exit=${r.exitCode} stderr=${r.stderr}`);
    if (r.json.mode !== 'retag') return emit(false, `expected mode=retag, got ${r.json.mode}`);
    const errors = r.json.errors || [];
    const hasExclusivity = errors.some(e => String(e).includes('--retag cannot be combined with'));
    if (!hasExclusivity) return emit(false, `expected exclusivity error in errors: ${JSON.stringify(errors)}`);
    emit(true, `retag-with-patch: exclusivity error present`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

function testRetagWithInit() {
  const fixture = path.join(FIXTURES_FS, 'no-tag');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vretag-init-'));
  try {
    copyDirRecursive(fixture, tmp);
    const r = runVersionJs(tmp, ['--retag', '--init']);
    if (!r.json) return emit(false, `no json output: exit=${r.exitCode} stderr=${r.stderr}`);
    if (r.json.mode !== 'retag') return emit(false, `expected mode=retag, got ${r.json.mode}`);
    const errors = r.json.errors || [];
    const hasExclusivity = errors.some(e => String(e).includes('--init'));
    if (!hasExclusivity) return emit(false, `expected --init exclusivity error: ${JSON.stringify(errors)}`);
    emit(true, `retag-with-init: exclusivity error present`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

function testRetagWithChangelog() {
  const fixture = path.join(FIXTURES_FS, 'no-tag');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vretag-changelog-'));
  try {
    copyDirRecursive(fixture, tmp);
    const r = runVersionJs(tmp, ['--retag', '--changelog']);
    if (!r.json) return emit(false, `no json output: exit=${r.exitCode} stderr=${r.stderr}`);
    const errors = r.json.errors || [];
    const hasExclusivity = errors.some(e => String(e).includes('--changelog'));
    if (!hasExclusivity) return emit(false, `expected --changelog exclusivity error: ${JSON.stringify(errors)}`);
    emit(true, `retag-with-changelog: exclusivity error present`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

function testRetagWithHotfix() {
  const fixture = path.join(FIXTURES_FS, 'no-tag');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vretag-hotfix-'));
  try {
    copyDirRecursive(fixture, tmp);
    const r = runVersionJs(tmp, ['--retag', '--hotfix']);
    if (!r.json) return emit(false, `no json output: exit=${r.exitCode} stderr=${r.stderr}`);
    const errors = r.json.errors || [];
    const hasExclusivity = errors.some(e => String(e).includes('--hotfix'));
    if (!hasExclusivity) return emit(false, `expected --hotfix exclusivity error: ${JSON.stringify(errors)}`);
    emit(true, `retag-with-hotfix: exclusivity error present`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

function testRetagMultiConflict() {
  const fixture = path.join(FIXTURES_FS, 'no-tag');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vretag-multi-'));
  try {
    copyDirRecursive(fixture, tmp);
    const r = runVersionJs(tmp, ['--retag', 'patch', '--hotfix']);
    if (!r.json) return emit(false, `no json output: exit=${r.exitCode} stderr=${r.stderr}`);
    const errors = r.json.errors || [];
    // Should have at least 2 exclusivity errors (no short-circuit)
    const exclusivityErrors = errors.filter(e => String(e).includes('cannot be combined'));
    if (exclusivityErrors.length < 2) {
      return emit(false, `expected ≥2 exclusivity errors (no short-circuit), got ${exclusivityErrors.length}: ${JSON.stringify(errors)}`);
    }
    emit(true, `retag-multi-conflict: ${exclusivityErrors.length} exclusivity errors (no short-circuit)`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

// ---- Dispatch ----
const op = arg('--op', '');
switch (op) {
  case 'retag-with-tag':        testRetagWithTag(); break;
  case 'retag-no-tag':          testRetagNoTag(); break;
  case 'retag-with-patch':      testRetagWithPatch(); break;
  case 'retag-with-init':       testRetagWithInit(); break;
  case 'retag-with-changelog':  testRetagWithChangelog(); break;
  case 'retag-with-hotfix':     testRetagWithHotfix(); break;
  case 'retag-multi-conflict':  testRetagMultiConflict(); break;
  default:
    console.log(`RESULT: FAIL unknown --op: ${op}`);
    process.exitCode = 1;
}
