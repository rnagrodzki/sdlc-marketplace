/**
 * test-script-resolution.js — validates the skill bash resolution pattern.
 *
 * Simulates the 3-line bash pattern used by all skills to locate helper scripts:
 *   1. find $HOME/.claude/plugins -name "<basename>" -path "*\/sdlc*\/scripts/<script-path>"  (installed plugin)
 *   2. [ -f "plugins/sdlc-utilities/scripts/<script-path>" ]  (dev fallback)
 *   3. error exit if neither found
 *
 * The fixture directory passed via --project-root must contain:
 *   fake-home/  — used as HOME override (may be empty)
 *   fake-repo/  — used as CWD override (may be empty)
 *
 * Output (stdout): JSON line, e.g.
 *   {"resolved":"/path/to/script.js","source":"installed"}
 *   {"resolved":"plugins/sdlc-utilities/scripts/skill/pr.js","source":"local"}
 *   {"resolved":null,"source":"error"}
 *
 * Usage: node test-script-resolution.js --script-name pr.js --script-path skill/pr.js --project-root /tmp/fixture-xyz
 */
const { execSync } = require('child_process');
const path = require('path');

// --- Parse args ---
const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) {
    throw new Error(`Missing required arg: ${name}`);
  }
  return args[i + 1];
}

const scriptName = getArg('--script-name');
const scriptPath = getArg('--script-path');
const projectRoot = getArg('--project-root');

const fakeHome = path.join(projectRoot, 'fake-home');
const fakeRepo = path.join(projectRoot, 'fake-repo');

// Build the bash script that mirrors the verbatim skill pattern.
// Uses fakeHome as HOME and runs with CWD=fakeRepo so the local fallback
// path ("plugins/sdlc-utilities/scripts/<path>") resolves correctly.
const bashScript = `
SCRIPT=$(find "${fakeHome}/.claude/plugins" -name "${scriptName}" -path "*/sdlc*/scripts/${scriptPath}" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/${scriptPath}" ] && SCRIPT="plugins/sdlc-utilities/scripts/${scriptPath}"
if [ -z "$SCRIPT" ]; then
  printf '{"resolved":null,"source":"error"}\\n'
  exit 0
fi
if echo "$SCRIPT" | grep -q "/.claude/plugins"; then
  printf '{"resolved":"%s","source":"installed"}\\n' "$SCRIPT"
else
  printf '{"resolved":"%s","source":"local"}\\n' "$SCRIPT"
fi
`;

try {
  const output = execSync(bashScript, {
    cwd: fakeRepo,
    encoding: 'utf8',
    shell: '/bin/bash',
    timeout: 10_000,
  });
  process.stdout.write(output);
} catch (err) {
  process.stdout.write(JSON.stringify({ resolved: null, source: 'error', detail: err.message }) + '\n');
  process.exit(1);
}
