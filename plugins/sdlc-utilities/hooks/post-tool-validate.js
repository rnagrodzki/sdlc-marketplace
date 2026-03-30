#!/usr/bin/env node
/**
 * post-tool-validate.js
 * PostToolUse hook — validates edited files against known schemas.
 *
 * Fires on Edit|Write tool events. Reads JSON from stdin to extract the
 * file path, then runs the appropriate validator script if the path matches
 * a known pattern.
 *
 * Patterns:
 *   .claude/review-dimensions/*.ya?ml → validate-dimensions.js
 *   .claude/pr-template.md            → validate-pr-template.js
 *
 * Exit codes:
 *   0 = clean or no match (always safe to continue)
 *   2 = validation found issues (surfaced to Claude as feedback)
 *
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const fs           = require('node:fs');
const path         = require('node:path');
const { execSync } = require('node:child_process');

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
// Extract file path from tool_input
// The PostToolUse schema is not publicly documented; try known field names.
// ---------------------------------------------------------------------------

const toolInput = input.tool_input || {};
const filePath  = toolInput.file_path || toolInput.path || null;

if (!filePath) {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Pattern matching
// ---------------------------------------------------------------------------

const DIMENSION_RE  = /[/\\]\.claude[/\\]review-dimensions[/\\][^/\\]+\.ya?ml$/;
const PR_TEMPLATE_RE = /[/\\]\.claude[/\\]pr-template\.md$/;

const isDimension  = DIMENSION_RE.test(filePath);
const isPrTemplate = PR_TEMPLATE_RE.test(filePath);

if (!isDimension && !isPrTemplate) {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Locate validator scripts (../scripts/ relative to this hook file)
// ---------------------------------------------------------------------------

const scriptsDir = path.resolve(__dirname, '..', 'scripts');

const validatorScript = isDimension
  ? path.join(scriptsDir, 'validate-dimensions.js')
  : path.join(scriptsDir, 'validate-pr-template.js');

// Use the project root from cwd (where Claude runs the hook)
const projectRoot = process.cwd();

// ---------------------------------------------------------------------------
// Run validator
// ---------------------------------------------------------------------------

try {
  const cmd = `node "${validatorScript}" --project-root "${projectRoot}" --markdown`;
  execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  // Exit 0 from validator — all good
  process.exit(0);
} catch (err) {
  // execSync throws when exit code is non-zero
  const stdout = (err.stdout || '').trim();
  const stderr = (err.stderr || '').trim();
  const findings = stdout || stderr;

  if (findings) {
    process.stderr.write(findings + '\n');
  }

  // Exit 2 surfaces the feedback to Claude (PostToolUse convention)
  process.exit(2);
}
