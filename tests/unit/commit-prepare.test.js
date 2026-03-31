'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const child_process = require('child_process');

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'plugins', 'sdlc-utilities', 'scripts', 'commit-prepare.js');
const { parseArgs } = require(SCRIPT_PATH);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'commit-prepare-test-'));
}

function writeJson(root, relPath, data) {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function initGitRepo(tmpDir) {
  child_process.execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  child_process.execSync('git config user.email "test@example.com"', { cwd: tmpDir, stdio: 'pipe' });
  child_process.execSync('git config user.name "Test User"', { cwd: tmpDir, stdio: 'pipe' });
}

function createCommit(tmpDir, message) {
  const testFile = path.join(tmpDir, 'test.txt');
  fs.writeFileSync(testFile, `content\n`, 'utf8');
  child_process.execSync('git add test.txt', { cwd: tmpDir, stdio: 'pipe' });
  child_process.execSync(`git commit -m "${message}"`, { cwd: tmpDir, stdio: 'pipe' });
}

function stageFile(tmpDir, filePath, content = 'staged content') {
  const abs = path.join(tmpDir, filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  child_process.execSync(`git add "${filePath}"`, { cwd: tmpDir, stdio: 'pipe' });
}

function runCommitPrepare(projectDir, args = []) {
  const result = child_process.execFileSync('node', [SCRIPT_PATH, ...args], {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(result);
}

// ===========================================================================
// parseArgs
// ===========================================================================

describe('parseArgs', () => {
  it('parses --type flag', () => {
    const result = parseArgs(['node', 'script.js', '--type', 'feat']);
    assert.equal(result.type, 'feat');
  });

  it('parses --scope flag', () => {
    const result = parseArgs(['node', 'script.js', '--scope', 'auth']);
    assert.equal(result.scope, 'auth');
  });

  it('parses --no-stash flag', () => {
    const result = parseArgs(['node', 'script.js', '--no-stash']);
    assert.equal(result.noStash, true);
  });

  it('parses --amend flag', () => {
    const result = parseArgs(['node', 'script.js', '--amend']);
    assert.equal(result.amend, true);
  });

  it('parses --auto flag', () => {
    const result = parseArgs(['node', 'script.js', '--auto']);
    assert.equal(result.auto, true);
  });

  it('returns defaults when no args provided', () => {
    const result = parseArgs(['node', 'script.js']);
    assert.equal(result.type, null);
    assert.equal(result.scope, null);
    assert.equal(result.noStash, false);
    assert.equal(result.amend, false);
    assert.equal(result.auto, false);
  });
});

// ===========================================================================
// Integration: commit config reading
// ===========================================================================

describe('commit-prepare integration: config reading', () => {
  it('includes commitConfig in output when config exists', () => {
    const tmpDir = makeTmpDir();
    try {
      initGitRepo(tmpDir);
      createCommit(tmpDir, 'initial');
      writeJson(tmpDir, '.claude/sdlc.json', { commit: { allowedTypes: ['feat', 'fix'] } });
      stageFile(tmpDir, 'src/index.js');

      const output = runCommitPrepare(tmpDir);

      assert.ok(output.commitConfig);
      assert.deepEqual(output.commitConfig.allowedTypes, ['feat', 'fix']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('sets commitConfig to null when no config exists', () => {
    const tmpDir = makeTmpDir();
    try {
      initGitRepo(tmpDir);
      createCommit(tmpDir, 'initial');
      stageFile(tmpDir, 'src/index.js');

      const output = runCommitPrepare(tmpDir);

      assert.equal(output.commitConfig, null);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

// ===========================================================================
// Integration: flag validation against config
// ===========================================================================

describe('commit-prepare integration: flag validation', () => {
  it('includes validation error in output when --type conflicts with allowedTypes', () => {
    const tmpDir = makeTmpDir();
    try {
      initGitRepo(tmpDir);
      createCommit(tmpDir, 'initial');
      writeJson(tmpDir, '.claude/sdlc.json', { commit: { allowedTypes: ['feat', 'fix'] } });
      stageFile(tmpDir, 'src/index.js');

      const output = runCommitPrepare(tmpDir, ['--type', 'chore']);

      assert.ok(output.errors.some(e => e.includes('not allowed')));
      assert.ok(output.errors.some(e => e.includes('Allowed types')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('includes validation error in output when --scope conflicts with allowedScopes', () => {
    const tmpDir = makeTmpDir();
    try {
      initGitRepo(tmpDir);
      createCommit(tmpDir, 'initial');
      writeJson(tmpDir, '.claude/sdlc.json', { commit: { allowedScopes: ['auth', 'db'] } });
      stageFile(tmpDir, 'src/index.js');

      const output = runCommitPrepare(tmpDir, ['--scope', 'ui']);

      assert.ok(output.errors.some(e => e.includes('not allowed')));
      assert.ok(output.errors.some(e => e.includes('Allowed scopes')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('exits with code 0 when --type matches allowedTypes', () => {
    const tmpDir = makeTmpDir();
    try {
      initGitRepo(tmpDir);
      createCommit(tmpDir, 'initial');
      writeJson(tmpDir, '.claude/sdlc.json', { commit: { allowedTypes: ['feat', 'fix'] } });
      stageFile(tmpDir, 'src/index.js');

      const output = runCommitPrepare(tmpDir, ['--type', 'feat']);

      assert.equal(output.errors.length, 0);
      assert.equal(output.flags.type, 'feat');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('exits with code 0 when --scope matches allowedScopes', () => {
    const tmpDir = makeTmpDir();
    try {
      initGitRepo(tmpDir);
      createCommit(tmpDir, 'initial');
      writeJson(tmpDir, '.claude/sdlc.json', { commit: { allowedScopes: ['auth', 'db'] } });
      stageFile(tmpDir, 'src/index.js');

      const output = runCommitPrepare(tmpDir, ['--scope', 'auth']);

      assert.equal(output.errors.length, 0);
      assert.equal(output.flags.scope, 'auth');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('exits with code 0 when no config and --type is provided', () => {
    const tmpDir = makeTmpDir();
    try {
      initGitRepo(tmpDir);
      createCommit(tmpDir, 'initial');
      stageFile(tmpDir, 'src/index.js');

      const output = runCommitPrepare(tmpDir, ['--type', 'anything']);

      assert.equal(output.errors.length, 0);
      assert.equal(output.flags.type, 'anything');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});
