#!/usr/bin/env node
'use strict';
/**
 * run-gitignore-hook-and-read.js
 * Test wrapper for ensure-worktree-gitignore.js (issue #351 T13).
 *
 * Runs the hook script in the current working directory, then reads
 * the root .gitignore (if it exists) and outputs a JSON object:
 *
 *   {
 *     "gitignoreExists": boolean,
 *     "gitignoreContent": string | null
 *   }
 *
 * This allows promptfoo JavaScript assertions to inspect the post-run
 * .gitignore content without needing `require('fs')` inside the assertion
 * context (which is not available in promptfoo's ES module assertion env).
 */

const path = require('path');
const fs   = require('fs');
const { spawnSync } = require('child_process');

const HOOK_SCRIPT = path.join(
  __dirname, '..', '..', '..', 'plugins', 'sdlc-utilities', 'hooks', 'ensure-worktree-gitignore.js'
);

const cwd = process.cwd();

// Run the hook in the current working directory (which is the fixture temp dir)
const result = spawnSync('node', [HOOK_SCRIPT], {
  cwd,
  encoding: 'utf8',
  env: { ...process.env, SDLC_CONFIG_QUIET: '1' },
});

if (result.error) {
  console.log(JSON.stringify({ error: result.error.message }));
  process.exit(1);
}

// Read .gitignore content after the hook has run
const gitignorePath = path.join(cwd, '.gitignore');
const gitignoreExists = fs.existsSync(gitignorePath);
const gitignoreContent = gitignoreExists ? fs.readFileSync(gitignorePath, 'utf8') : null;

console.log(JSON.stringify({
  gitignoreExists,
  gitignoreContent,
  hookExitCode: result.status,
  hookStderr: result.stderr || '',
}));
