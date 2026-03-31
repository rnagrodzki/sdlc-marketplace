'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  readProjectConfig,
  readLocalConfig,
  readSection,
  writeProjectConfig,
  writeLocalConfig,
  writeSection,
  migrateConfig,
  PROJECT_CONFIG_PATH,
  LOCAL_CONFIG_PATH,
  LEGACY,
  PROJECT_SCHEMA_URL,
  LOCAL_SCHEMA_URL,
} = require(path.join(
  __dirname, '..', '..', 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'config.js'
));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
}

function writeJson(root, relPath, data) {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function readJson(root, relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

/** Capture stderr writes during a synchronous fn call. */
function captureStderr(fn) {
  const original = process.stderr.write;
  const chunks = [];
  process.stderr.write = (chunk) => { chunks.push(String(chunk)); };
  try {
    const result = fn();
    return { result, stderr: chunks.join('') };
  } finally {
    process.stderr.write = original;
  }
}

// ===========================================================================
// readProjectConfig
// ===========================================================================

describe('readProjectConfig', () => {
  it('returns null config when no config files exist', () => {
    const tmp = makeTmpDir();
    try {
      const { config, sources } = readProjectConfig(tmp);
      assert.equal(config, null);
      assert.deepEqual(sources, []);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('reads unified .claude/sdlc.json when present', () => {
    const tmp = makeTmpDir();
    try {
      const data = { $schema: PROJECT_SCHEMA_URL, version: { mode: 'file' } };
      writeJson(tmp, PROJECT_CONFIG_PATH, data);

      const { config, sources } = readProjectConfig(tmp);
      assert.deepEqual(config, data);
      assert.deepEqual(sources, [PROJECT_CONFIG_PATH]);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('prefers unified file over legacy files when both exist', () => {
    const tmp = makeTmpDir();
    try {
      const unified = { $schema: PROJECT_SCHEMA_URL, version: { mode: 'tag' } };
      writeJson(tmp, PROJECT_CONFIG_PATH, unified);
      writeJson(tmp, LEGACY.version, { $schema: 'x', mode: 'file' });

      const { result: { config, sources }, stderr } = captureStderr(
        () => readProjectConfig(tmp)
      );
      assert.deepEqual(config, unified);
      assert.deepEqual(sources, [PROJECT_CONFIG_PATH]);
      assert.equal(stderr, ''); // no deprecation warning
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('falls back to legacy .claude/version.json', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LEGACY.version, { $schema: 'x', mode: 'file', versionFile: 'package.json' });

      const { result: { config, sources }, stderr } = captureStderr(
        () => readProjectConfig(tmp)
      );
      assert.deepEqual(config, { version: { mode: 'file', versionFile: 'package.json' } });
      assert.deepEqual(sources, [LEGACY.version]);
      assert.ok(stderr.includes('Deprecation'));
      assert.ok(stderr.includes(LEGACY.version));
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('falls back to legacy .sdlc/jira-config.json', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LEGACY.jira, { $schema: 'x', defaultProject: 'PROJ' });

      const { result: { config, sources }, stderr } = captureStderr(
        () => readProjectConfig(tmp)
      );
      assert.deepEqual(config, { jira: { defaultProject: 'PROJ' } });
      assert.deepEqual(sources, [LEGACY.jira]);
      assert.ok(stderr.includes(LEGACY.jira));
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('merges legacy version and jira files into one config', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LEGACY.version, { $schema: 'x', mode: 'tag' });
      writeJson(tmp, LEGACY.jira, { $schema: 'x', defaultProject: 'ABC' });

      const { result: { config, sources }, stderr } = captureStderr(
        () => readProjectConfig(tmp)
      );
      assert.deepEqual(config, {
        version: { mode: 'tag' },
        jira: { defaultProject: 'ABC' },
      });
      assert.equal(sources.length, 2);
      // Two deprecation warnings
      assert.equal((stderr.match(/Deprecation/g) || []).length, 2);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('throws on invalid JSON in unified file', () => {
    const tmp = makeTmpDir();
    try {
      const p = path.join(tmp, PROJECT_CONFIG_PATH);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, '{bad json', 'utf8');

      assert.throws(() => readProjectConfig(tmp), /Invalid JSON/);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
});

// ===========================================================================
// readLocalConfig
// ===========================================================================

describe('readLocalConfig', () => {
  it('returns null config when no config files exist', () => {
    const tmp = makeTmpDir();
    try {
      const { config, sources } = readLocalConfig(tmp);
      assert.equal(config, null);
      assert.deepEqual(sources, []);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('reads .sdlc/local.json when present', () => {
    const tmp = makeTmpDir();
    try {
      const data = { $schema: LOCAL_SCHEMA_URL, review: { scope: 'staged' } };
      writeJson(tmp, LOCAL_CONFIG_PATH, data);

      const { config, sources } = readLocalConfig(tmp);
      assert.deepEqual(config, data);
      assert.deepEqual(sources, [LOCAL_CONFIG_PATH]);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('falls back to .sdlc/review.json with defaults flattening', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LEGACY.reviewSdlc, { $schema: 'x', defaults: { scope: 'all' } });

      const { result: { config, sources }, stderr } = captureStderr(
        () => readLocalConfig(tmp)
      );
      assert.deepEqual(config, { review: { scope: 'all' } });
      assert.deepEqual(sources, [LEGACY.reviewSdlc]);
      assert.ok(stderr.includes('Deprecation'));
      assert.ok(stderr.includes(LEGACY.reviewSdlc));
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('falls back to .claude/review.json with defaults flattening', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LEGACY.reviewClaude, { defaults: { scope: 'committed' } });

      const { result: { config, sources }, stderr } = captureStderr(
        () => readLocalConfig(tmp)
      );
      assert.deepEqual(config, { review: { scope: 'committed' } });
      assert.deepEqual(sources, [LEGACY.reviewClaude]);
      assert.ok(stderr.includes(LEGACY.reviewClaude));
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('prefers .sdlc/review.json over .claude/review.json', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LEGACY.reviewSdlc, { defaults: { scope: 'staged' } });
      writeJson(tmp, LEGACY.reviewClaude, { defaults: { scope: 'working' } });

      const { result: { config }, stderr } = captureStderr(
        () => readLocalConfig(tmp)
      );
      assert.deepEqual(config, { review: { scope: 'staged' } });
      // Only warns about the one it reads
      assert.ok(stderr.includes(LEGACY.reviewSdlc));
      assert.ok(!stderr.includes(LEGACY.reviewClaude));
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('prefers .sdlc/local.json over legacy files', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LOCAL_CONFIG_PATH, { review: { scope: 'worktree' } });
      writeJson(tmp, LEGACY.reviewSdlc, { defaults: { scope: 'all' } });

      const { result: { config, sources }, stderr } = captureStderr(
        () => readLocalConfig(tmp)
      );
      assert.deepEqual(config, { review: { scope: 'worktree' } });
      assert.deepEqual(sources, [LOCAL_CONFIG_PATH]);
      assert.equal(stderr, '');
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('reads ship section from .sdlc/local.json', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LOCAL_CONFIG_PATH, { ship: { preset: 'B' } });

      const { config } = readLocalConfig(tmp);
      assert.deepEqual(config.ship, { preset: 'B' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('falls back to .sdlc/ship-config.json for ship when local.json has no ship', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LOCAL_CONFIG_PATH, { review: { scope: 'all' } });
      writeJson(tmp, LEGACY.ship, { $schema: 'x', version: 1, preset: 'A', skip: ['pr'] });

      const { result: { config }, stderr } = captureStderr(
        () => readLocalConfig(tmp)
      );
      assert.deepEqual(config.ship, { preset: 'A', skip: ['pr'] });
      assert.deepEqual(config.review, { scope: 'all' });
      assert.ok(stderr.includes(LEGACY.ship));
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('falls back to .claude/sdlc.json ship key when no other ship source exists', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, PROJECT_CONFIG_PATH, { ship: { preset: 'C' } });

      const { result: { config }, stderr } = captureStderr(
        () => readLocalConfig(tmp)
      );
      assert.deepEqual(config.ship, { preset: 'C' });
      assert.ok(stderr.includes(PROJECT_CONFIG_PATH));
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('returns both review and ship from .sdlc/local.json', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LOCAL_CONFIG_PATH, { review: { scope: 'staged' }, ship: { preset: 'B', auto: true } });

      const { result: { config, sources }, stderr } = captureStderr(
        () => readLocalConfig(tmp)
      );
      assert.deepEqual(config.review, { scope: 'staged' });
      assert.deepEqual(config.ship, { preset: 'B', auto: true });
      assert.deepEqual(sources, [LOCAL_CONFIG_PATH]);
      assert.equal(stderr, '');
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
});

// ===========================================================================
// readSection
// ===========================================================================

describe('readSection', () => {
  it('reads version section from project config', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, PROJECT_CONFIG_PATH, { version: { mode: 'file' }, jira: { defaultProject: 'X' } });

      const result = readSection(tmp, 'version');
      assert.deepEqual(result, { mode: 'file' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('reads review section from local config', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LOCAL_CONFIG_PATH, { review: { scope: 'all' } });

      const result = readSection(tmp, 'review');
      assert.deepEqual(result, { scope: 'all' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('reads ship section from local config', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LOCAL_CONFIG_PATH, { ship: { preset: 'A' } });

      const result = readSection(tmp, 'ship');
      assert.deepEqual(result, { preset: 'A' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('returns null for missing section', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, PROJECT_CONFIG_PATH, { version: { mode: 'file' } });

      const result = readSection(tmp, 'jira');
      assert.equal(result, null);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('returns null for unknown section', () => {
    const tmp = makeTmpDir();
    try {
      const result = readSection(tmp, 'nonexistent');
      assert.equal(result, null);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('reads commit section from project config', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, PROJECT_CONFIG_PATH, { commit: { allowedTypes: ['feat', 'fix'], allowedScopes: ['auth'] } });

      const result = readSection(tmp, 'commit');
      assert.deepEqual(result, { allowedTypes: ['feat', 'fix'], allowedScopes: ['auth'] });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('reads pr section from project config', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, PROJECT_CONFIG_PATH, { pr: { requiredLabels: ['bug', 'feature'], minCommits: 1 } });

      const result = readSection(tmp, 'pr');
      assert.deepEqual(result, { requiredLabels: ['bug', 'feature'], minCommits: 1 });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('returns null when commit section absent', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, PROJECT_CONFIG_PATH, { version: { mode: 'file' } });

      const result = readSection(tmp, 'commit');
      assert.equal(result, null);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('returns null when pr section absent', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, PROJECT_CONFIG_PATH, { version: { mode: 'file' } });

      const result = readSection(tmp, 'pr');
      assert.equal(result, null);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('does not affect other sections when commit/pr are added', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, PROJECT_CONFIG_PATH, { version: { mode: 'file' }, jira: { defaultProject: 'X' } });

      const version = readSection(tmp, 'version');
      const jira = readSection(tmp, 'jira');
      const commit = readSection(tmp, 'commit');

      assert.deepEqual(version, { mode: 'file' });
      assert.deepEqual(jira, { defaultProject: 'X' });
      assert.equal(commit, null);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
});

// ===========================================================================
// writeProjectConfig
// ===========================================================================

describe('writeProjectConfig', () => {
  it('creates .claude/sdlc.json with $schema', () => {
    const tmp = makeTmpDir();
    try {
      writeProjectConfig(tmp, { version: { mode: 'file' } });

      const written = readJson(tmp, PROJECT_CONFIG_PATH);
      assert.equal(written.$schema, PROJECT_SCHEMA_URL);
      assert.deepEqual(written.version, { mode: 'file' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('merges with existing content (does not clobber other sections)', () => {
    const tmp = makeTmpDir();
    try {
      writeProjectConfig(tmp, { version: { mode: 'file' } });
      writeProjectConfig(tmp, { ship: { preset: 'B' } });

      const written = readJson(tmp, PROJECT_CONFIG_PATH);
      assert.deepEqual(written.version, { mode: 'file' });
      assert.deepEqual(written.ship, { preset: 'B' });
      assert.equal(written.$schema, PROJECT_SCHEMA_URL);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('overwrites a section when explicitly provided', () => {
    const tmp = makeTmpDir();
    try {
      writeProjectConfig(tmp, { version: { mode: 'file' } });
      writeProjectConfig(tmp, { version: { mode: 'tag' } });

      const written = readJson(tmp, PROJECT_CONFIG_PATH);
      assert.deepEqual(written.version, { mode: 'tag' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
});

// ===========================================================================
// writeLocalConfig
// ===========================================================================

describe('writeLocalConfig', () => {
  it('creates .sdlc/local.json with $schema', () => {
    const tmp = makeTmpDir();
    try {
      writeLocalConfig(tmp, { review: { scope: 'all' } });

      const written = readJson(tmp, LOCAL_CONFIG_PATH);
      assert.equal(written.$schema, LOCAL_SCHEMA_URL);
      assert.deepEqual(written.review, { scope: 'all' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('merges with existing content', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LOCAL_CONFIG_PATH, { $schema: LOCAL_SCHEMA_URL, review: { scope: 'all' } });
      writeLocalConfig(tmp, { review: { scope: 'staged' } });

      const written = readJson(tmp, LOCAL_CONFIG_PATH);
      assert.deepEqual(written.review, { scope: 'staged' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
});

// ===========================================================================
// writeSection
// ===========================================================================

describe('writeSection', () => {
  it('writes a project section via writeProjectConfig', () => {
    const tmp = makeTmpDir();
    try {
      writeSection(tmp, 'jira', { defaultProject: 'FOO' });

      const written = readJson(tmp, PROJECT_CONFIG_PATH);
      assert.deepEqual(written.jira, { defaultProject: 'FOO' });
      assert.equal(written.$schema, PROJECT_SCHEMA_URL);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('writes review section via writeLocalConfig', () => {
    const tmp = makeTmpDir();
    try {
      writeSection(tmp, 'review', { scope: 'committed' });

      const written = readJson(tmp, LOCAL_CONFIG_PATH);
      assert.deepEqual(written.review, { scope: 'committed' });
      assert.equal(written.$schema, LOCAL_SCHEMA_URL);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('writes ship section via writeLocalConfig', () => {
    const tmp = makeTmpDir();
    try {
      writeSection(tmp, 'ship', { preset: 'C' });

      const written = readJson(tmp, LOCAL_CONFIG_PATH);
      assert.deepEqual(written.ship, { preset: 'C' });
      assert.equal(written.$schema, LOCAL_SCHEMA_URL);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('does not clobber existing sections when writing one', () => {
    const tmp = makeTmpDir();
    try {
      writeSection(tmp, 'version', { mode: 'file' });
      writeSection(tmp, 'ship', { preset: 'C' });

      // version goes to project config
      const project = readJson(tmp, PROJECT_CONFIG_PATH);
      assert.deepEqual(project.version, { mode: 'file' });

      // ship goes to local config
      const local = readJson(tmp, LOCAL_CONFIG_PATH);
      assert.deepEqual(local.ship, { preset: 'C' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
});

// ===========================================================================
// migrateConfig
// ===========================================================================

describe('migrateConfig', () => {
  it('returns empty arrays when no legacy files exist', () => {
    const tmp = makeTmpDir();
    try {
      const { migrated, conflicts } = migrateConfig(tmp);
      assert.deepEqual(migrated, []);
      assert.deepEqual(conflicts, []);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('migrates all legacy files into unified configs', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LEGACY.version, { $schema: 'x', mode: 'tag', tagPrefix: 'v' });
      writeJson(tmp, LEGACY.ship, { $schema: 'x', version: 1, preset: 'B' });
      writeJson(tmp, LEGACY.jira, { $schema: 'x', defaultProject: 'PROJ' });
      writeJson(tmp, LEGACY.reviewSdlc, { $schema: 'x', defaults: { scope: 'all' } });

      const { migrated, conflicts } = migrateConfig(tmp);

      assert.equal(migrated.length, 4);
      assert.deepEqual(conflicts, []);

      // Verify unified project config — ship should NOT be here
      const project = readJson(tmp, PROJECT_CONFIG_PATH);
      assert.equal(project.$schema, PROJECT_SCHEMA_URL);
      assert.deepEqual(project.version, { mode: 'tag', tagPrefix: 'v' });
      assert.deepEqual(project.jira, { defaultProject: 'PROJ' });
      assert.equal(project.ship, undefined);

      // Verify local config — ship and review should be here
      const local = readJson(tmp, LOCAL_CONFIG_PATH);
      assert.equal(local.$schema, LOCAL_SCHEMA_URL);
      assert.deepEqual(local.review, { scope: 'all' });
      assert.deepEqual(local.ship, { preset: 'B' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('reports conflicts when unified file already has the section', () => {
    const tmp = makeTmpDir();
    try {
      // Pre-existing unified config with version section
      writeJson(tmp, PROJECT_CONFIG_PATH, {
        $schema: PROJECT_SCHEMA_URL,
        version: { mode: 'file' },
      });
      // Legacy version file that would conflict
      writeJson(tmp, LEGACY.version, { $schema: 'x', mode: 'tag' });
      // Non-conflicting legacy ship file — migrates to local config
      writeJson(tmp, LEGACY.ship, { $schema: 'x', version: 1, preset: 'A' });

      const { migrated, conflicts } = migrateConfig(tmp);

      // Conflicting files go to conflicts only, not migrated
      assert.ok(!migrated.includes(LEGACY.version));
      assert.ok(migrated.includes(LEGACY.ship));
      assert.ok(conflicts.includes(LEGACY.version));
      assert.ok(!conflicts.includes(LEGACY.ship));

      // Version should NOT be overwritten in project config
      const project = readJson(tmp, PROJECT_CONFIG_PATH);
      assert.deepEqual(project.version, { mode: 'file' });
      // Ship should NOT be in project config
      assert.equal(project.ship, undefined);

      // Ship should be in local config
      const local = readJson(tmp, LOCAL_CONFIG_PATH);
      assert.deepEqual(local.ship, { preset: 'A' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('reports conflict for review when local.json already has review', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LOCAL_CONFIG_PATH, {
        $schema: LOCAL_SCHEMA_URL,
        review: { scope: 'worktree' },
      });
      writeJson(tmp, LEGACY.reviewSdlc, { defaults: { scope: 'all' } });

      const { migrated, conflicts } = migrateConfig(tmp);

      // Conflicting files go to conflicts only, not migrated
      assert.ok(!migrated.includes(LEGACY.reviewSdlc));
      assert.ok(conflicts.includes(LEGACY.reviewSdlc));

      // Review should NOT be overwritten
      const local = readJson(tmp, LOCAL_CONFIG_PATH);
      assert.deepEqual(local.review, { scope: 'worktree' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('does not delete legacy files', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LEGACY.version, { $schema: 'x', mode: 'file' });
      migrateConfig(tmp);

      // Legacy file should still exist
      assert.ok(fs.existsSync(path.join(tmp, LEGACY.version)));
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('prefers .sdlc/review.json over .claude/review.json for migration', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LEGACY.reviewSdlc, { defaults: { scope: 'staged' } });
      writeJson(tmp, LEGACY.reviewClaude, { defaults: { scope: 'working' } });

      const { migrated } = migrateConfig(tmp);

      assert.ok(migrated.includes(LEGACY.reviewSdlc));
      assert.ok(!migrated.includes(LEGACY.reviewClaude));

      const local = readJson(tmp, LOCAL_CONFIG_PATH);
      assert.deepEqual(local.review, { scope: 'staged' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('falls back to .claude/review.json when .sdlc/review.json is absent', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LEGACY.reviewClaude, { defaults: { scope: 'committed' } });

      const { migrated } = migrateConfig(tmp);

      assert.ok(migrated.includes(LEGACY.reviewClaude));

      const local = readJson(tmp, LOCAL_CONFIG_PATH);
      assert.deepEqual(local.review, { scope: 'committed' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('migrates ship from .claude/sdlc.json to .sdlc/local.json and removes it from project config', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, PROJECT_CONFIG_PATH, {
        $schema: 'x',
        version: { mode: 'file' },
        ship: { preset: 'B' },
      });

      const { migrated, conflicts } = migrateConfig(tmp);

      assert.ok(migrated.includes(PROJECT_CONFIG_PATH + '#ship'));
      assert.deepEqual(conflicts, []);

      // Ship should be in local config
      const local = readJson(tmp, LOCAL_CONFIG_PATH);
      assert.deepEqual(local.ship, { preset: 'B' });

      // Ship should be removed from project config, version should remain
      const project = readJson(tmp, PROJECT_CONFIG_PATH);
      assert.equal(project.ship, undefined);
      assert.deepEqual(project.version, { mode: 'file' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('reports conflict when local.json already has ship and .claude/sdlc.json also has ship', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, LOCAL_CONFIG_PATH, { ship: { preset: 'A' } });
      writeJson(tmp, PROJECT_CONFIG_PATH, {
        version: { mode: 'file' },
        ship: { preset: 'B' },
      });

      const { migrated, conflicts } = migrateConfig(tmp);

      // Conflict because local already has ship
      assert.ok(conflicts.includes(PROJECT_CONFIG_PATH + '#ship'));
      assert.ok(!migrated.includes(PROJECT_CONFIG_PATH + '#ship'));

      // Local ship should NOT be overwritten (still preset A)
      const local = readJson(tmp, LOCAL_CONFIG_PATH);
      assert.deepEqual(local.ship, { preset: 'A' });

      // Ship should still be removed from project config
      const project = readJson(tmp, PROJECT_CONFIG_PATH);
      assert.equal(project.ship, undefined);
      assert.deepEqual(project.version, { mode: 'file' });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
});
