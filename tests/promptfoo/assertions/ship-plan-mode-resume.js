'use strict';
const fs = require('fs');

// Assertion for T12 case 3: resume detection finds plan-mode-blocked state file with correct flags.
// Input: JSON payload from auto-read of prepare output (no script_passthrough).
module.exports = (output) => {
  let o;
  try { o = JSON.parse(output); } catch (e) {
    return { pass: false, score: 0, reason: `output is not valid JSON: ${e.message}` };
  }
  if (!o.resume || !o.resume.fullPath) {
    return { pass: false, score: 0, reason: `resume.fullPath missing: ${JSON.stringify(o.resume)}` };
  }
  let state;
  try {
    state = JSON.parse(fs.readFileSync(o.resume.fullPath, 'utf8'));
  } catch (e) {
    return { pass: false, score: 0, reason: `cannot read resume.fullPath at ${o.resume.fullPath}: ${e.message}` };
  }
  if (!state.flags || state.flags.bump !== 'minor') {
    return { pass: false, score: 0, reason: `state.flags.bump !== 'minor': ${JSON.stringify(state.flags)}` };
  }
  return { pass: true, score: 1, reason: `resume stateFile has flags.bump=minor` };
};
