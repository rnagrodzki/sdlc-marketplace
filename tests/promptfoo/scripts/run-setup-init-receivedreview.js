#!/usr/bin/env node
/**
 * run-setup-init-receivedreview.js
 * Test harness for issue #233 setup-init round-trip:
 *   1. Invoke setup-init.js with --local-config containing
 *      receivedReview.alwaysFixSeverities.
 *   2. Read the resulting .sdlc/local.json and .sdlc/config.json.
 *   3. Emit a JSON summary asserting the field landed in local.json and is
 *      absent from config.json — the local-only contract per R19/C15.
 *
 * The harness must be invoked from a fixture-fs cwd (project root). It runs
 * setup-init in process.cwd() and reads the resulting files relative to cwd.
 *
 * Usage: node run-setup-init-receivedreview.js
 *
 * Stdout (JSON):
 *   {
 *     "localHasField": true|false,
 *     "localValue": [...],
 *     "projectHasField": true|false,
 *     "projectExists": true|false
 *   }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SETUP_INIT = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'util', 'setup-init.js');

const projectRoot = process.cwd();

const localConfigArg = JSON.stringify({
  receivedReview: { alwaysFixSeverities: ['high', 'critical'] },
});

try {
  execFileSync('node', [SETUP_INIT, '--local-config', localConfigArg], {
    cwd: projectRoot,
    stdio: ['ignore', 'ignore', 'pipe'],
    timeout: 15000,
  });
} catch (err) {
  process.stderr.write(`setup-init failed: ${err.message}\n`);
  process.exit(2);
}

const localPath = path.join(projectRoot, '.sdlc', 'local.json');
const projectPath = path.join(projectRoot, '.sdlc', 'config.json');

const local = fs.existsSync(localPath) ? JSON.parse(fs.readFileSync(localPath, 'utf8')) : {};
const projectExists = fs.existsSync(projectPath);
const project = projectExists ? JSON.parse(fs.readFileSync(projectPath, 'utf8')) : {};

const result = {
  localHasField: !!(local.receivedReview && Array.isArray(local.receivedReview.alwaysFixSeverities)),
  localValue: local.receivedReview?.alwaysFixSeverities || null,
  projectHasField: !!(project.receivedReview && project.receivedReview.alwaysFixSeverities !== undefined),
  projectExists,
};

process.stdout.write(JSON.stringify(result) + '\n');
