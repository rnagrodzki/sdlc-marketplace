#!/usr/bin/env node
/**
 * context-stats.js
 * UserPromptSubmit hook — measures the size of the live transcript file and
 * writes a sidecar at $TMPDIR/sdlc-context-stats.json so SDLC skills (plan,
 * ship, execute) can render a context-heaviness advisory at handoff
 * boundaries.
 *
 * Why a hook (not a prepare script): only hooks receive the transcript_path
 * field on stdin. Bash-tool-invoked scripts do not have access to it.
 *
 * Sidecar shape:
 *   {
 *     ts:              ISO-8601 string,
 *     transcriptBytes: number,   // raw file size in bytes
 *     tokensApprox:    number,   // floor(bytes / 4) — Truffle community heuristic
 *     modelBudget:     number,   // hardcoded 200000; under-reports on Haiku
 *     percent:         number,   // 0..100
 *     heavy:           boolean   // percent >= 60
 *   }
 *
 * Atomic write: temp file + rename, mirroring scripts/lib/state.js.
 *
 * Exit codes:
 *   0 = always (graceful degradation on errors). No stdout. Hook stays silent.
 */

'use strict';

const fs     = require('node:fs');
const path   = require('node:path');
const os     = require('node:os');
const crypto = require('node:crypto');

const MODEL_BUDGET    = 200000;
const HEAVY_THRESHOLD = 60; // percent
const SIDECAR_NAME    = 'sdlc-context-stats.json';

function atomicWriteSync(filePath, content) {
  const dir    = path.dirname(filePath);
  const suffix = crypto.randomBytes(4).toString('hex');
  const tmp    = path.join(dir, path.basename(filePath) + '.' + suffix + '.tmp');
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

function readStdinSync() {
  try {
    // Node stdin fd=0 is sync-readable. Use a generous size; hook payloads
    // are small JSON blobs.
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

(function main() {
  try {
    const raw = readStdinSync();
    if (!raw) process.exit(0);

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (_) {
      process.exit(0);
    }

    const transcriptPath = payload && payload.transcript_path;
    if (!transcriptPath || typeof transcriptPath !== 'string') process.exit(0);

    let stat;
    try {
      stat = fs.statSync(transcriptPath);
    } catch (_) {
      process.exit(0);
    }

    const transcriptBytes = stat.size;
    const tokensApprox    = Math.floor(transcriptBytes / 4);
    const percent         = Math.min(100, Math.round((tokensApprox / MODEL_BUDGET) * 100));
    const heavy           = percent >= HEAVY_THRESHOLD;

    const sidecar = {
      ts: new Date().toISOString(),
      transcriptBytes,
      tokensApprox,
      modelBudget: MODEL_BUDGET,
      percent,
      heavy,
    };

    const tmpDir       = process.env.TMPDIR || os.tmpdir();
    const sidecarPath  = path.join(tmpDir, SIDECAR_NAME);
    atomicWriteSync(sidecarPath, JSON.stringify(sidecar, null, 2));
  } catch (_) {
    // Graceful degradation — never break the user's prompt flow.
  }

  process.exit(0);
})();
