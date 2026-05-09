// Test runner for script_stub_bin feature in providers/script-runner.js.
// Invokes `gh` via PATH lookup using execSync — when `script_stub_bin` points
// to this fixture's `bin/` dir, the stub `gh` script is invoked instead of any
// real `gh` on the user's PATH. Stdout from this runner is the assertion
// surface for tests/promptfoo/datasets/script-runner-stub-bin-exec.yaml.
const { execSync } = require('child_process');

try {
  const out = execSync('gh --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(out);
} catch (err) {
  // Real gh missing or stub absent — surface stderr/stdout/exit so the negative
  // control case can assert "no STUB-GH-INVOKED marker present".
  process.stdout.write(`runner-error: ${err.message}\n`);
  if (err.stdout) process.stdout.write(`stdout: ${err.stdout}\n`);
  process.exit(0);
}
