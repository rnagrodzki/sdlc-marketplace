/**
 * derive-workspace-test.js — exercise the pure deriveWorkspace export in lib/git.js.
 *
 * Used by datasets/derive-workspace-exec.yaml via
 *   script_path: "repo://tests/promptfoo/scripts/derive-workspace-test.js".
 * The lib path is resolved relative to this script's real __dirname so it works
 * regardless of cwd.
 *
 * Usage:
 *   node derive-workspace-test.js --linked <true|false> --current <branch> --default <branch>
 *
 * Prints {ok:true, workspace:"branch"|"continue"} on stdout.
 * deriveWorkspace is pure (no I/O), so no git fixture is required.
 */
'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const LIB_PATH  = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'git.js');

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return null;
  return args[i + 1];
}

const linked  = getArg('--linked') === 'true';
const current = getArg('--current');
const def     = getArg('--default');

const { deriveWorkspace } = require(LIB_PATH);

if (typeof deriveWorkspace !== 'function') {
  console.log(JSON.stringify({ ok: false, error: 'deriveWorkspace not exported' }));
  process.exit(0);
}

const workspace = deriveWorkspace({
  inLinkedWorktree: linked,
  currentBranch: current,
  defaultBranch: def,
});

console.log(JSON.stringify({ ok: true, workspace }));
