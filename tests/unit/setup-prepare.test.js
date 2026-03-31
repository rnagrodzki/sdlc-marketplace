'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { detect } = require(path.join(
  __dirname, '..', '..', 'plugins', 'sdlc-utilities', 'scripts', 'setup-prepare.js'
));

const { PROJECT_CONFIG_PATH, LEGACY } = require(path.join(
  __dirname, '..', '..', 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'config.js'
));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'setup-prepare-test-'));
}

function writeJson(root, relPath, data) {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ===========================================================================
// detect() — misplaced sections and needsMigration
// ===========================================================================

describe('detect()', () => {
  it('reports ship in project config as misplaced', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, PROJECT_CONFIG_PATH, {
        $schema: 'x',
        version: { mode: 'file' },
        ship: { preset: 'B' },
      });

      const result = detect(tmp);

      assert.deepEqual(result.projectConfig.sections, ['version', 'ship']);
      assert.deepEqual(result.projectConfig.misplaced, ['ship']);
      assert.equal(result.needsMigration, true);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('reports no misplaced sections for clean project config', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, PROJECT_CONFIG_PATH, {
        $schema: 'x',
        version: { mode: 'file' },
      });

      const result = detect(tmp);

      assert.deepEqual(result.projectConfig.sections, ['version']);
      assert.deepEqual(result.projectConfig.misplaced, []);
      assert.equal(result.needsMigration, false);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('returns empty arrays when no project config exists', () => {
    const tmp = makeTmpDir();
    try {
      const result = detect(tmp);

      assert.equal(result.projectConfig.exists, false);
      assert.deepEqual(result.projectConfig.sections, []);
      assert.deepEqual(result.projectConfig.misplaced, []);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('reports multiple misplaced sections', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, PROJECT_CONFIG_PATH, {
        $schema: 'x',
        version: { mode: 'file' },
        ship: { preset: 'B' },
        review: { scope: 'committed' },
      });

      const result = detect(tmp);

      assert.deepEqual(result.projectConfig.misplaced, ['ship', 'review']);
      assert.equal(result.needsMigration, true);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('sets needsMigration when legacy files exist without misplaced sections', () => {
    const tmp = makeTmpDir();
    try {
      writeJson(tmp, PROJECT_CONFIG_PATH, {
        $schema: 'x',
        version: { mode: 'file' },
      });
      // Create legacy ship-config.json
      writeJson(tmp, LEGACY.ship, { preset: 'A', version: 1 });

      const result = detect(tmp);

      assert.deepEqual(result.projectConfig.misplaced, []);
      assert.equal(result.needsMigration, true);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
});
