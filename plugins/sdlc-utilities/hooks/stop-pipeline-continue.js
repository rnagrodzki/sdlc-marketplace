#!/usr/bin/env node
/**
 * stop-pipeline-continue.js
 * Stop hook (no matcher) — implements R68 (issue #452, broadened).
 *
 * Returns `decision: "block"` with a factual `reason` ONLY when ALL four
 * conditions hold:
 *   (a) a ship state file exists for the current branch,
 *   (b) `pipelineAdvancing(data).advancing === true` (R-advancing-predicate,
 *       lib/state.js — covers both an `in_progress` step AND the between-steps
 *       `pending` gap, incl. the R38 failed+terminal-`cleanup` case),
 *   (c) `flags.auto === true` in the state file, AND
 *   (d) `stop_hook_active !== true` on stdin.
 *
 * In every other condition (non-auto, no state file, advancing false,
 * stop_hook_active === true) the hook exits 0 silently with no stdout.
 *
 * The between-steps forward behavior is `flags.auto`-gated (same gate as R67 —
 * no-opposite-logical-vectors); non-auto review is preserved. The
 * `stop_hook_active === true` early-exit avoids contributing to the Claude Code
 * 8-consecutive-continuation cap. The hook never mutates state, so repeated
 * invocations on the same advancing state return the same block (idempotent).
 *
 * Lazy-loads ../scripts/lib/state.js and ../scripts/lib/git.js. Requires only
 * Node.js built-ins plus those two lib files — no new npm dependencies.
 *
 * Exit codes:
 *   0 = always (graceful degradation — emits a block decision only when all four
 *       conditions hold; otherwise exits 0 silently).
 */

'use strict';

const fs = require('node:fs');

function main() {
  // Read stdin JSON. If parse fails, exit 0 silently.
  let payload;
  try {
    const raw = fs.readFileSync(0, 'utf8');
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    process.exit(0);
  }

  // (d) stop_hook_active === true → exit 0 silently (cap avoidance).
  if (payload.stop_hook_active === true) process.exit(0);

  let slugifyBranch, findStateFile, readState, pipelineAdvancing, exec;
  try {
    ({ slugifyBranch, findStateFile, readState, pipelineAdvancing } = require('../scripts/lib/state'));
    ({ exec } = require('../scripts/lib/git'));
  } catch {
    process.exit(0);
  }

  // Resolve current branch. If none, exit 0 silently.
  let branch;
  try {
    branch = exec('git branch --show-current');
  } catch {
    process.exit(0);
  }
  if (!branch) process.exit(0);

  const branchSlug = slugifyBranch(branch);

  // (a) ship state file exists for the current branch.
  if (!findStateFile('ship', branchSlug)) process.exit(0);

  const result = readState('ship', branchSlug);
  if (!result || !result.data || !Array.isArray(result.data.steps)) {
    process.exit(0);
  }
  const data = result.data;

  // (c) flags.auto === true.
  if (!data.flags || data.flags.auto !== true) process.exit(0);

  // (b) pipeline is advancing (in_progress step OR a between-steps pending step,
  //     incl. the R38 failed+terminal-cleanup case).
  const steps = data.steps;
  const { advancing, step, index } = pipelineAdvancing(data);
  if (!advancing || !step) process.exit(0);

  // All four conditions hold → block.
  const stepIndex = index + 1;
  const stepName = step.name || step.id || 'unknown';
  const stateWord = step.status === 'in_progress' ? 'is in_progress' : 'is pending';
  const output = {
    decision: 'block',
    reason:
      `Ship pipeline step ${stepIndex} of ${steps.length} (${stepName}) ${stateWord} and ` +
      'has not been completed. Record the step result and continue to the next pipeline step.',
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

main();
