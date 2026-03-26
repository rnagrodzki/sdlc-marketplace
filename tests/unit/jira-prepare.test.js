'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const child_process = require('child_process');

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'plugins', 'sdlc-utilities', 'scripts', 'jira-prepare.js');
const { getCachePath } = require(SCRIPT_PATH);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jira-test-'));
}

function runCopyTemplate(projectDir, type, from, templatesDir) {
  const result = child_process.execFileSync('node', [
    SCRIPT_PATH,
    '--project', 'TEST',
    '--copy-template',
    '--type', type,
    '--from', from,
    '--templates-dir', templatesDir,
  ], {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(result);
}

// ---------------------------------------------------------------------------
// getCachePath — .gitignore creation
// ---------------------------------------------------------------------------

describe('getCachePath', () => {
  it('creates .gitignore with * in the cache directory', () => {
    const tmpDir = makeTmpDir();
    try {
      const tmpCacheDir = path.join(tmpDir, 'cache');
      getCachePath('TEST', tmpCacheDir);
      const gitignorePath = path.join(tmpCacheDir, '.gitignore');
      assert.equal(fs.existsSync(gitignorePath), true);
      assert.equal(fs.readFileSync(gitignorePath, 'utf8'), '*\n');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('does not overwrite an existing .gitignore', () => {
    const tmpDir = makeTmpDir();
    try {
      const tmpCacheDir = path.join(tmpDir, 'cache');
      // First call — creates .gitignore
      getCachePath('TEST', tmpCacheDir);
      // Overwrite with custom content
      fs.writeFileSync(path.join(tmpCacheDir, '.gitignore'), 'custom\n', 'utf8');
      // Second call — must not overwrite
      getCachePath('TEST', tmpCacheDir);
      assert.equal(fs.readFileSync(path.join(tmpCacheDir, '.gitignore'), 'utf8'), 'custom\n');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('returns the correct cache file path', () => {
    const tmpDir = makeTmpDir();
    try {
      const tmpCacheDir = path.join(tmpDir, 'cache');
      const result = getCachePath('TEST', tmpCacheDir);
      assert.equal(result, path.join(tmpCacheDir, 'TEST.json'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// copyTemplate — subprocess tests
// ---------------------------------------------------------------------------

describe('copyTemplate', () => {
  it('copies source template to destination with a different name', () => {
    const tmpDir = makeTmpDir();
    try {
      const templatesDir = path.join(tmpDir, 'templates');
      const projectDir = path.join(tmpDir, 'project');
      fs.mkdirSync(templatesDir, { recursive: true });
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(templatesDir, 'Task.md'), '# Task Template\n', 'utf8');

      const out = runCopyTemplate(projectDir, 'Zadanie', 'Task', templatesDir);

      assert.equal(out.copied, true);
      assert.equal(out.type, 'Zadanie');
      assert.equal(out.from, 'Task');

      const destFile = path.join(projectDir, '.claude', 'jira-templates', 'Zadanie.md');
      assert.equal(fs.existsSync(destFile), true);
      assert.equal(fs.readFileSync(destFile, 'utf8'), '# Task Template\n');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('exits with code 1 when the source template does not exist', () => {
    const tmpDir = makeTmpDir();
    try {
      const templatesDir = path.join(tmpDir, 'templates');
      const projectDir = path.join(tmpDir, 'project');
      fs.mkdirSync(templatesDir, { recursive: true });
      fs.mkdirSync(projectDir, { recursive: true });

      let threw = false;
      try {
        runCopyTemplate(projectDir, 'Zadanie', 'NonExistent', templatesDir);
      } catch (err) {
        threw = true;
        assert.equal(err.status, 1);
      }
      assert.equal(threw, true, 'Expected execFileSync to throw for exit code 1');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('returns copied:false with reason:exists when destination already exists', () => {
    const tmpDir = makeTmpDir();
    try {
      const templatesDir = path.join(tmpDir, 'templates');
      const projectDir = path.join(tmpDir, 'project');
      fs.mkdirSync(templatesDir, { recursive: true });
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(templatesDir, 'Task.md'), '# Task Template\n', 'utf8');

      // Pre-create the destination
      const destDir = path.join(projectDir, '.claude', 'jira-templates');
      fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(path.join(destDir, 'Zadanie.md'), '# Existing\n', 'utf8');

      const out = runCopyTemplate(projectDir, 'Zadanie', 'Task', templatesDir);

      assert.equal(out.copied, false);
      assert.equal(out.reason, 'exists');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('creates the destination directory when it does not exist', () => {
    const tmpDir = makeTmpDir();
    try {
      const templatesDir = path.join(tmpDir, 'templates');
      const projectDir = path.join(tmpDir, 'project');
      fs.mkdirSync(templatesDir, { recursive: true });
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(templatesDir, 'Task.md'), '# Task Template\n', 'utf8');

      // Deliberately do not create .claude/jira-templates/
      const destDir = path.join(projectDir, '.claude', 'jira-templates');
      assert.equal(fs.existsSync(destDir), false);

      const out = runCopyTemplate(projectDir, 'Task', 'Task', templatesDir);

      assert.equal(out.copied, true);
      assert.equal(fs.existsSync(destDir), true);
      assert.equal(fs.existsSync(path.join(destDir, 'Task.md')), true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});
