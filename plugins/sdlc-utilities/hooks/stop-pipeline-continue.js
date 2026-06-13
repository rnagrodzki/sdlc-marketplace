#!/usr/bin/env node
/**
 * stop-pipeline-continue.js
 * Stop hook (no matcher) — implements R68 (issue #452, broadened) and
 * R-stop-inprogress-mode-independent (issue #454, recurrence of #452).
 *
 * Returns `decision: "block"` with a factual `reason` when the following hold,
 * with the `flags.auto` gate applied ASYMMETRICALLY by step status:
 *   (a) a ship state file exists for the current branch,
 *   (b) `pipelineAdvancing(data).advancing === true` (R-advancing-predicate,
 *       lib/state.js — covers both an `in_progress` step AND the between-steps
 *       `pending` gap, incl. the R38 failed+terminal-`cleanup` case),
 *   (c) the `flags.auto` gate:
 *         - `in_progress` step → block REGARDLESS of `flags.auto` (#454: a mid-step
 *           gap is never a valid pause; the Stop hook is the only enforcement layer
 *           that can prevent turn-end before the next Agent dispatch),
 *         - between-steps `pending` → block ONLY when `flags.auto === true`
 *           (non-auto interactive review between steps is a legitimate pause), AND
 *   (d) `stop_hook_active !== true` on stdin.
 *
 * In every other condition (no state file, advancing false, between-steps pending
 * with non-auto, stop_hook_active === true) the hook exits 0 silently with no stdout.
 *
 * The asymmetry mirrors hooks/pipeline-continue.js (in_progress mode-independent;
 * pending auto-gated — no-opposite-logical-vectors). The `stop_hook_active === true`
 * early-exit avoids contributing to the Claude Code 8-consecutive-continuation cap
 * (and prevents the now-mode-independent in_progress block from looping against that
 * cap in non-auto mode). The hook never mutates state, so repeated invocations on the
 * same advancing state return the same block (idempotent).
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

  // (b) pipeline is advancing (in_progress step OR a between-steps pending step,
  //     incl. the R38 failed+terminal-cleanup case). Evaluated BEFORE the auto
  //     gate so the in_progress case can be distinguished from the pending case
  //     (R-stop-inprogress-mode-independent, #454).
  const steps = data.steps;
  const { advancing, step, index } = pipelineAdvancing(data);
  if (!advancing || !step) process.exit(0);

  // (c) flags.auto gate — applied ASYMMETRICALLY (R-stop-inprogress-mode-independent,
  //     #454, recurrence of #452; mirrors hooks/pipeline-continue.js):
  //       - in_progress step → block REGARDLESS of auto (a mid-step gap is never a
  //         valid pause; the Stop hook is the only enforcement layer that can prevent
  //         turn-end before the next Agent dispatch).
  //       - between-steps pending → block ONLY in auto (non-auto interactive review
  //         between steps is a legitimate pause — no-opposite-logical-vectors).
  const auto = !!(data.flags && data.flags.auto === true);
  if (step.status !== 'in_progress' && !auto) process.exit(0);

  // Conditions hold → block.
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
