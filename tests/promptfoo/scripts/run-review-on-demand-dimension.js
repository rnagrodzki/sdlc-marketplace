#!/usr/bin/env node
/**
 * run-review-on-demand-dimension.js
 * Test harness for the forced-active on-demand dimension behavior (issue #362).
 *
 * Exercises loadAndMatchDimensions logic from review.js against the
 * project-on-demand-dimension fixture, verifying that a dimension whose triggers
 * match zero changed files is forced ACTIVE when named in --dimensions, and stays
 * SKIPPED when --dimensions is not passed.
 *
 * Usage:
 *   node run-review-on-demand-dimension.js --project-root <path> --scenario <forced|default>
 *
 * Scenarios:
 *   forced  — passes dimensionFilter=['qa-on-demand']; expects status ACTIVE
 *   default — passes dimensionFilter=null; expects status SKIPPED
 *
 * Output:
 *   JSON: { name, status, matched_files_count, changed_files_count, forced }
 *
 * Notes:
 *   - Imports the REAL loadAndMatchDimensions from review.js to avoid drift.
 *   - The `forced` field in the output is a harness-only observability signal
 *     (re-derived from the inputs); it is NOT part of the manifest contract.
 */

'use strict';

const path = require('path');

const REPO_ROOT  = path.resolve(__dirname, '..', '..', '..');
const reviewPath = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'skill', 'review.js');

const { loadAndMatchDimensions } = require(reviewPath);

// --- CLI ---
const argv = process.argv.slice(2);
let projectRoot = null;
let scenario    = null;

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--project-root' && argv[i + 1]) projectRoot = argv[++i];
  if (argv[i] === '--scenario'     && argv[i + 1]) scenario    = argv[++i];
}

if (!projectRoot || !scenario) {
  process.stderr.write('Usage: run-review-on-demand-dimension.js --project-root <path> --scenario <forced|default>\n');
  process.exit(1);
}

if (!['forced', 'default'].includes(scenario)) {
  process.stderr.write('scenario must be "forced" or "default"\n');
  process.exit(1);
}

// Simulated changed files for the test.
//
// COUPLING NOTE: The fixture at fixtures-fs/project-on-demand-dimension/.sdlc/review-dimensions/qa-on-demand.md
// declares triggers: ["__qa-only__/**"]. The file path below ('src/index.js') is deliberately chosen
// so it does NOT match that trigger glob — this produces the zero-trigger-match scenario that the
// force-active path under test depends on. If the fixture's triggers change, this constant must
// be updated to maintain the zero-match invariant.
const changedFiles = ['src/index.js'];

const dimensionFilter = scenario === 'forced' ? ['qa-on-demand'] : null;
const dims = loadAndMatchDimensions(projectRoot, changedFiles, dimensionFilter);

if (dims.length === 0) {
  process.stderr.write('No dimensions found in fixture\n');
  process.exit(1);
}

const dim = dims.find(d => d.name === 'qa-on-demand');
if (!dim) {
  process.stderr.write('qa-on-demand dimension not found\n');
  process.exit(1);
}

// Harness-only observability: re-derive whether the force-active path was taken.
// The real manifest does NOT include this field — it is only used by this test harness
// to assert that the force-active branch executed (vs. a coincidental trigger match).
const forced = !!(dimensionFilter && dimensionFilter.includes(dim.name)
                  && dim.matched_count > 0
                  && dim.matched_count === changedFiles.length);

process.stdout.write(JSON.stringify({
  name:               dim.name,
  status:             dim.status,
  matched_files_count: dim.matched_count,
  changed_files_count: changedFiles.length,
  forced,
}) + '\n');
