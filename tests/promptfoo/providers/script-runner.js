/**
 * Script runner provider — executes a node script directly and returns its stdout.
 * Used for validating that plugin scripts produce correct output against fixture directories.
 *
 * Expects vars:
 *   script_path  — absolute path to the node script
 *   script_args  — space-separated args (e.g., "--project-root /tmp/fixture-abc --json")
 *   script_cwd   — (optional) working directory for script execution
 */
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

    try {
      const stdout = execFileSync('node', [scriptPath, ...scriptArgs], {
        timeout: 30_000,
        encoding: 'utf8',
        cwd,
      });
      return { output: stdout };
    } catch (err) {
      // Include stdout even on non-zero exit (scripts may print to stdout before erroring)
      return {
        output: err.stdout ?? '',
        error: err.stderr ?? err.message,
      };
    }
  }
}

module.exports = ScriptRunnerProvider;
