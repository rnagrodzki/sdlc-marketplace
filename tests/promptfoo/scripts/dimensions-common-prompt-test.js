#!/usr/bin/env node
/**
 * dimensions-common-prompt-test.js
 * Tests readCommonPrompt function with various fixture scenarios.
 *
 * Tests:
 *   - readCommonPrompt returns content when _common.md exists
 *   - readCommonPrompt returns null when _common.md doesn't exist
 *   - readCommonPrompt returns null when directory doesn't exist
 *   - readCommonPrompt trims whitespace from content
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const LIB = path.join(__dirname, '..', '..', '..', 'plugins', 'sdlc-utilities', 'scripts', 'lib');
const { readCommonPrompt } = require(path.join(LIB, 'dimensions'));

const FIXTURES = path.join(__dirname, '..', 'fixtures-fs');

// Test 1: readCommonPrompt returns content when _common.md exists
{
  const result = readCommonPrompt(path.join(FIXTURES, 'project-with-dimensions'));
  const expected = 'This is common prompt content shared across all review dimensions.\nIt provides baseline guidance for all reviewers.';
  if (result !== expected) {
    console.error(`FAIL: Test 1 - Expected content mismatch`);
    console.error(`Expected: ${JSON.stringify(expected)}`);
    console.error(`Got: ${JSON.stringify(result)}`);
    process.exit(1);
  }
  console.log('PASS: Test 1 - readCommonPrompt returns content when _common.md exists');
}

// Test 2: readCommonPrompt returns null when _common.md doesn't exist
{
  const result = readCommonPrompt(path.join(FIXTURES, 'project-no-dimensions'));
  if (result !== null) {
    console.error(`FAIL: Test 2 - Expected null when _common.md doesn't exist, got ${JSON.stringify(result)}`);
    process.exit(1);
  }
  console.log('PASS: Test 2 - readCommonPrompt returns null when _common.md doesn\'t exist');
}

// Test 3: readCommonPrompt returns null when directory doesn't exist
{
  const result = readCommonPrompt(path.join(FIXTURES, 'nonexistent-project'));
  if (result !== null) {
    console.error(`FAIL: Test 3 - Expected null when directory doesn't exist, got ${JSON.stringify(result)}`);
    process.exit(1);
  }
  console.log('PASS: Test 3 - readCommonPrompt returns null when directory doesn\'t exist');
}

// Test 4: readCommonPrompt trims whitespace
(function () {
  // Create a temporary fixture with _common.md containing whitespace
  const tempFixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dimensions-common-'));
  const reviewDimensionsDir = path.join(tempFixtureDir, '.sdlc', 'review-dimensions');

  try {
    fs.mkdirSync(reviewDimensionsDir, { recursive: true });
    fs.writeFileSync(
      path.join(reviewDimensionsDir, '_common.md'),
      '\n\n  Test content with whitespace  \n\n'
    );

    const result = readCommonPrompt(tempFixtureDir);
    const expected = 'Test content with whitespace';
    if (result !== expected) {
      console.error(`FAIL: Test 4 - Whitespace not trimmed properly`);
      console.error(`Expected: ${JSON.stringify(expected)}`);
      console.error(`Got: ${JSON.stringify(result)}`);
      process.exitCode = 1;
      return;
    }
    console.log('PASS: Test 4 - readCommonPrompt trims whitespace');
  } finally {
    // Cleanup
    try {
      fs.rmSync(tempFixtureDir, { recursive: true, force: true });
    } catch {}
  }
})();

// Test 5: readCommonPrompt returns null for empty file (after trimming)
(function () {
  const tempFixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dimensions-common-'));
  const reviewDimensionsDir = path.join(tempFixtureDir, '.sdlc', 'review-dimensions');

  try {
    fs.mkdirSync(reviewDimensionsDir, { recursive: true });
    fs.writeFileSync(
      path.join(reviewDimensionsDir, '_common.md'),
      '   \n\n   '
    );

    const result = readCommonPrompt(tempFixtureDir);
    if (result !== null) {
      console.error(`FAIL: Test 5 - Expected null for empty file, got ${JSON.stringify(result)}`);
      process.exitCode = 1;
      return;
    }
    console.log('PASS: Test 5 - readCommonPrompt returns null for empty file');
  } finally {
    // Cleanup
    try {
      fs.rmSync(tempFixtureDir, { recursive: true, force: true });
    } catch {}
  }
})();

if (!process.exitCode) console.log('\nAll readCommonPrompt tests passed!');
