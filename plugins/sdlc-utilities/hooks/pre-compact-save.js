#!/usr/bin/env node
/**
 * pre-compact-save.js
 * PreCompact hook — saves a compact recovery summary of active pipeline state
 * before context compaction, so session-start.js can re-inject it afterwards.
 *
 * Writes to: <mainWorktree>/.sdlc/execution/.compact-recovery.json
 *
 * Exit codes:
 *   0 = always (graceful degradation on errors)
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');

try {
  const { findStateFile, readState, slugifyBranch, resolveMainWorktree } = require('../scripts/lib/state');
  const { exec } = require('../scripts/lib/git');

  const branch = exec('git branch --show-current');
  if (!branch) process.exit(0);

  const branchSlug = slugifyBranch(branch);

  let recovery = null;

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
        savedAt: new Date().toISOString(),
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
          savedAt: new Date().toISOString(),
          pipeline: 'execute-plan-sdlc',
          branch: data.branch || branch,
          completedWaves,
          totalWaves,
          preset: (data.preset) || null,
        };
      }
    }
  }

  // No active pipeline — nothing to save
  if (!recovery) process.exit(0);

  // Write recovery file
  const mainWorktree = resolveMainWorktree();
  const recoveryDir = path.join(mainWorktree, '.sdlc', 'execution');
  fs.mkdirSync(recoveryDir, { recursive: true });

  const recoveryPath = path.join(recoveryDir, '.compact-recovery.json');
  fs.writeFileSync(recoveryPath, JSON.stringify(recovery, null, 2), 'utf8');
} catch {
  // Graceful degradation — exit cleanly on any error
}

process.exit(0);
