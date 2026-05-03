/**
 * openspec-lib-test.js — exercise exported helpers in lib/openspec.js.
 *
 * Used by openspec-lib-exec.yaml tests via script_path: "repo://tests/promptfoo/scripts/openspec-lib-test.js".
 * The lib path is resolved relative to this script's real __dirname so it works
 * regardless of cwd.
 *
 * Usage:
 *   node openspec-lib-test.js --op <operation> [--project-root <path>] [--change <name>] [--no-path]
 *
 * Operations:
 *   exports           — prints which helpers are exported
 *   isArchived        — calls isArchived(projectRoot, change)
 *   validateChangeStrict — calls validateChangeStrict(projectRoot, change)  (pass --no-path to hide openspec from PATH)
 *   runArchive        — calls runArchive(projectRoot, change)               (pass --no-path to hide openspec from PATH)
 */
'use strict';

const path = require('path');

// Resolve lib path relative to this script — works correctly when run as a real file.
const REPO_ROOT = path.resolve(__dirname, '../../..');
const LIB_PATH  = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'openspec.js');

// --- Arg parsing ---
const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return null;
  return args[i + 1];
}
function hasFlag(name) {
  return args.includes(name);
}

const op          = getArg('--op');
const projectRoot = getArg('--project-root');
const changeName  = getArg('--change');
const noPath      = hasFlag('--no-path');

if (!op) {
  console.error('--op is required');
  process.exit(1);
}

if (noPath) {
  process.env.PATH = '/nonexistent-dir-only';
}

const lib = require(LIB_PATH);

switch (op) {
  case 'exports': {
    console.log(JSON.stringify({
      hasValidateChangeStrict:  typeof lib.validateChangeStrict === 'function',
      hasIsArchived:            typeof lib.isArchived === 'function',
      hasRunArchive:            typeof lib.runArchive === 'function',
      hasDetectActiveChanges:   typeof lib.detectActiveChanges === 'function',
      hasValidateChange:        typeof lib.validateChange === 'function',
    }, null, 2));
    break;
  }

  case 'isArchived': {
    if (!projectRoot || !changeName) {
      console.error('--project-root and --change required for isArchived');
      process.exit(1);
    }
    const result = lib.isArchived(projectRoot, changeName);
    console.log(JSON.stringify({ isArchived: result }, null, 2));
    break;
  }

  case 'validateChangeStrict': {
    if (!projectRoot || !changeName) {
      console.error('--project-root and --change required for validateChangeStrict');
      process.exit(1);
    }
    const result = lib.validateChangeStrict(projectRoot, changeName);
    console.log(JSON.stringify(result, null, 2));
    break;
  }

  case 'runArchive': {
    if (!projectRoot || !changeName) {
      console.error('--project-root and --change required for runArchive');
      process.exit(1);
    }
    const result = lib.runArchive(projectRoot, changeName);
    console.log(JSON.stringify(result, null, 2));
    break;
  }

  default: {
    console.error(`Unknown --op: ${op}`);
    process.exit(1);
  }
}
