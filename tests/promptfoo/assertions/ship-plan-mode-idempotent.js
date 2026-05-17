'use strict';
const fs = require('fs');
const path = require('path');

// Assertion for T12 case 4: idempotency — only one ship-<slug>-*.json survives per branch.
// Input: JSON payload from auto-read of prepare output (no script_passthrough).
module.exports = (output) => {
  let o;
  try { o = JSON.parse(output); } catch (e) {
    return { pass: false, score: 0, reason: `output is not valid JSON: ${e.message}` };
  }
  if (!o.stateFile) {
    return { pass: false, score: 0, reason: 'stateFile field missing from prepare output' };
  }
  const execDir = path.dirname(o.stateFile);
  let files;
  try {
    files = fs.readdirSync(execDir);
  } catch (e) {
    return { pass: false, score: 0, reason: `cannot read execution dir: ${e.message}` };
  }
  const remaining = files.filter(f => f.startsWith('ship-feat-test-plan-mode-') && f.endsWith('.json'));
  if (remaining.length !== 1) {
    return { pass: false, score: 0, reason: `expected 1 ship-feat-test-plan-mode-*.json, found ${remaining.length}: ${remaining.join(', ')}` };
  }
  return { pass: true, score: 1, reason: `prune-on-write: exactly 1 ship-feat-test-plan-mode file survives` };
};
