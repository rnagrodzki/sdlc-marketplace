#!/usr/bin/env node
/**
 * pre-compact-save.js
 * PreCompact hook — saves a compact recovery summary of active pipeline state
 * before context compaction, so session-start.js can re-inject it afterwards.
 *
 * Writes to: <mainWorktree>/.sdlc/execution/.compact-recovery-<branchSlug>.json
 * (per-branch filename — issue #256; see hooks/README.md)
 *
 * Parses stdin for `session_id`. R74 (#505): the write is gated on
 * `hookEnforcementAllowed(data, payload)` (lib/state.js) — an unrelated
 * session's compaction must not create or refresh the recovery sidecar for a
 * pipeline it does not own. `savedAt` is sourced from the winning state
 * file's own filesystem mtime, not `Date.now()`, so a genuinely quiet
 * pipeline actually ages out of session-start.js's TTL gate instead of being
 * kept artificially fresh by every subsequent (denied-enforcement) compaction.
 *
 * Exit codes:
 *   0 = always (graceful degradation on errors)
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');

try {
  const { findStateFile, readState, slugifyBranch, resolveStateDir, hookEnforcementAllowed } = require('../scripts/lib/state');
  const { exec } = require('../scripts/lib/git');

  // Parse stdin JSON for session_id (R74, #505). Malformed/absent stdin
  // degrades to an empty payload, which fails hookEnforcementAllowed closed
  // to "skip the write" below — never throws, never blocks the hook.
  let payload = {};
  try {
    const raw = fs.readFileSync(0, 'utf8');
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  const branch = exec('git branch --show-current');
  if (!branch) process.exit(0);

  const branchSlug = slugifyBranch(branch);

  let recovery = null;
  let sourceData = null;
  let sourceFilePath = null;

  // Ship state takes priority
  const shipFound = findStateFile('ship', branchSlug);
  if (shipFound) {
    const shipState = readState('ship', branchSlug);
    if (shipState && shipState.data) {
      const data = shipState.data;
      let currentStep = null;
      let reviewVerdict = null;
      let deferredFindings = 0;

      if (Array.isArray(data.steps)) {
        const inProgress = data.steps.find(s => s.status === 'in_progress');
        const lastCompleted = [...data.steps].reverse().find(s => s.status === 'completed');
        const step = inProgress || lastCompleted;
        if (step) {
          currentStep = step.name || step.id || null;
        }

        // Look for deferred findings in review step output
        for (const s of data.steps) {
          if (s.output && s.output.deferredFindings) {
            deferredFindings = s.output.deferredFindings;
          }
          if (s.output && s.output.verdict) {
            reviewVerdict = s.output.verdict;
          }
        }
      }

      recovery = {
        savedAt: null, // filled below from sourceFilePath's mtime (R74, #505)
        pipeline: 'ship-sdlc',
        branch: data.branch || branch,
        currentStep,
        reviewVerdict,
        deferredFindings,
        flags: {
          preset: (data.flags && data.flags.preset) || null,
          auto: (data.flags && data.flags.auto) || false,
          skip: (data.flags && data.flags.skip) || [],
        },
      };
      sourceData = data;
      sourceFilePath = shipState.filePath;
    }
  }

  // Fall back to execute state
  if (!recovery) {
    const executeFound = findStateFile('execute', branchSlug);
    if (executeFound) {
      const executeState = readState('execute', branchSlug);
      if (executeState && executeState.data) {
        const data = executeState.data;
        let completedWaves = 0;
        let totalWaves = 0;

        if (Array.isArray(data.waves)) {
          totalWaves = data.waves.length;
          completedWaves = data.waves.filter(w => w.status === 'completed').length;
        }

        recovery = {
          savedAt: null, // filled below from sourceFilePath's mtime (R74, #505)
          pipeline: 'execute-plan-sdlc',
          branch: data.branch || branch,
          completedWaves,
          totalWaves,
          preset: (data.preset) || null,
        };
        sourceData = data;
        sourceFilePath = executeState.filePath;
      }
    }
  }

  // No active pipeline — nothing to save
  if (!recovery) process.exit(0);

  // R74 (#505): only write when this session owns the pipeline that produced
  // `recovery`. An absent file is already the correct signal to
  // session-start.js, so a denied session skips the write entirely rather
  // than writing a "denied" marker, and any existing recovery file is left
  // untouched.
  const gate = hookEnforcementAllowed(sourceData, payload);
  if (!gate.allowed) {
    process.stderr.write(`pre-compact-save: not writing — ${gate.reason}\n`);
    process.exit(0);
  }

  // savedAt sourced from the winning state file's own mtime, not Date.now(),
  // so a genuinely quiet pipeline actually ages out of session-start.js's
  // COMPACT_RECOVERY_TTL_MS gate instead of being kept artificially fresh.
  recovery.savedAt = new Date(fs.statSync(sourceFilePath).mtimeMs).toISOString();

  // Write recovery file (per-branch — issue #256)
  const recoveryDir = resolveStateDir();
  fs.mkdirSync(recoveryDir, { recursive: true });

  const recoveryPath = path.join(recoveryDir, `.compact-recovery-${branchSlug}.json`);
  fs.writeFileSync(recoveryPath, JSON.stringify(recovery, null, 2), 'utf8');
} catch {
  // Graceful degradation — exit cleanly on any error
}

process.exit(0);
