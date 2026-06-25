#!/usr/bin/env node
/**
 * block-askuserquestion-auto.js
 * PreToolUse hook (matcher AskUserQuestion) — implements R71 / C18 (issue #477).
 *
 * The mid-turn sibling of the R67/R68 turn-end continuation hooks. Where
 * stop-pipeline-continue.js (R68) guards the turn-*ending* hole and
 * pipeline-continue.js (R67) nudges forward between steps, this hook guards the
 * mid-turn *pause-for-input* hole: in an active --auto ship pipeline the model
 * can emergently call AskUserQuestion at the review→fix boundary and stall an
 * unattended run. This hook DENIES that call deterministically.
 *
 * Returns permissionDecision: "deny" (exit 0, JSON stdout) when BOTH:
 *   (a) a ship state file exists for the current branch AND
 *       pipelineAdvancing(data).advancing === true (R-advancing-predicate,
 *       lib/state.js — shared with R67/R68; no inline duplicate predicate), AND
 *   (b) flags.auto === true in the state file (strict R68 form
 *       !!(data.flags && data.flags.auto === true)).
 *
 * In every other condition (no stdin, parse error, no git, no ship state file,
 * lib load failure, advancing false, flags.auto !== true) the hook exits 0
 * silently with no stdout (C18 — never block AskUserQuestion outside an active
 * --auto ship pipeline). The hook never mutates state.
 *
 * Lazy-loads ../scripts/lib/state.js and ../scripts/lib/git.js. Requires only
 * Node.js built-ins plus those two lib files — no new npm dependencies.
 *
 * Exit codes:
 *   0 = always (graceful degradation — emits a deny decision only when both
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
  // tool_name / tool_input are available on the payload (matcher already scoped
  // this hook to AskUserQuestion) but are not required for the deny decision.
  void payload.tool_name;
  void payload.tool_input;

  let slugifyBranch, findStateFile, readState, pipelineAdvancing, exec;
  try {
    ({ slugifyBranch, findStateFile, readState, pipelineAdvancing } = require('../scripts/lib/state'));
    ({ exec } = require('../scripts/lib/git'));
  } catch (err) {
    process.stderr.write(`block-askuserquestion-auto: lib load failed — ${err && err.message || err}\n`);
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

  // Ship state file must exist for the current branch (resolves via
  // resolveStateDir() → <mainWorktree>/.sdlc/execution/, KD6).
  if (!findStateFile('ship', branchSlug)) process.exit(0);

  const result = readState('ship', branchSlug);
  if (!result || !result.data || !Array.isArray(result.data.steps)) {
    process.exit(0);
  }
  const data = result.data;

  // Pipeline must be advancing (shared predicate — no inline duplicate).
  const { advancing } = pipelineAdvancing(data);
  if (!advancing) process.exit(0);

  // Strict auto gate (R68 form). Non-auto interactive review may legitimately
  // pause, so AskUserQuestion is allowed when flags.auto !== true (C18).
  const auto = !!(data.flags && data.flags.auto === true);
  if (!auto) process.exit(0);

  // Both conditions hold → deny.
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        'Auto-mode ship pipeline is advancing (flags.auto=true). Do NOT pause for input — ' +
        'proceed on the documented default (auto-dispatch the fix path). See ship-sdlc R71/#477.',
    },
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

main();
