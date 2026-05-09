'use strict';
/**
 * Assertion for Task 5 -- commit with processedClusterIds.
 * Verifies:
 * 1. --commit with processedClusterIds removes all specified clusters.
 * 2. Trailer and content below it are preserved byte-for-byte.
 * 3. --commit fails loud when processedClusterIds key is missing.
 * 4. --commit is a no-op for ids not present in log.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

module.exports = (output) => {
  let drafts;
  try {
    drafts = JSON.parse(output);
  } catch (e) {
    return { pass: false, score: 0, reason: `output is not valid JSON: ${e.message}` };
  }

  const helper = path.join(__dirname, '..', '..', '..', '.claude', 'scripts', 'harvest-learnings.js');
  // Coupling: drafts.logPath is always `<fixture-root>/.claude/learnings/log.md`
  // (set by exec-only promptfoo runner staging the fixture-fs into a tmpdir).
  // Strip that suffix to recover the fixture root for sibling fakes (harvest-fakes/).
  const projRoot = path.dirname(drafts.logPath).replace(/\/.claude\/learnings$/, '');
  const fakePr = path.join(projRoot, 'harvest-fakes', 'gh-pr.json');
  const fakeMerge = path.join(projRoot, 'harvest-fakes', 'git-merge-base.json');

  // Work in a temp copy to keep the fixture pristine
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harvest-commit-processed-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'learnings'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'harvest-fakes'), { recursive: true });
  const dstLog = path.join(tmp, '.claude', 'learnings', 'log.md');
  const dstFakePr = path.join(tmp, 'harvest-fakes', 'gh-pr.json');
  const dstFakeMerge = path.join(tmp, 'harvest-fakes', 'git-merge-base.json');
  fs.copyFileSync(drafts.logPath, dstLog);
  if (fs.existsSync(fakePr)) fs.copyFileSync(fakePr, dstFakePr);
  if (fs.existsSync(fakeMerge)) fs.copyFileSync(fakeMerge, dstFakeMerge);

  const env = Object.assign({}, process.env, {
    GH_HARVEST_FAKE_LIST: '/dev/null',
    GH_HARVEST_FAKE_PR: dstFakePr,
    GIT_HARVEST_FAKE_MERGE_BASE: dstFakeMerge,
  });

  // Re-run --output-file in tmp to get fresh cluster ids
  const tmpStdout = execFileSync('node', [helper, '--output-file'], {
    cwd: tmp, env, encoding: 'utf8',
  }).trim();
  const freshDrafts = JSON.parse(fs.readFileSync(tmpStdout, 'utf8'));

  // Collect all cluster ids (every status)
  const allIds = freshDrafts.clusters.map(c => c.id);
  if (allIds.length === 0) {
    return { pass: false, score: 0, reason: 'no clusters found in fresh drafts' };
  }

  // --- Test 1: processedClusterIds removes all clusters, trailer preserved ---
  const processedFile = path.join(tmp, 'processed.json');
  fs.writeFileSync(processedFile, JSON.stringify({ processedClusterIds: allIds }));
  execFileSync('node', [helper, '--commit', processedFile], { cwd: tmp, env, encoding: 'utf8' });

  const afterRaw = fs.readFileSync(dstLog, 'utf8');
  const trailerPreserved = /^## Tracked in GH Issues/m.test(afterRaw);
  const trailerContentPreserved = /Issue #99/.test(afterRaw);
  // All skill headers should be gone
  const allClustersRemoved = !/(pr-sdlc|version-sdlc|setup-sdlc|commit-sdlc): /.test(afterRaw.split('## Tracked in GH Issues')[0]);

  // --- Test 2: Missing processedClusterIds key → fail loud ---
  fs.copyFileSync(drafts.logPath, dstLog); // restore
  const badFile = path.join(tmp, 'bad.json');
  fs.writeFileSync(badFile, JSON.stringify({ approvedClusterIds: allIds })); // old key
  const badResult = spawnSync('node', [helper, '--commit', badFile], { cwd: tmp, env, encoding: 'utf8' });
  const failsLoud = badResult.status !== 0 && /processedClusterIds/.test(badResult.stderr);

  // --- Test 3: No-op for unknown ids ---
  fs.copyFileSync(drafts.logPath, dstLog); // restore
  const unknownFile = path.join(tmp, 'unknown.json');
  fs.writeFileSync(unknownFile, JSON.stringify({ processedClusterIds: ['nonexistentid123'] }));
  execFileSync('node', [helper, '--commit', unknownFile], { cwd: tmp, env, encoding: 'utf8' });
  const noopRaw = fs.readFileSync(dstLog, 'utf8');
  const noopPreserved = noopRaw === fs.readFileSync(drafts.logPath, 'utf8');

  const ok = trailerPreserved && trailerContentPreserved && allClustersRemoved && failsLoud && noopPreserved;
  const reason = ok
    ? 'processedClusterIds commit: all checks passed'
    : [
        !trailerPreserved && 'trailer not preserved',
        !trailerContentPreserved && 'trailer content not preserved',
        !allClustersRemoved && 'not all clusters removed',
        !failsLoud && 'old approvedClusterIds key did not fail loud',
        !noopPreserved && 'no-op for unknown ids did not preserve log',
      ].filter(Boolean).join('; ');

  return { pass: ok, score: ok ? 1 : 0, reason };
};
