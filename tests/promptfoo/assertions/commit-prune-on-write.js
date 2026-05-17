'use strict';
const fs = require('fs');
const path = require('path');

// Assertion for E5: prune-on-write removes same-branch manifests, preserves other-branch.
// Input: raw path string (script_passthrough: true).
module.exports = (output) => {
  const filePath = (output || '').trim();
  if (!filePath || !filePath.includes('.sdlc/execution/commit-')) {
    return { pass: false, score: 0, reason: `unexpected path format: ${filePath.substring(0, 200)}` };
  }
  const dir = path.dirname(filePath);
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return { pass: false, score: 0, reason: `cannot read execution dir: ${e.message}` };
  }
  const mainFiles = files.filter(f => f.startsWith('commit-main-') && f.endsWith('.json'));
  const otherFiles = files.filter(f => f.startsWith('commit-otherbranch-') && f.endsWith('.json'));
  if (mainFiles.length !== 1) {
    return { pass: false, score: 0, reason: `expected 1 commit-main-*.json, found ${mainFiles.length}: ${mainFiles.join(', ')}` };
  }
  if (otherFiles.length !== 1) {
    return { pass: false, score: 0, reason: `expected 1 commit-otherbranch-*.json, found ${otherFiles.length}: ${otherFiles.join(', ')}` };
  }
  return { pass: true, score: 1, reason: 'prune-on-write: exactly 1 main file, 1 otherbranch file' };
};
