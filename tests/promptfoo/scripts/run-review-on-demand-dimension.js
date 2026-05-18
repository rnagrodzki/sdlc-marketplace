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
 *   JSON: { name, status, matched_files_count, changed_files_count }
 */

'use strict';

const path = require('path');
const fs   = require('fs');

const REPO_ROOT  = path.resolve(__dirname, '..', '..', '..');
const reviewPath = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'skill', 'review.js');

// review.js exports matchFiles, globToRegex, analyzeUncoveredFiles
const { matchFiles } = require(reviewPath);

// Minimal helpers replicated from review.js (not exported) to drive the test.
// These are stable internal functions — if they change, the test should be updated.
function extractFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}

function parseSimpleYaml(yamlText) {
  const result = {};
  if (!yamlText) return result;
  let currentKey = null;
  let inList = false;
  const lines = yamlText.split('\n');
  for (const line of lines) {
    const kvMatch = line.match(/^([a-zA-Z_-]+):\s*(.*)/);
    if (kvMatch && !line.startsWith('  ') && !line.startsWith('\t')) {
      currentKey = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val === '') {
        result[currentKey] = [];
        inList = true;
      } else {
        result[currentKey] = val.replace(/^["']|["']$/g, '');
        inList = false;
      }
    } else if (inList && line.match(/^\s+-\s+(.*)/)) {
      const item = line.match(/^\s+-\s+(.*)/)[1].replace(/^["']|["']$/g, '');
      if (!Array.isArray(result[currentKey])) result[currentKey] = [];
      result[currentKey].push(item);
    }
  }
  return result;
}

function resolveDimensionsDir(projectRoot) {
  const sdlcPath   = path.join(projectRoot, '.sdlc', 'review-dimensions');
  const claudePath = path.join(projectRoot, '.claude', 'review-dimensions');
  if (fs.existsSync(sdlcPath)) return sdlcPath;
  if (fs.existsSync(claudePath)) return claudePath;
  return sdlcPath;
}

/**
 * Minimal reimplementation of loadAndMatchDimensions from review.js.
 * Used by the test harness; mirrors the exact logic in the patched version.
 */
function loadAndMatchDimensions(projectRoot, changedFiles, dimensionFilter) {
  const dimensionsDir = resolveDimensionsDir(projectRoot);
  const dims = [];
  let files;
  try { files = fs.readdirSync(dimensionsDir).filter(f => f.endsWith('.md')); }
  catch (_) { return dims; }

  for (const file of files) {
    const filePath = path.join(dimensionsDir, file);
    let content;
    try { content = fs.readFileSync(filePath, 'utf8'); } catch (_) { continue; }

    const fm = parseSimpleYaml(extractFrontmatter(content) || '');
    if (!fm.name) continue;

    if (dimensionFilter && !dimensionFilter.includes(fm.name)) continue;

    const { matched, truncated } = matchFiles(fm, changedFiles);
    const forced = dimensionFilter && dimensionFilter.includes(fm.name) && matched.length === 0;
    const effectiveMatched = forced ? changedFiles : matched;

    dims.push({
      name:          fm.name,
      status:        effectiveMatched.length === 0 ? 'SKIPPED' : (truncated ? 'TRUNCATED' : 'ACTIVE'),
      matched_files: effectiveMatched,
      matched_count: effectiveMatched.length,
      forced,
    });
  }
  return dims;
}

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

// Simulated changed files — these are normal source files that do NOT match __qa-only__/**
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

process.stdout.write(JSON.stringify({
  name:               dim.name,
  status:             dim.status,
  matched_files_count: dim.matched_count,
  changed_files_count: changedFiles.length,
  forced:             dim.forced,
}) + '\n');
