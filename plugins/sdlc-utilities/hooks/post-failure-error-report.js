#!/usr/bin/env node
/**
 * post-failure-error-report.js
 * PostToolUseFailure hook — detects prepare script crashes (exit code 2)
 * and surfaces a reminder to invoke error-report-sdlc.
 *
 * Fires on Bash tool failures. Reads JSON from stdin to extract the
 * command and exit code. Only triggers on skill script crashes.
 *
 * Exit codes:
 *   0 = no crash detected or non-skill command (safe to continue)
 *   2 = crash detected, feedback surfaced to Claude
 *
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const fs = require('node:fs');

// ---------------------------------------------------------------------------
// Read stdin
// ---------------------------------------------------------------------------

let input = {};
try {
  const raw = fs.readFileSync('/dev/stdin', 'utf8');
  if (raw.trim()) {
    input = JSON.parse(raw);
  }
} catch {
  // Unparseable or missing stdin — exit silently
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Extract command and check for skill script
// ---------------------------------------------------------------------------

const toolInput = input.tool_input || {};
const command   = toolInput.command || '';

if (!command) {
  process.exit(0);
}

// Match skill script pattern: scripts/skill/<name>.js
const SKILL_SCRIPT_RE = /scripts\/skill\/([a-z-]+)\.js/;
const skillMatch = command.match(SKILL_SCRIPT_RE);

if (!skillMatch) {
  // Not a skill script — exit silently
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Check for exit code 2 (crash)
// ---------------------------------------------------------------------------

const exitCode = input.exit_code;

if (exitCode !== 2) {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Extract skill name and build reminder
// ---------------------------------------------------------------------------

const scriptName = skillMatch[1]; // e.g., "commit"
const skillName  = scriptName + '-sdlc'; // e.g., "commit-sdlc"

// Extract error excerpt from stderr or stdout
const stderr = (input.stderr || input.stdout || '').trim();
const errorExcerpt = stderr.length > 200 ? stderr.slice(0, 200) + '...' : stderr;

const message = [
  'Prepare script crashed (exit 2). Invoke error-report-sdlc:',
  `- skill: ${skillName}`,
  `- step: Step 0 — skill/${scriptName}.js execution`,
  `- error: ${errorExcerpt || '(no error output captured)'}`,
].join('\n');

process.stderr.write(message + '\n');
process.exit(2);
