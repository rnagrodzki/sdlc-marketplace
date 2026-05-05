#!/usr/bin/env node
/**
 * Test wrapper that loads execute.guardrails from .claude/sdlc.json
 * via the same readSection() call the execute-plan-sdlc skill uses inline.
 * Outputs JSON for promptfoo assertions. Used by tests covering issue #219
 * (flag-coherence guardrails appear in execute prepare output).
 *
 * Args: --project-root <path>
 */

const path = require('path');

function findRepoRoot(start) {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    try {
      require('fs').statSync(path.join(dir, 'plugins/sdlc-utilities/scripts/lib/config.js'));
      return dir;
    } catch (_) {
      dir = path.dirname(dir);
    }
  }
  return null;
}

const args = process.argv.slice(2);
let projectRoot = process.cwd();
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project-root' && args[i + 1]) {
    projectRoot = path.resolve(args[i + 1]);
    i++;
  }
}

const repoRoot = findRepoRoot(__dirname);
if (!repoRoot) {
  console.log(JSON.stringify({ error: 'config.js not found' }));
  process.exit(1);
}

const { readSection } = require(path.join(repoRoot, 'plugins/sdlc-utilities/scripts/lib/config.js'));
const execute = readSection(projectRoot, 'execute');
const guardrails = execute?.guardrails || [];
console.log(JSON.stringify({ guardrails }));
