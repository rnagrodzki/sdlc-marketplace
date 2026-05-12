/**
 * config-sdlc-root-test.js — exercise resolveSdlcRoot and verbose tracing in lib/config.js.
 *
 * Used by datasets/config-resolve-sdlc-root-exec.yaml tests via
 *   script_path: "repo://tests/promptfoo/scripts/config-sdlc-root-test.js".
 * The lib path is resolved relative to this script's real __dirname.
 *
 * Usage:
 *   node config-sdlc-root-test.js --op <operation> [--cwd <path>] [--project-root <path>]
 *
 * Operations:
 *   exports         — prints which helpers are exported
 *   resolveSdlcRoot — calls resolveSdlcRoot({cwd}); prints {root:<abs>}
 *   readSection     — reads a section from project-root; prints the result as JSON
 *   traceLocal      — calls readLocalConfig(project-root); prints stdout+stderr summary
 *   traceDedup      — calls readLocalConfig(project-root) twice; checks stderr dedup
 *   traceQuiet      — calls readLocalConfig with SDLC_CONFIG_QUIET=1; checks no stderr
 */
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const LIB_PATH  = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'config.js');

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return null;
  return args[i + 1];
}

const op          = getArg('--op');
const cwd         = getArg('--cwd');
const projectRoot = getArg('--project-root');
const section     = getArg('--section');

if (!op) {
  process.stderr.write('--op is required\n');
  process.exit(1);
}

// Force the module to be loaded fresh for each test invocation.
// (The _tracedPaths Set is module-level, so each process gets a fresh Set.)
const lib = require(LIB_PATH);

switch (op) {
  case 'exports': {
    console.log(JSON.stringify({
      hasResolveSdlcRoot: typeof lib.resolveSdlcRoot === 'function',
      hasReadSection:     typeof lib.readSection === 'function',
      hasWriteSection:    typeof lib.writeSection === 'function',
    }, null, 2));
    break;
  }

  case 'resolveSdlcRoot': {
    try {
      const root = lib.resolveSdlcRoot({ cwd: cwd || undefined });
      console.log(JSON.stringify({ ok: true, root }, null, 2));
    } catch (err) {
      console.log(JSON.stringify({ ok: false, error: err.message }, null, 2));
    }
    break;
  }

  case 'readSection': {
    if (!projectRoot || !section) {
      process.stderr.write('--project-root and --section required\n');
      process.exit(1);
    }
    try {
      const result = lib.readSection(projectRoot, section);
      console.log(JSON.stringify({ ok: true, value: result }, null, 2));
    } catch (err) {
      console.log(JSON.stringify({ ok: false, error: err.message }, null, 2));
    }
    break;
  }

  case 'traceLocal': {
    // Redirect stderr to stdout so promptfoo can assert on it.
    // (script_capture_stderr: true would also work, but this is explicit.)
    if (!projectRoot) {
      process.stderr.write('--project-root required\n');
      process.exit(1);
    }
    // Call readLocalConfig; stderr trace appears in process stderr.
    lib.readLocalConfig(projectRoot);
    // Emit a marker so the test knows we got here.
    console.log('traceLocal:done');
    break;
  }

  case 'traceDedup': {
    if (!projectRoot) {
      process.stderr.write('--project-root required\n');
      process.exit(1);
    }
    // Call twice; dedup means only one stderr line.
    lib.readLocalConfig(projectRoot);
    lib.readLocalConfig(projectRoot);
    console.log('traceDedup:done');
    break;
  }

  default:
    process.stderr.write(`Unknown op: ${op}\n`);
    process.exit(1);
}
