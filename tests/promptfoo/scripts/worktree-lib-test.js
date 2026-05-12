/**
 * worktree-lib-test.js — exercise exported helpers in lib/worktree.js.
 *
 * Used by datasets/lib-worktree-exec.yaml tests via
 *   script_path: "repo://tests/promptfoo/scripts/worktree-lib-test.js".
 * The lib path is resolved relative to this script's real __dirname so it works
 * regardless of cwd.
 *
 * Usage:
 *   node worktree-lib-test.js --op <operation> [--cwd <path>]
 *
 * Operations:
 *   exports              — prints which helpers are exported (presence-only check)
 *   resolveMain          — calls resolveMainWorktree(cwd); prints {ok:true, path:<abs>}
 *                          or {ok:false, error:<msg>} when it throws.
 *   resolveMainSafe      — calls resolveMainWorktreeSafe(cwd); prints {path:<abs>}.
 *                          Never throws. When SDLC_DEBUG is set and cwd is non-git,
 *                          stderr contains the warning line.
 */
'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const LIB_PATH  = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'worktree.js');

// --- Arg parsing ---
const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return null;
  return args[i + 1];
}

const op  = getArg('--op');
const cwd = getArg('--cwd');

if (!op) {
  process.stderr.write('--op is required\n');
  process.exit(1);
}

const lib = require(LIB_PATH);

switch (op) {
  case 'exports': {
    console.log(JSON.stringify({
      hasResolveMainWorktree:     typeof lib.resolveMainWorktree === 'function',
      hasResolveMainWorktreeSafe: typeof lib.resolveMainWorktreeSafe === 'function',
    }, null, 2));
    break;
  }

  case 'resolveMain': {
    try {
      const result = lib.resolveMainWorktree(cwd || undefined);
      console.log(JSON.stringify({ ok: true, path: result }, null, 2));
    } catch (err) {
      console.log(JSON.stringify({ ok: false, error: err.message }, null, 2));
    }
    break;
  }

  case 'resolveMainSafe': {
    const result = lib.resolveMainWorktreeSafe(cwd || undefined);
    console.log(JSON.stringify({ path: result }, null, 2));
    break;
  }

  default:
    process.stderr.write(`Unknown op: ${op}\n`);
    process.exit(1);
}
