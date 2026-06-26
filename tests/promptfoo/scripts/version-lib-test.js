/**
 * version-lib-test.js — exercise exported helpers in lib/version.js.
 *
 * Used by datasets/version-lib-exec.yaml tests via
 *   script_path: "repo://tests/promptfoo/scripts/version-lib-test.js".
 * The lib path is resolved relative to this script's real __dirname so it works
 * regardless of cwd.
 *
 * Usage:
 *   node version-lib-test.js --op <operation>
 *
 * Operations:
 *   reconcile   — assert counter-bump cases for reconcilePreReleaseWithTags
 *   predicate   — assert G3 collision detection for preReleaseTagExists
 */
'use strict';

const path = require('path');

// Resolve lib path relative to this script — works correctly when run as a real file.
const REPO_ROOT = path.resolve(__dirname, '../../..');
const LIB_PATH  = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'version.js');

// --- Arg parsing ---
const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return null;
  return args[i + 1];
}

const op = getArg('--op');

if (!op) {
  console.error('--op is required');
  process.exit(1);
}

const lib = require(LIB_PATH);

switch (op) {
  case 'reconcile': {
    const { reconcilePreReleaseWithTags } = lib;

    // Build tag array v1.3.3-rc.1 ... v1.3.3-rc.15
    const rcTags15 = Array.from({ length: 15 }, (_, i) => `v1.3.3-rc.${i + 1}`);

    const cases = [
      {
        desc: 'rc.1 with rc.1..rc.15 tags → rc.16',
        result: reconcilePreReleaseWithTags('1.3.3-rc.1', rcTags15),
        expected: '1.3.3-rc.16',
      },
      {
        desc: 'rc.1 with rc.9 and rc.10 → rc.11 (numeric, not lexical)',
        result: reconcilePreReleaseWithTags('1.3.3-rc.1', ['v1.3.3-rc.9', 'v1.3.3-rc.10']),
        expected: '1.3.3-rc.11',
      },
      {
        desc: 'rc.1 with no matching tags → unchanged',
        result: reconcilePreReleaseWithTags('1.3.3-rc.1', []),
        expected: '1.3.3-rc.1',
      },
      {
        desc: 'rc.1 with beta.7 tag (label isolation) → unchanged',
        result: reconcilePreReleaseWithTags('1.3.3-rc.1', ['v1.3.3-beta.7']),
        expected: '1.3.3-rc.1',
      },
      {
        desc: 'rc.1 with v1.4.0-rc.9 tag (base isolation) → unchanged',
        result: reconcilePreReleaseWithTags('1.3.3-rc.1', ['v1.4.0-rc.9']),
        expected: '1.3.3-rc.1',
      },
      {
        desc: 'no pre-release suffix → unchanged',
        result: reconcilePreReleaseWithTags('1.3.3', rcTags15),
        expected: '1.3.3',
      },
    ];

    for (const c of cases) {
      if (c.result !== c.expected) {
        console.log(`RESULT: FAIL — ${c.desc}: got ${JSON.stringify(c.result)}, expected ${JSON.stringify(c.expected)}`);
        process.exit(1);
      }
    }

    console.log('RESULT: PASS');
    break;
  }

  case 'predicate': {
    const { preReleaseTagExists } = lib;

    // Build tag array v1.3.3-rc.1 ... v1.3.3-rc.15
    const rcTags15 = Array.from({ length: 15 }, (_, i) => `v1.3.3-rc.${i + 1}`);

    const cases = [
      {
        desc: 'v1.3.3-rc.5 is present → true',
        result: preReleaseTagExists('1.3.3-rc.5', rcTags15, 'v'),
        expected: true,
      },
      {
        desc: 'v1.3.3-rc.16 is absent → false',
        result: preReleaseTagExists('1.3.3-rc.16', rcTags15, 'v'),
        expected: false,
      },
    ];

    for (const c of cases) {
      if (c.result !== c.expected) {
        console.log(`RESULT: FAIL — ${c.desc}: got ${JSON.stringify(c.result)}, expected ${JSON.stringify(c.expected)}`);
        process.exit(1);
      }
    }

    console.log('RESULT: PASS');
    break;
  }

  default: {
    console.error(`Unknown --op: ${op}`);
    process.exit(1);
  }
}
