'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

module.exports = (output) => {
  // The provider auto-read returned the JSON content. The script also wrote
  // its tmp file at a known path inside JSON; reuse that path for the dst-log
  // base, then drive a fresh --output-file invocation against an isolated tmp tree.
  const drafts = JSON.parse(output);
  const fixtureDir = path.dirname(path.dirname(path.dirname(drafts.logPath)));
  const repoRoot = fixtureDir.replace(/\/tests\/promptfoo\/fixtures-fs\/[^/]+$/, '');
  const helper = path.join(repoRoot, '.claude', 'scripts', 'harvest-learnings.js');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harvest-commit-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'learnings'), { recursive: true });
  const dstLog = path.join(tmp, '.claude', 'learnings', 'log.md');
  fs.copyFileSync(drafts.logPath, dstLog);
  const beforeLines = fs.readFileSync(dstLog, 'utf8').split('\n').length;

  const env = Object.assign({}, process.env, { GH_HARVEST_FAKE_LIST: '/dev/null' });
  // Provider auto-reads tmp-path stdout; bypass that here by reading the path
  // directly (we are not the provider).
  const tmpStdout = execFileSync('node', [helper, '--output-file'], { cwd: tmp, env, encoding: 'utf8' }).trim();
  const draftsTmp = JSON.parse(fs.readFileSync(tmpStdout, 'utf8'));
  const target = draftsTmp.clusters.find(c => c.skill === 'skill-beta');

  const approvedFile = path.join(tmp, 'approved.json');
  fs.writeFileSync(approvedFile, JSON.stringify({ approvedClusterIds: [target.id] }));
  execFileSync('node', [helper, '--commit', approvedFile], { cwd: tmp, env, encoding: 'utf8' });

  const afterRaw = fs.readFileSync(dstLog, 'utf8');
  const removed = beforeLines - afterRaw.split('\n').length;
  const ok = removed === 2
    && /^## Tracked in GH Issues/m.test(afterRaw)
    && /skill-alpha: first lesson/.test(afterRaw)
    && /skill-gamma: older lesson/.test(afterRaw)
    && !/skill-beta: second lesson/.test(afterRaw);

  return { pass: ok, score: ok ? 1 : 0, reason: ok ? 'commit removed only approved cluster' : `removed=${removed}, beta-gone=${!/skill-beta/.test(afterRaw)}` };
};
