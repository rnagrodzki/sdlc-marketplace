#!/usr/bin/env node
/**
 * pipeline-continue.js
 * PostToolUse hook (matcher Bash|TodoWrite) — implements R67 (issue #452, broadened).
 *
 * Consumes the shared `pipelineAdvancing(data)` predicate (R-advancing-predicate,
 * lib/state.js) against the ship state file for the current branch:
 *   - in_progress step present  → emit "continue this step" context, MODE-INDEPENDENT
 *     (fires regardless of flags.auto).
 *   - advancing via a between-steps `pending` step (none in_progress) → emit a
 *     forward "advance to next step" context ONLY when flags.auto === true;
 *     otherwise exit 0 silently (interactive between-step review preserved).
 *   - advancing false (all terminal, or failed without a terminal cleanup pending)
 *     → exit 0 silently.
 *   - no ship state file / git or state resolution failure → exit 0 silently.
 *
 * Lazy-loads ../scripts/lib/state.js and ../scripts/lib/git.js. Requires only
 * Node.js built-ins plus those two lib files — no new npm dependencies.
 *
 * Exit codes:
 *   0 = always (graceful degradation — emits context only per the rules above;
 *       otherwise exits 0 silently).
 */

'use strict';

const fs = require('node:fs');

function main() {
  // 1. Read stdin JSON. If parse fails, exit 0 silently.
  let payload;
  try {
    const raw = fs.readFileSync(0, 'utf8');
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    process.exit(0);
  }
  // tool_name / tool_response are available on the payload but not required for
  // the in_progress decision — reading them keeps parity with the hook contract.
  void payload.tool_name;
  void payload.tool_response;

  let slugifyBranch, findStateFile, readState, pipelineAdvancing, exec;
  try {
    ({ slugifyBranch, findStateFile, readState, pipelineAdvancing } = require('../scripts/lib/state'));
    ({ exec } = require('../scripts/lib/git'));
  } catch {
    process.exit(0);
  }

  // 2. Resolve current branch. If none, exit 0 silently.
  let branch;
  try {
    branch = exec('git branch --show-current');
  } catch {
    process.exit(0);
  }
  if (!branch) process.exit(0);

  const branchSlug = slugifyBranch(branch);

  // 3. Find ship state file. If none, exit 0 silently.
  if (!findStateFile('ship', branchSlug)) process.exit(0);

  // 4. Read state. If no data or steps missing, exit 0 silently.
  const result = readState('ship', branchSlug);
  if (!result || !result.data || !Array.isArray(result.data.steps)) {
    process.exit(0);
  }
  const steps = result.data.steps;

  // 5. Evaluate the shared advancing predicate. If not advancing, exit 0 silently.
  const { advancing, step, index } = pipelineAdvancing(result.data);
  if (!advancing || !step) process.exit(0);

  const auto = !!(result.data.flags && result.data.flags.auto);
  const stepIndex = index + 1;
  const stepName = step.name || step.id || 'unknown';

  // 6. Two cases:
  //   (a) in_progress step → emit "continue this step", MODE-INDEPENDENT.
  //   (b) between-steps pending (no in_progress) → emit forward context ONLY in
  //       --auto; non-auto exits silently to preserve interactive review.
  let additionalContext;
  if (step.status === 'in_progress') {
    additionalContext =
      `Ship pipeline: step ${stepIndex} of ${steps.length} (${stepName}) is in_progress. ` +
      'Continue executing this step — do not end the response turn. ' +
      'Next action: record the step result and advance to the next step.';
  } else {
    // between-steps pending — auto-gated
    if (!auto) process.exit(0);
    additionalContext =
      `Ship pipeline: the next step is step ${stepIndex} of ${steps.length} (${stepName}), pending. ` +
      'In --auto mode, advance to it now — do not end the response turn. ' +
      'Next action: begin the next step.';
  }

  const output = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext,
    },
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

main();
