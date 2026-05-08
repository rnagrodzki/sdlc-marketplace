#!/usr/bin/env node
/**
 * stop-plan-integrity.js
 * Stop hook — verifies that plan-sdlc traversed its quality gates when a plan
 * is presented. Emits advisory warnings to stderr; always exits 0 (non-blocking).
 *
 * Activation order (state-file-first, transcript-fallback):
 *   1. If a plan state file exists for the current branch, check planIntegrity
 *      markers and stat the recorded planFilePath. Warn on any missing/failed check.
 *   2. If no plan state file exists, scan the last 64 KB of the transcript for
 *      "Plan mode is active". If found, warn that plan-sdlc was not invoked.
 *
 * Reads stdin: yes (Stop event payload contains transcript_path).
 * Note: this hook deliberately reads stdin, unlike stop-state-save.js which does
 * not. The transcript_path field is required for the fallback signal.
 *
 * Exit codes:
 *   0 = always (advisory-only contract; see R21)
 *
 * Implements: R20, R21 (issue #285)
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');

// Maximum bytes to read from the transcript for fallback signal detection.
const TRANSCRIPT_READ_LIMIT = 64 * 1024; // 64 KB

// Marker names in the planIntegrity object that must all be present.
const REQUIRED_MARKERS = ['skillInvoked', 'planFile', 'guardrailsEvaluated', 'critiqueRan'];

// Human-readable descriptions for each marker (used in warning text).
const MARKER_DESCRIPTIONS = {
  skillInvoked:        'plan-sdlc Step 0 (prepare) did not run',
  planFile:            'plan file was not written or is empty',
  guardrailsEvaluated: 'Step 3 guardrail-compliance gate did not run',
  critiqueRan:         'Step 3 self-critique did not run',
};

try {
  const { findStateFile, readState, slugifyBranch } = require('../scripts/lib/state');
  const { exec } = require('../scripts/lib/git');

  // -------------------------------------------------------------------------
  // 1. Read stdin (Stop event payload → transcript_path)
  // -------------------------------------------------------------------------

  let transcriptPath = null;
  try {
    const raw = fs.readFileSync('/dev/stdin', 'utf8');
    if (raw && raw.trim()) {
      const payload = JSON.parse(raw);
      if (typeof payload.transcript_path === 'string') {
        transcriptPath = payload.transcript_path;
      }
    }
  } catch (_) {
    // Malformed or missing stdin — proceed without transcript path
  }

  // -------------------------------------------------------------------------
  // 2. Get current branch
  // -------------------------------------------------------------------------

  // SDLC_BRANCH_OVERRIDE allows test harnesses to inject a branch name without
  // requiring an embedded .git repo in fixture directories.
  const branch = process.env.SDLC_BRANCH_OVERRIDE || exec('git branch --show-current');
  if (!branch) process.exit(0);

  const branchSlug = slugifyBranch(branch);

  // -------------------------------------------------------------------------
  // 3. State-file-first branch
  // -------------------------------------------------------------------------

  const found = findStateFile('plan', branchSlug);

  if (found) {
    // State file exists — check all four markers and the planFilePath stat.
    const stateResult = readState('plan', branchSlug);
    if (!stateResult || !stateResult.data) {
      // Unreadable state file — treat as silent (can't verify, can't warn accurately)
      process.exit(0);
    }

    const data = stateResult.data;
    const pi = (data.planIntegrity && typeof data.planIntegrity === 'object')
      ? data.planIntegrity
      : {};

    const missing = [];

    for (const marker of REQUIRED_MARKERS) {
      if (typeof pi[marker] !== 'string') {
        // Missing marker — add to list
        missing.push(marker);
      }
    }

    // Additionally stat the planFilePath for the planFile check.
    // Even if planFile marker is present, an absent/empty file is a failed check.
    const planFilePath = typeof data.planFilePath === 'string' ? data.planFilePath : null;
    if (planFilePath) {
      try {
        const stat = fs.statSync(planFilePath);
        if (stat.size === 0) {
          // File exists but is empty — treat as planFile failure
          if (!missing.includes('planFile')) missing.push('planFile');
        }
      } catch (_) {
        // File does not exist — treat as planFile failure
        if (!missing.includes('planFile')) missing.push('planFile');
      }
    }

    if (missing.length === 0) {
      // All checks passed — silent exit
      process.exit(0);
    }

    // Emit structured warning
    const lines = [
      '[plan-integrity] WARNING: Plan presented with incomplete plan-sdlc execution.',
      `  Missing checkpoints: ${missing.join(', ')}`,
    ];

    for (const marker of missing) {
      let desc = MARKER_DESCRIPTIONS[marker] || marker;
      if (marker === 'planFile' && planFilePath) {
        desc = `plan file was not written or is empty (planFilePath=${planFilePath})`;
      }
      lines.push(`  - ${marker}: ${desc}`);
    }

    process.stderr.write(lines.join('\n') + '\n');
    process.exit(0);
  }

  // -------------------------------------------------------------------------
  // 5. Transcript-fallback branch (state file absent)
  // -------------------------------------------------------------------------

  if (!transcriptPath) {
    // No transcript path and no state file — nothing to check
    process.exit(0);
  }

  // Read the last TRANSCRIPT_READ_LIMIT bytes of the transcript file.
  let transcriptBuffer = '';
  try {
    const stat = fs.statSync(transcriptPath);
    const size = stat.size;

    if (size > 0) {
      const fd = fs.openSync(transcriptPath, 'r');
      try {
        const readBytes = Math.min(size, TRANSCRIPT_READ_LIMIT);
        const offset = size - readBytes;
        const buf = Buffer.alloc(readBytes);
        fs.readSync(fd, buf, 0, readBytes, offset);
        transcriptBuffer = buf.toString('utf8');
      } finally {
        fs.closeSync(fd);
      }
    }
  } catch (_) {
    // Unreadable transcript — silent exit
    process.exit(0);
  }

  if (transcriptBuffer.includes('Plan mode is active')) {
    process.stderr.write(
      `[plan-integrity] WARNING: Plan presented but plan-sdlc was not invoked` +
      ` (no plan integrity state for branch ${branch}).` +
      ` Quality gates may have been bypassed.\n`
    );
  }

  process.exit(0);
} catch (_) {
  // Top-level catch — graceful degradation (R21: advisory-only, always exit 0)
  process.exit(0);
}
