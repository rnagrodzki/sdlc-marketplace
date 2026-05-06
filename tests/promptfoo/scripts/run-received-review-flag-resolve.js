#!/usr/bin/env node
/**
 * run-received-review-flag-resolve.js
 * Test harness that exercises the received-review-sdlc flag-resolution path
 * (issue #233) without invoking gh API. Mirrors the resolution logic from
 * `plugins/sdlc-utilities/scripts/skill/received-review.js`:
 *
 *   1. Detect `receivedReview.alwaysFixSeverities` misplaced in
 *      `.sdlc/config.json` → emit one stderr warning.
 *   2. Resolve the canonical value from `.sdlc/local.json` via
 *      `readSection(projectRoot, 'receivedReview')`.
 *   3. Emit a JSON manifest fragment to stdout matching the production
 *      manifest shape: `{ "flags": { "alwaysFixSeverities": [...] } }`.
 *
 * Usage:
 *   node run-received-review-flag-resolve.js [--project-root <path>]
 *
 * Default project root is process.cwd() — used by the script-runner provider
 * with `script_cwd: file://fixtures-fs/<fixture>` so the fixture's setup.sh
 * has already produced the .sdlc/{local,config}.json layout.
 */

'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const configPath = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'config.js');

const { readSection, readProjectConfig } = require(configPath);

const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

function resolveAlwaysFixSeverities(projectRoot) {
  // Misplacement check: warn when found in project config (R19, C15).
  try {
    const { config: projectConfig } = readProjectConfig(projectRoot);
    const misplaced = projectConfig?.receivedReview?.alwaysFixSeverities;
    if (misplaced !== undefined) {
      process.stderr.write(
        'warning: receivedReview.alwaysFixSeverities found in .sdlc/config.json — ' +
        'this field is local-only and will be ignored. Move it to .sdlc/local.json.\n'
      );
    }
  } catch (_) { /* missing or unreadable project config — silent */ }

  const local = readSection(projectRoot, 'receivedReview');
  const list = local?.alwaysFixSeverities;
  if (!Array.isArray(list)) return [];
  return list.filter(s => typeof s === 'string' && VALID_SEVERITIES.has(s));
}

// Argument parsing
let projectRoot = process.cwd();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--project-root' && argv[i + 1]) projectRoot = path.resolve(argv[++i]);
}

const alwaysFixSeverities = resolveAlwaysFixSeverities(projectRoot);
process.stdout.write(JSON.stringify({ flags: { alwaysFixSeverities } }) + '\n');
