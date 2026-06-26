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
 *   exports             — prints which helpers are exported (presence-only check)
 *   fetchBaseRef        — invokes fetchBaseRef(base, projectRoot); prints {ok:true} when no exception
 *                         (best-effort by contract — never throws, even when origin missing/unreachable)
 *   buildDiffCmd        — invokes buildBranchContribDiffCmd(scope, base) and prints the resulting
 *                         git command string. Used to assert 3-dot semantics for branch-contribution
 *                         scopes (committed/stat/content) — issue #239.
 *   getChangedFilesScope — invokes getChangedFiles(base, projectRoot, scope) against a fixture repo
 *                         and prints {scope, base, files}. Used to assert default 'all' scope routes
 *                         through buildBranchContribDiffCmd (three-dot) — issue #364.
 */
'use strict';

const path = require('path');
const os   = require('os');
const fs   = require('fs');
const cp   = require('child_process');

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

  case 'getChangedFilesScope': {
    if (!projectRoot) {
      console.error('--project-root required for getChangedFilesScope');
      process.exit(1);
    }
    if (!scope) {
      console.error('--scope required for getChangedFilesScope (all|committed|staged|working|worktree)');
      process.exit(1);
    }
    if (typeof lib.getChangedFiles !== 'function') {
      console.error('getChangedFiles is not exported');
      process.exit(1);
    }
    const files = lib.getChangedFiles(base, projectRoot, scope);
    console.log(JSON.stringify({ scope, base, files }, null, 2));
    break;
  }

  case 'tagListVariants': {
    // Create a temp git repo, add tags, and assert getAllSemverTags vs getTagList behaviour.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'git-lib-tag-test-'));
    try {
      function run(cmd) {
        cp.execSync(cmd, { cwd: tmp, stdio: 'pipe' });
      }
      run('git init');
      run('git config user.email test@example.com');
      run('git config user.name Test');
      run('git commit --allow-empty -m init');
      run('git tag v1.3.2');
      run('git tag v1.3.3-rc.1');
      run('git tag v1.3.3-rc.2');
      run('git tag nightly');

      const allTags  = lib.getAllSemverTags(tmp);
      const stableTags = lib.getTagList(tmp);

      // getAllSemverTags must include rc tags and exclude nightly
      const expectedAll = new Set(['v1.3.3-rc.2', 'v1.3.3-rc.1', 'v1.3.2']);
      const actualAllSet = new Set(allTags);
      const allMatch = allTags.length === 3 &&
        [...expectedAll].every(t => actualAllSet.has(t)) &&
        !actualAllSet.has('nightly');

      // getTagList must return only [v1.3.2]
      const stableMatch = stableTags.length === 1 && stableTags[0] === 'v1.3.2';

      if (allMatch && stableMatch) {
        console.log('RESULT: PASS');
      } else {
        console.log(`RESULT: FAIL allTags=${JSON.stringify(allTags)} stableTags=${JSON.stringify(stableTags)}`);
        process.exit(1);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    break;
  }

  default: {
    console.error(`Unknown --op: ${op}`);
    process.exit(1);
  }
}
