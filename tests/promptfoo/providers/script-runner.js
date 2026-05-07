/**
 * Script runner provider — executes a node script directly and returns its stdout.
 * Used for validating that plugin scripts produce correct output against fixture directories.
 *
 * Expects vars:
 *   script_path  — absolute path to the node script
 *   script_args  — space-separated args (e.g., "--project-root /tmp/fixture-abc --json")
 *   script_cwd   — (optional) working directory for script execution
 *   script_home            — (optional) HOME override; useful for tests that depend on
 *                            `~/.sdlc-cache/...` layouts. Accepts a relative path (resolved
 *                            against `script_cwd`) or an absolute path.
 *   script_env             — (optional) JSON string or object of extra env vars
 *   script_capture_stderr  — (optional) when truthy, append stderr to output even on exit 0
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

// Matches paths created by lib/output.js#createOutputFile via os.tmpdir() on macOS/Linux:
//   /tmp/...,  /var/folders/.../...  (macOS),  /private/var/...  (macOS canonicalized)
const TMP_PATH_RE = /^\/(?:tmp|var|private)\/.+\.json$/;

function maybeReadTmpFile(stdout, scriptPassthrough) {
  if (scriptPassthrough === true) return stdout;
  const trimmed = (stdout || '').trim();
  if (!trimmed.includes('\n') && TMP_PATH_RE.test(trimmed) && fs.existsSync(trimmed)) {
    try {
      return fs.readFileSync(trimmed, 'utf8');
    } catch (_) {
      return stdout;
    }
  }
  return stdout;
}

class ScriptRunnerProvider {
  id() {
    return 'script-runner';
  }

  async callApi(prompt, context) {
    const vars = context?.vars ?? {};
    const scriptPath = vars.script_path;
    const scriptArgs = (vars.script_args ?? '').split(/\s+/).filter(Boolean);
    const cwd = vars.script_cwd || undefined;

    if (!scriptPath) {
      return { error: 'script-runner: script_path var is required' };
    }

    // Build env: inherit parent env, allow HOME override and arbitrary additions.
    const env = Object.assign({}, process.env);
    if (vars.script_home) {
      const home = path.isAbsolute(vars.script_home)
        ? vars.script_home
        : path.resolve(cwd || process.cwd(), vars.script_home);
      env.HOME = home;
    }
    if (vars.script_env) {
      let extra = vars.script_env;
      if (typeof extra === 'string') {
        try { extra = JSON.parse(extra); } catch (_) { extra = {}; }
      }
      if (extra && typeof extra === 'object') Object.assign(env, extra);
    }

    const result = spawnSync('node', [scriptPath, ...scriptArgs], {
      timeout: 30_000,
      encoding: 'utf8',
      cwd,
      env,
    });

    const rawStdout = result.stdout ?? '';
    const stderr = (result.stderr ?? '').trim();
    const exitCode = result.status ?? (result.error ? 1 : 0);

    // Auto-read tmp-path JSON when stdout is solely a temp file path.
    const stdoutTrimmed = rawStdout.trim();
    let stdout = rawStdout;
    if (
      vars.script_passthrough !== true
      && stdoutTrimmed
      && !stdoutTrimmed.includes('\n')
      && TMP_PATH_RE.test(stdoutTrimmed)
      && fs.existsSync(stdoutTrimmed)
    ) {
      try { stdout = fs.readFileSync(stdoutTrimmed, 'utf8'); } catch (_) { /* fall through */ }
    }

    // Spawn error (ENOENT, ETIMEDOUT, etc.) — return the error message directly.
    if (result.error) {
      return { output: result.error.message };
    }

    // Include stderr when: (a) exit non-zero, OR (b) script_capture_stderr is explicitly set.
    // Default: exclude stderr on exit 0 so scripts that emit git noise don't corrupt JSON outputs.
    const includeStderr = exitCode !== 0 || vars.script_capture_stderr;
    const output = [stdout.trimEnd(), includeStderr ? stderr : null].filter(Boolean).join('\n');
    return { output: output || null };
  }
}

module.exports = ScriptRunnerProvider;
