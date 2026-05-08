#!/usr/bin/env node
/**
 * run-verify-pipeline-evaluate.js
 *
 * Test driver for the pure helpers exported by:
 *   - plugins/sdlc-utilities/scripts/skill/verify-pipeline.js (evaluateChecks)
 *   - plugins/sdlc-utilities/scripts/skill/verify-pipeline-sdlc-classify.js (classifyLogs)
 *
 * Usage:
 *   node run-verify-pipeline-evaluate.js --op evaluateChecks --input '<json>'
 *   node run-verify-pipeline-evaluate.js --op classifyLogs   --input '<text>'
 *
 * Stdout: single JSON line — verdict from the helper.
 */

'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const VP        = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'skill', 'verify-pipeline.js');
const CLASSIFY  = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'skill', 'verify-pipeline-sdlc-classify.js');

function getArg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

const op = getArg('--op');
const input = getArg('--input');

if (!op) {
  console.error('--op is required (evaluateChecks | classifyLogs)');
  process.exit(1);
}

if (op === 'evaluateChecks') {
  const { evaluateChecks } = require(VP);
  let parsed;
  try { parsed = input ? JSON.parse(input) : []; } catch (e) { parsed = []; }
  process.stdout.write(JSON.stringify(evaluateChecks(parsed)) + '\n');
} else if (op === 'classifyLogs') {
  const { classifyLogs } = require(CLASSIFY);
  process.stdout.write(JSON.stringify(classifyLogs(input || '')) + '\n');
} else {
  console.error(`unknown --op: ${op}`);
  process.exit(1);
}
