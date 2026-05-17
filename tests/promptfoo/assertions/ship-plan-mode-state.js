'use strict';
const fs = require('fs');

// Assertion for T12 case 1: plan-mode-blocked state file has correct flags (bump=patch) and all steps pending.
// Input: JSON payload from auto-read of prepare output (no script_passthrough).
module.exports = (output) => {
  let o;
  try { o = JSON.parse(output); } catch (e) {
    return { pass: false, score: 0, reason: `output is not valid JSON: ${e.message}` };
  }
  if (!o.stateFile) {
    return { pass: false, score: 0, reason: 'stateFile field missing from prepare output' };
  }
  let state;
  try {
    state = JSON.parse(fs.readFileSync(o.stateFile, 'utf8'));
  } catch (e) {
    return { pass: false, score: 0, reason: `cannot read stateFile at ${o.stateFile}: ${e.message}` };
  }
  if (!state.flags || state.flags.bump !== 'patch') {
    return { pass: false, score: 0, reason: `state.flags.bump !== 'patch': ${JSON.stringify(state.flags)}` };
  }
  if (!Array.isArray(state.steps) || state.steps.length === 0) {
    return { pass: false, score: 0, reason: `state.steps is empty or not an array` };
  }
  const notPending = state.steps.filter(s => s.status !== 'pending');
  if (notPending.length > 0) {
    return { pass: false, score: 0, reason: `some steps not pending: ${JSON.stringify(notPending.map(s => ({ name: s.name, status: s.status })))}` };
  }
  return { pass: true, score: 1, reason: `state file has bump=patch and ${state.steps.length} pending steps` };
};
