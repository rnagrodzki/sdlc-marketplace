'use strict';
const fs = require('fs');

// Assertion for T12 case 2: plan-mode-blocked state file preserves flags.steps from CLI.
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
  const steps = state.flags && state.flags.steps;
  if (!Array.isArray(steps)) {
    return { pass: false, score: 0, reason: `state.flags.steps is not an array: ${JSON.stringify(state.flags)}` };
  }
  if (!steps.includes('execute')) {
    return { pass: false, score: 0, reason: `state.flags.steps does not include 'execute': ${JSON.stringify(steps)}` };
  }
  if (!steps.includes('pr')) {
    return { pass: false, score: 0, reason: `state.flags.steps does not include 'pr': ${JSON.stringify(steps)}` };
  }
  return { pass: true, score: 1, reason: `state.flags.steps includes execute and pr: ${JSON.stringify(steps)}` };
};
