/**
 * git-lib-test.js — exercise exported helpers in lib/git.js.
 *
 * Used by datasets/git-lib-exec.yaml tests via
 *   script_path: "repo://tests/promptfoo/scripts/git-lib-test.js".
 * The lib path is resolved relative to this script's real __dirname so it works
 * regardless of cwd.
 *
 * Usage:
 *   node git-lib-test.js --op <operation> [--project-root <path>] [--base <branch>]
 *                        [--scope <name-only|stat|content|cached>] [--no-throw-check]
 *
 * Operations:
 *   exports        — prints which helpers are exported (presence-only check)
 *   fetchBaseRef   — invokes fetchBaseRef(base, projectRoot); prints {ok:true} when no exception
 *                    (best-effort by contract — never throws, even when origin missing/unreachable)
 *   buildDiffCmd   — invokes buildBranchContribDiffCmd(scope, base) and prints the resulting
 *                    git command string. Used to assert 3-dot semantics for branch-contribution
 *                    scopes (committed/stat/content) — issue #239.
 */
'use strict';

const path = require('path');

// Resolve lib path relative to this script — works correctly when run as a real file.
const REPO_ROOT = path.resolve(__dirname, '../../..');
const LIB_PATH  = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'git.js');

// --- Arg parsing ---
const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return null;
  return args[i + 1];
}

const op          = getArg('--op');
const projectRoot = getArg('--project-root');
const base        = getArg('--base') || 'main';
const scope       = getArg('--scope');

if (!op) {
  console.error('--op is required');
  process.exit(1);
}

const lib = require(LIB_PATH);

switch (op) {
  case 'exports': {
    console.log(JSON.stringify({
      hasFetchBaseRef:               typeof lib.fetchBaseRef === 'function',
      hasBuildBranchContribDiffCmd:  typeof lib.buildBranchContribDiffCmd === 'function',
      hasGetChangedFiles:            typeof lib.getChangedFiles === 'function',
      hasGetDiffStat:                typeof lib.getDiffStat === 'function',
      hasGetDiffContent:             typeof lib.getDiffContent === 'function',
    }, null, 2));
    break;
  }

  case 'fetchBaseRef': {
    if (!projectRoot) {
      console.error('--project-root required for fetchBaseRef');
      process.exit(1);
    }
    try {
      lib.fetchBaseRef(base, projectRoot);
      console.log(JSON.stringify({ ok: true, threw: false }, null, 2));
    } catch (err) {
      // By contract this MUST NOT throw — surface the failure for the test to assert.
      console.log(JSON.stringify({ ok: false, threw: true, message: String(err && err.message) }, null, 2));
      process.exit(1);
    }
    break;
  }

  case 'buildDiffCmd': {
    if (!scope) {
      console.error('--scope required for buildDiffCmd (committed|stat|content|cached|worktree)');
      process.exit(1);
    }
    if (typeof lib.buildBranchContribDiffCmd !== 'function') {
      console.error('buildBranchContribDiffCmd is not exported');
      process.exit(1);
    }
    const cmd = lib.buildBranchContribDiffCmd(scope, base);
    console.log(JSON.stringify({ scope, base, cmd }, null, 2));
    break;
  }

  default: {
    console.error(`Unknown --op: ${op}`);
    process.exit(1);
  }
}
