#!/usr/bin/env node
/**
 * context-stats.js
 * UserPromptSubmit hook — measures the actual model-context size from the live
 * transcript JSONL file and writes a sidecar at $TMPDIR/sdlc-context-stats.json
 * so SDLC skills (plan, ship, execute) can render a context-heaviness advisory
 * at handoff boundaries.
 *
 * Why a hook (not a prepare script): only hooks receive the transcript_path
 * field on stdin. Bash-tool-invoked scripts do not have access to it.
 *
 * Token source: Claude Code transcripts are JSON-lines, with `message.usage`
 * blocks recording per-turn token counts. The actual context the model received
 * on its most recent assistant turn equals
 *   input_tokens + cache_read_input_tokens + cache_creation_input_tokens.
 * We scan the transcript backwards (split on '\n' and walk from the end) to
 * find the first parseable line carrying a `message.usage.input_tokens`
 * number, and use that. This is accurate: it captures the actual context size
 * AFTER any auto-compaction has trimmed the transcript view.
 *
 * Fallback: when no usage record is found (brand-new transcript, format change,
 * unreadable file), the hook falls back to the legacy `floor(bytes / 4)`
 * heuristic so the sidecar is always populated. The `tokenSource` field
 * distinguishes the two sources for downstream advisories and tests.
 *
 * Sidecar shape:
 *   {
 *     ts:              ISO-8601 string,
 *     transcriptBytes: number,   // raw file size in bytes
 *     tokensApprox:    number,   // actual tokens from usage, OR floor(bytes/4) on fallback
 *     modelBudget:     number,   // hardcoded 200000; under-reports on Haiku
 *     percent:         number,   // 0..100
 *     heavy:           boolean,  // percent >= 60
 *     tokenSource:     "transcript-usage" | "heuristic-bytes"
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

/**
 * Scan a transcript file backwards for the most recent assistant turn whose
 * `message.usage.input_tokens` is a finite number, and return the actual
 * model-context size. Returns null when no usage record is parseable.
 *
 * Why split + reverse-walk (not stream): transcripts are <10 MB in normal
 * sessions, the hook has a 2 s timeout, and a single readFileSync + split
 * is far faster than line-by-line streaming for files of this size.
 *
 * @param {string} transcriptPath  Absolute path to the JSONL transcript
 * @returns {number|null}          Total context tokens, or null on miss
 */
function readUsageTokens(transcriptPath) {
  let text;
  try {
    text = fs.readFileSync(transcriptPath, 'utf8');
  } catch (_) {
    return null;
  }
  if (!text) return null;

  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line || line.charCodeAt(0) !== 123 /* '{' */) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (_) {
      continue;
    }
    const usage = obj && obj.message && obj.message.usage;
    if (!usage || typeof usage.input_tokens !== 'number') continue;

    const input  = usage.input_tokens || 0;
    const cRead  = usage.cache_read_input_tokens || 0;
    const cWrite = usage.cache_creation_input_tokens || 0;
    return input + cRead + cWrite;
  }
  return null;
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

    // Primary path: parse actual usage from the transcript JSONL.
    const usageTokens = readUsageTokens(transcriptPath);

    let tokensApprox;
    let tokenSource;
    if (usageTokens != null) {
      tokensApprox = usageTokens;
      tokenSource  = 'transcript-usage';
    } else {
      tokensApprox = Math.floor(transcriptBytes / 4);
      tokenSource  = 'heuristic-bytes';
    }

    const percent = Math.min(100, Math.round((tokensApprox / MODEL_BUDGET) * 100));
    const heavy   = percent >= HEAVY_THRESHOLD;

    const sidecar = {
      ts: new Date().toISOString(),
      transcriptBytes,
      tokensApprox,
      modelBudget: MODEL_BUDGET,
      percent,
      heavy,
      tokenSource,
    };

    const tmpDir       = process.env.TMPDIR || os.tmpdir();
    const sidecarPath  = path.join(tmpDir, SIDECAR_NAME);
    atomicWriteSync(sidecarPath, JSON.stringify(sidecar, null, 2));
  } catch (_) {
    // Graceful degradation — never break the user's prompt flow.
  }

  process.exit(0);
})();
