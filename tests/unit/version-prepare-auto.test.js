'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'plugins', 'sdlc-utilities', 'scripts', 'version-prepare.js');
const { parseArgs } = require(SCRIPT_PATH);

describe('version-prepare parseArgs --auto', () => {
  it('--auto alone → auto: true', () => {
    const result = parseArgs(['node', 'script', '--auto']);
    assert.equal(result.auto, true);
  });

  it('No flags → auto: false', () => {
    const result = parseArgs(['node', 'script']);
    assert.equal(result.auto, false);
  });

  it('--auto combined with bump and other flags → all fields correct', () => {
    const result = parseArgs(['node', 'script', 'patch', '--auto', '--hotfix']);
    assert.equal(result.auto, true);
    assert.equal(result.requestedBump, 'patch');
    assert.equal(result.hotfix, true);
  });

  it('--auto does not produce "Unknown flag" warning', () => {
    const result = parseArgs(['node', 'script', '--auto']);
    assert.equal(result.warnings.length, 0);
  });

  it('Unknown flags still produce warnings (regression guard)', () => {
    const result = parseArgs(['node', 'script', '--foobar']);
    assert.equal(result.warnings.length > 0, true);
  });
});
