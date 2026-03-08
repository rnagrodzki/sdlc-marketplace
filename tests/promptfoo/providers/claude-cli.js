const { execFile } = require('child_process');

class ClaudeCliProvider {
  id() {
    return 'claude-cli';
  }

  async callApi(prompt, context) {
    return new Promise((resolve) => {
      // Unset CLAUDECODE so claude doesn't refuse to run inside another Claude session
      const env = { ...process.env };
      delete env.CLAUDECODE;

      const proc = execFile('claude', ['-p', '--output-format', 'text', '--input-format', 'text'], {
        timeout: 300_000,
        maxBuffer: 20 * 1024 * 1024,
        env,
      }, (error, stdout, stderr) => {
        if (error) {
          return resolve({ error: error.message, output: stderr });
        }
        resolve({ output: stdout });
      });
      proc.stdin.write(prompt);
      proc.stdin.end();
    });
  }
}

module.exports = ClaudeCliProvider;
