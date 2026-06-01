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
 *   parseTasks        — reads `openspec/changes/<change>/tasks.md` under --project-root and prints parseTasks() output
 *   markTaskDone     — calls markTaskDone(change, ref, { line?, title? }) under --project-root
 *                      flags: --ref <id>, --line <N>, --title <s>
 *   markTaskDoneTwice — runs markTaskDone twice in a row to assert idempotency (`already-done` on 2nd call)
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
const refArg      = getArg('--ref');
const lineArg     = getArg('--line');
const titleArg    = getArg('--title');
const tempCopy    = hasFlag('--temp-copy');

/**
 * Optionally copy the fixture project into a fresh temp directory and rewrite
 * projectRoot to point at it. Lets mutating tests run repeatedly without
 * corrupting the on-disk fixture.
 */
function maybeTempCopyProjectRoot(src) {
  if (!tempCopy) return src;
  const fs = require('fs');
  const os = require('os');
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'opspec-fixture-'));
  // Shallow recursive copy of the openspec tree only — that's all we need.
  function copyRec(s, d) {
    fs.mkdirSync(d, { recursive: true });
    for (const e of fs.readdirSync(s, { withFileTypes: true })) {
      const sp = path.join(s, e.name);
      const dp = path.join(d, e.name);
      if (e.isDirectory()) copyRec(sp, dp);
      else if (e.isFile()) fs.copyFileSync(sp, dp);
    }
  }
  if (fs.existsSync(path.join(src, 'openspec'))) {
    copyRec(path.join(src, 'openspec'), path.join(dest, 'openspec'));
  }
  return dest;
}

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
      hasValidateChangeStrict:    typeof lib.validateChangeStrict === 'function',
      hasIsArchived:              typeof lib.isArchived === 'function',
      hasRunArchive:              typeof lib.runArchive === 'function',
      hasDetectActiveChanges:     typeof lib.detectActiveChanges === 'function',
      hasValidateChange:          typeof lib.validateChange === 'function',
      hasParseTasks:              typeof lib.parseTasks === 'function',
      hasMarkTaskDone:            typeof lib.markTaskDone === 'function',
      hasGetRequirementInventory: typeof lib.getRequirementInventory === 'function',
    }, null, 2));
    break;
  }

  case 'parseTasks': {
    if (!projectRoot || !changeName) {
      console.error('--project-root and --change required for parseTasks');
      process.exit(1);
    }
    const fs = require('fs');
    const tp = path.join(projectRoot, 'openspec', 'changes', changeName, 'tasks.md');
    let content = '';
    try { content = fs.readFileSync(tp, 'utf8'); } catch (e) {
      console.log(JSON.stringify({ error: e.code || 'read-error' }, null, 2));
      break;
    }
    const tasks = lib.parseTasks(content);
    console.log(JSON.stringify({ tasks }, null, 2));
    break;
  }

  case 'markTaskDone': {
    if (!projectRoot || !changeName) {
      console.error('--project-root and --change required for markTaskDone');
      process.exit(1);
    }
    const root = maybeTempCopyProjectRoot(projectRoot);
    const opts = {};
    if (lineArg) opts.line = parseInt(lineArg, 10);
    if (titleArg) opts.title = titleArg;
    const result = lib.markTaskDone(changeName, refArg || '', opts, { projectRoot: root });
    console.log(JSON.stringify(result, null, 2));
    break;
  }

  case 'markTaskDoneTwice': {
    if (!projectRoot || !changeName) {
      console.error('--project-root and --change required for markTaskDoneTwice');
      process.exit(1);
    }
    const root = maybeTempCopyProjectRoot(projectRoot);
    const opts = {};
    if (lineArg) opts.line = parseInt(lineArg, 10);
    if (titleArg) opts.title = titleArg;
    const first = lib.markTaskDone(changeName, refArg || '', opts, { projectRoot: root });
    const second = lib.markTaskDone(changeName, refArg || '', opts, { projectRoot: root });
    console.log(JSON.stringify({ first, second }, null, 2));
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

  case 'getRequirementInventory': {
    if (!projectRoot || !changeName) {
      console.error('--project-root and --change required for getRequirementInventory');
      process.exit(1);
    }
    const result = lib.getRequirementInventory(projectRoot, changeName);
    console.log(JSON.stringify(result, null, 2));
    break;
  }

  default: {
    console.error(`Unknown --op: ${op}`);
    process.exit(1);
  }
}
