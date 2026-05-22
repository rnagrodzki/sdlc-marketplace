/**
 * setup-migrate-dispatch-test.js — exec-only tests for setup.js prepare output
 * of legacy.jiraTemplates detection (R-LEGACY-DETECT, #423) and migration dispatch.
 *
 * Operations (--op):
 *   legacy-jira-templates-detected  — project with .claude/jira-templates/ → legacy.jiraTemplates.exists=true
 *   no-legacy-jira-templates        — project without legacy dir → legacy.jiraTemplates.exists=false
 */

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT   = path.resolve(__dirname, '../../..');
const SETUP_JS    = path.join(REPO_ROOT, 'plugins/sdlc-utilities/scripts/skill/setup.js');
const FIXTURES_FS = path.join(REPO_ROOT, 'tests/promptfoo/fixtures-fs/setup-migrate-dispatch');

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

function testLegacyJiraTemplatesDetected() {
  // only-jira-templates: has .claude/jira-templates/
  const fixture = path.join(FIXTURES_FS, 'only-jira-templates');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-md-jira-'));
  try {
    copyDirRecursive(fixture, tmp);
    const r = runSetupJs(tmp);
    if (!r.json) return emit(false, `no json: exit=${r.exitCode} stderr=${r.stderr}`);
    const jt = r.json.legacy && r.json.legacy.jiraTemplates;
    if (!jt) return emit(false, `legacy.jiraTemplates missing from output`);
    if (jt.exists !== true) return emit(false, `expected legacy.jiraTemplates.exists=true, got ${jt.exists}`);
    if (!jt.path || !jt.path.includes('jira-templates')) {
      return emit(false, `expected jiraTemplates.path to include jira-templates, got ${jt.path}`);
    }
    emit(true, `legacy-jira-templates-detected: exists=true path=${jt.path}`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

function testNoLegacyJiraTemplates() {
  // none: no legacy .claude/jira-templates/
  const fixture = path.join(FIXTURES_FS, 'none');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-md-none-'));
  try {
    copyDirRecursive(fixture, tmp);
    const r = runSetupJs(tmp);
    if (!r.json) return emit(false, `no json: exit=${r.exitCode} stderr=${r.stderr}`);
    const jt = r.json.legacy && r.json.legacy.jiraTemplates;
    if (!jt) return emit(false, `legacy.jiraTemplates missing from output`);
    if (jt.exists !== false) return emit(false, `expected legacy.jiraTemplates.exists=false, got ${jt.exists}`);
    emit(true, `no-legacy-jira-templates: exists=false`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

// ---- Dispatch ----
const op = arg('--op', '');
switch (op) {
  case 'legacy-jira-templates-detected': testLegacyJiraTemplatesDetected(); break;
  case 'no-legacy-jira-templates':       testNoLegacyJiraTemplates(); break;
  default:
    console.log(`RESULT: FAIL unknown --op: ${op}`);
    process.exitCode = 1;
}
