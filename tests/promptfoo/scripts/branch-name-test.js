/**
 * branch-name-test.js — exercise resolveBranchName in lib/branch-name.js.
 *
 * Used by datasets/branch-name-exec.yaml tests via
 *   script_path: "repo://tests/promptfoo/scripts/branch-name-test.js".
 * The lib path is resolved relative to this script's real __dirname.
 *
 * Usage:
 *   node branch-name-test.js --op <operation> [options]
 *
 * Operations:
 *   exports           — prints which helpers are exported
 *   resolveBranchName — calls resolveBranchName with JSON opts from --opts-json
 */
'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const LIB_PATH  = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'branch-name.js');

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
      hasResolveBranchName: typeof lib.resolveBranchName === 'function',
    }, null, 2));
    break;
  }

  case 'resolveBranchName': {
    if (!optsJson) {
      process.stderr.write('--opts-json is required for resolveBranchName\n');
      process.exit(1);
    }
    let opts;
    try {
      opts = JSON.parse(optsJson);
    } catch (e) {
      process.stderr.write(`Invalid JSON for --opts-json: ${e.message}\n`);
      process.exit(1);
    }
    try {
      const result = lib.resolveBranchName(opts);
      console.log(JSON.stringify({ ok: true, result }, null, 2));
    } catch (e) {
      console.log(JSON.stringify({ ok: false, error: e.message }, null, 2));
    }
    break;
  }

  default:
    process.stderr.write(`Unknown op: ${op}\n`);
    process.exit(1);
}
