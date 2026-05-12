/**
 * worktree-path-test.js — exercise resolvePath in lib/worktree-path.js.
 *
 * Used by datasets/worktree-path-exec.yaml tests via
 *   script_path: "repo://tests/promptfoo/scripts/worktree-path-test.js".
 * The lib path is resolved relative to this script's real __dirname.
 *
 * Usage:
 *   node worktree-path-test.js --op <operation> [options]
 *
 * Operations:
 *   exports         — prints which helpers are exported
 *   resolvePath     — calls resolvePath with JSON opts from --opts-json
 */
'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const LIB_PATH  = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'worktree-path.js');

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return null;
  return args[i + 1];
}

const op       = getArg('--op');
const optsJson = getArg('--opts-json');

if (!op) {
  process.stderr.write('--op is required\n');
  process.exit(1);
}

const lib = require(LIB_PATH);

switch (op) {
  case 'exports': {
    console.log(JSON.stringify({
      hasResolvePath: typeof lib.resolvePath === 'function',
    }, null, 2));
    break;
  }

  case 'resolvePath': {
    if (!optsJson) {
      process.stderr.write('--opts-json is required for resolvePath\n');
      process.exit(1);
    }
    let opts;
    try {
      opts = JSON.parse(optsJson);
    } catch (err) {
      process.stderr.write(`Failed to parse --opts-json: ${err.message}\n`);
      process.exit(1);
    }
    // Deserialize 'now' if provided as ISO string
    if (opts.now) {
      opts.now = new Date(opts.now);
    }
    try {
      const result = lib.resolvePath(opts);
      console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    } catch (err) {
      console.log(JSON.stringify({ ok: false, error: err.message }, null, 2));
    }
    break;
  }

  default:
    process.stderr.write(`Unknown op: ${op}\n`);
    process.exit(1);
}
