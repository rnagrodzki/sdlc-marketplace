/**
 * branch-guard-test.js — exercise validateExpectedBranch in lib/branch-guard.js.
 *
 * Used by datasets/branch-guard-exec.yaml tests via
 *   script_path: "repo://tests/promptfoo/scripts/branch-guard-test.js".
 * The lib path is resolved relative to this script's real __dirname.
 *
 * Usage:
 *   node branch-guard-test.js --op <operation> [--current <branch>] [--expected <branch>]
 *
 * Operations:
 *   exports           — prints which helpers are exported
 *   validate          — calls validateExpectedBranch(current, expected) and prints JSON result
 */
'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const LIB_PATH  = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'branch-guard.js');

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

const op       = getArg('--op');
const current  = getArg('--current');   // may be undefined
const expected = getArg('--expected');  // may be undefined

if (!op) {
  process.stderr.write('--op is required\n');
  process.exit(1);
}

const lib = require(LIB_PATH);

switch (op) {
  case 'exports': {
    console.log(JSON.stringify({
      hasValidateExpectedBranch: typeof lib.validateExpectedBranch === 'function',
    }, null, 2));
    break;
  }

  case 'validate': {
    // Pass undefined through as-is — tests the "no --expected-branch" inactive path
    const result = lib.validateExpectedBranch(current, expected);
    console.log(JSON.stringify(result, null, 2));
    break;
  }

  default:
    process.stderr.write(`Unknown op: ${op}\n`);
    process.exit(1);
}
