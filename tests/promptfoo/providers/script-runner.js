/**
 * Script runner provider — executes a node script directly and returns its stdout.
 * Used for validating that plugin scripts produce correct output against fixture directories.
 *
 * Expects vars:
 *   script_path  — absolute path to the node script
 *   script_args  — space-separated args (e.g., "--project-root /tmp/fixture-abc --json")
 *   script_cwd   — (optional) working directory for script execution
 *   script_home  — (optional) HOME override; useful for tests that depend on
 *                  `~/.sdlc-cache/...` layouts. Accepts a relative path (resolved
 *                  against `script_cwd`) or an absolute path.
 *   script_env   — (optional) JSON string or object of extra env vars
 */
const path = require('path');
const { execFileSync } = require('child_process');

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

    try {
      const stdout = execFileSync('node', [scriptPath, ...scriptArgs], {
        timeout: 30_000,
        encoding: 'utf8',
        cwd,
        env,
      });
      return { output: stdout };
    } catch (err) {
      // Include stdout + stderr on non-zero exit so assertions can check error messages
      const stdout = err.stdout ?? '';
      const stderr = err.stderr ?? err.message;
      return {
        output: [stdout, stderr].filter(Boolean).join('\n'),
      };
    }
  }
}

module.exports = ScriptRunnerProvider;
