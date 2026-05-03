/**
 * Hook runner provider — executes a node hook script with stdin piped
 * and returns {stdout, stderr, exitCode} as JSON.
 *
 * Used for testing stdin-based hook scripts that communicate via exit codes
 * and stderr (unlike script-runner.js which returns stdout only).
 *
 * Expects vars:
 *   script_path  — absolute path to the hook script
 *   script_args  — (optional) space-separated args
 *   script_stdin — JSON string piped to the script's stdin
 *   script_cwd   — (optional) working directory for script execution
 *   script_home  — (optional) HOME override; accepts relative (resolved against
 *                  script_cwd) or absolute path. Useful for tests depending on
 *                  ~/.sdlc-cache/... layouts.
 */
const path = require('path');
const { spawnSync } = require('child_process');

class HookRunnerProvider {
  id() {
    return 'hook-runner';
  }

  async callApi(prompt, context) {
    const vars = context?.vars ?? {};
    const scriptPath = vars.script_path;
    const scriptArgs = (vars.script_args ?? '').split(/\s+/).filter(Boolean);
    const stdinData  = vars.script_stdin || '';
    const cwd        = vars.script_cwd || undefined;

    if (!scriptPath) {
      return { error: 'hook-runner: script_path var is required' };
    }

    const env = Object.assign({}, process.env);
    if (vars.script_home) {
      const home = path.isAbsolute(vars.script_home)
        ? vars.script_home
        : path.resolve(cwd || process.cwd(), vars.script_home);
      env.HOME = home;
    }

    const result = spawnSync('node', [scriptPath, ...scriptArgs], {
      input: stdinData,
      timeout: 30_000,
      encoding: 'utf8',
      cwd,
      env,
    });

    const output = JSON.stringify({
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.status ?? -1,
    }, null, 2);

    return { output };
  }
}

module.exports = HookRunnerProvider;
