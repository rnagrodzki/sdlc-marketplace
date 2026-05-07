#!/usr/bin/env node
/**
 * run-ensure-sdlc-gitignore-idempotent.js
 * Test driver for `lib/config.js::ensureSdlcGitignore` byte-identity contract
 * (issue #266 R-sdlc-gitignore-idempotent).
 *
 * Invokes ensureSdlcGitignore against a fixture's `.sdlc/.gitignore` twice and
 * prints a JSON report:
 *   {
 *     "firstStatus": "created" | "updated" | "unchanged",
 *     "secondStatus": "unchanged",
 *     "byteIdentical": true,
 *     "noStrayBlanks": true,
 *     "finalContent": "..."
 *   }
 *
 * Usage: node run-ensure-sdlc-gitignore-idempotent.js <fixture-project-root>
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const REPO_ROOT  = path.resolve(__dirname, '..', '..', '..');
const CONFIG_LIB = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'config.js');
const { ensureSdlcGitignore } = require(CONFIG_LIB);

const fixtureRoot = process.argv[2];
if (!fixtureRoot) {
  process.stderr.write('Usage: run-ensure-sdlc-gitignore-idempotent.js <fixture-project-root>\n');
  process.exit(2);
}

const gitignorePath = path.join(fixtureRoot, '.sdlc', '.gitignore');

const firstStatus  = ensureSdlcGitignore(fixtureRoot);
const afterFirst   = fs.readFileSync(gitignorePath, 'utf8');
const secondStatus = ensureSdlcGitignore(fixtureRoot);
const afterSecond  = fs.readFileSync(gitignorePath, 'utf8');

// "No stray blanks" check: the file must not contain consecutive blank lines
// in the user-authored portion. A single blank between user content and the
// managed block is allowed (and required) — but no runs of 2+ blank lines.
const hasStrayBlanks = /\n\s*\n\s*\n/.test(afterFirst);

const report = {
  firstStatus,
  secondStatus,
  byteIdentical: afterFirst === afterSecond,
  noStrayBlanks: !hasStrayBlanks,
  finalContent: afterFirst,
};

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
process.exit(0);
