#!/usr/bin/env node
/**
 * pipeline-continue.js
 * PostToolUse hook (matcher Bash|TodoWrite) — implements R67 (issue #452).
 *
 * Emits hookSpecificOutput.additionalContext when a ship state file for the
 * current branch has any step with status `in_progress`. The emitted context
 * is factual (descriptive, not an imperative system command): it states which
 * step is in_progress and that the response turn should continue.
 *
 * Fires regardless of flags.auto — the nudge is harmless in interactive mode.
 *
 * Lazy-loads ../scripts/lib/state.js and ../scripts/lib/git.js. Requires only
 * Node.js built-ins plus those two lib files — no new npm dependencies.
 *
 * Exit codes:
 *   0 = always (graceful degradation — emits context only when an in_progress
 *       ship step is found; otherwise exits 0 silently).
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

  let slugifyBranch, findStateFile, readState, exec;
  try {
    ({ slugifyBranch, findStateFile, readState } = require('../scripts/lib/state'));
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

  // 5. Find first in_progress step. If none, exit 0 silently.
  const inProgress = steps.find((s) => s.status === 'in_progress');
  if (!inProgress) process.exit(0);

  // 6. Emit additionalContext + exit 0.
  const stepIndex = steps.indexOf(inProgress) + 1;
  const stepName = inProgress.name || inProgress.id || 'unknown';
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        `Ship pipeline: step ${stepIndex} of ${steps.length} (${stepName}) is in_progress. ` +
        'Continue executing this step — do not end the response turn. ' +
        'Next action: record the step result and advance to the next step.',
    },
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

main();
