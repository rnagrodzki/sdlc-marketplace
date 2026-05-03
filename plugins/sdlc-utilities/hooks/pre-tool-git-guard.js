#!/usr/bin/env node
/**
 * pre-tool-git-guard.js
 * PreToolUse hook — intercepts dangerous git commands before Bash execution.
 *
 * Fires on every Bash tool invocation. Fast-bails if the command does not
 * contain "git " to minimize overhead on the hot path.
 *
 * BLOCK (exit 2 + stderr):
 *   git push --force / -f (but NOT --force-with-lease)
 *   git reset --hard
 *   git checkout . / git checkout -- .
 *   git clean -f
 *
 * WARN but ALLOW (exit 0 + stderr):
 *   git push targeting main/master
 *
 * Exit codes:
 *   0 = allowed (silently or with warning)
 *   2 = blocked (feedback surfaced to Claude)
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
// Extract command
// ---------------------------------------------------------------------------

const toolInput = input.tool_input || {};
const command   = toolInput.command || '';

// Fast bail — not a git command
if (!command.includes('git ')) {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Dangerous command patterns
// ---------------------------------------------------------------------------

const BLOCKED = [
  {
    // git push --force or git push -f (but NOT --force-with-lease)
    test: (cmd) => {
      // Match "git push" with --force or -f flag, excluding --force-with-lease
      const pushForceRe = /\bgit\s+push\b[^;&|]*(?:--force(?!-with-lease)|-f\b)/;
      return pushForceRe.test(cmd);
    },
    message: 'Blocked: git push --force can destroy remote history. Use --force-with-lease for a safer alternative.',
  },
  {
    test: (cmd) => /\bgit\s+reset\s+--hard\b/.test(cmd),
    message: 'Blocked: git reset --hard discards all uncommitted changes. Use git stash or git reset --soft instead.',
  },
  {
    test: (cmd) => /\bgit\s+checkout\s+(--\s+)?\./.test(cmd),
    message: 'Blocked: git checkout . discards all uncommitted changes. Use git stash to preserve changes.',
  },
  {
    test: (cmd) => /\bgit\s+clean\s+[^;&|]*-[a-zA-Z]*f/.test(cmd),
    message: 'Blocked: git clean -f permanently deletes untracked files. Use git clean -n for a dry run first.',
  },
];

const WARNINGS = [
  {
    // git push targeting main or master
    test: (cmd) => {
      // Match "git push" with "main" or "master" as a target, but skip if --force is present (already blocked)
      return /\bgit\s+push\b[^;&|]*\b(main|master)\b/.test(cmd);
    },
    message: 'Warning: pushing directly to main/master. Consider using a feature branch and pull request.',
  },
];

// ---------------------------------------------------------------------------
// Scan command (handles multi-command strings like "git add . && git push --force")
// ---------------------------------------------------------------------------

for (const rule of BLOCKED) {
  if (rule.test(command)) {
    process.stderr.write(rule.message + '\n');
    process.exit(2);
  }
}

for (const rule of WARNINGS) {
  if (rule.test(command)) {
    process.stderr.write(rule.message + '\n');
  }
}

process.exit(0);
