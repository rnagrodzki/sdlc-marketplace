#!/usr/bin/env node
/**
 * run-context-advisory.js
 * Test harness that calls context-advisory.getAdvisory() and prints the result
 * to stdout (advisory text or the literal "null" line). Used by
 * datasets/context-advisory-exec.yaml.
 *
 * Usage: node run-context-advisory.js <skill-name>
 */

'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const helperPath = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'context-advisory.js');

const skill = process.argv[2] || 'plan-sdlc';

const { getAdvisory } = require(helperPath);
const result = getAdvisory({ skill });

if (result === null) {
  console.log('null');
} else {
  console.log(result);
}
