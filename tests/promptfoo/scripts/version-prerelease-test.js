/**
 * version-prerelease-test.js — exec-only integration test for version.js
 * pre-release counter continuation (Task 4, R20 / KD8).
 *
 * Builds a self-contained throwaway git repo with a base tag and a run of 15
 * pre-release tags (v1.3.3-rc.1 .. v1.3.3-rc.15), plus one untagged HEAD commit
 * so the Step 6.5 idempotency guard does NOT short-circuit. Runs the version.js
 * prepare flow with a positional `rc` label and asserts:
 *   - bumpOptions.preRelease continues the counter → 1.3.3-rc.16 (R20)
 *   - tags.conflictsWithNext.preRelease is false (emitted target is free — KD8)
 *   - tags.conflictsWithNext.{major,minor,patch} are false
 *   - tags.all (base-axis list from getTagList) excludes the rc.* pre-release tags
 *
 * No LLM provider. The prepare script emits JSON only — it performs no release.
 */

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT  = path.resolve(__dirname, '../../..');
const VERSION_JS = path.join(REPO_ROOT, 'plugins/sdlc-utilities/scripts/skill/version.js');

function emit(ok, details) {
  console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'} ${details}`);
  process.exitCode = ok ? 0 : 1;
}

function git(tmpRoot, gitArgs) {
  const r = spawnSync('git', gitArgs, { cwd: tmpRoot, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${gitArgs.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
  return r;
}

function runVersionJs(tmpRoot, extraArgs = []) {
  const env = { ...process.env, SDLC_ROOT: tmpRoot, SDLC_SKIP_CONFIG_CHECK: '1' };
  const r = spawnSync('node', [VERSION_JS, '--output-file', ...extraArgs], {
    cwd: tmpRoot,
    env,
    encoding: 'utf8',
    timeout: 15000,
  });
  // The output file path is on stdout.
  const outPath = (r.stdout || '').trim();
  let json = null;
  try {
    if (outPath && fs.existsSync(outPath)) {
      json = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      fs.unlinkSync(outPath);
    } else if (r.stdout) {
      json = JSON.parse(r.stdout.trim());
    }
  } catch (_) {}
  return { exitCode: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

function testPreReleaseContinuation() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vpre-'));
  try {
    // 1. Init a throwaway repo with a deterministic default branch and repo-local
    //    identity (NOT --global — clean-CI safe).
    git(tmp, ['init', '-b', 'main']);
    git(tmp, ['config', 'user.email', 'test@example.com']);
    git(tmp, ['config', 'user.name', 'Test']);

    // 2. Version source file.
    fs.writeFileSync(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '1.3.2' }, null, 2) + '\n'
    );

    // 3. Unified SDLC config — file mode, package.json source, 'v' tag prefix.
    fs.mkdirSync(path.join(tmp, '.sdlc'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, '.sdlc', 'config.json'),
      JSON.stringify({
        schemaVersion: 3,
        version: {
          mode: 'file',
          versionFile: 'package.json',
          fileType: 'package.json',
          tagPrefix: 'v',
        },
      }, null, 2) + '\n'
    );

    // 4. Initial commit + base tag.
    git(tmp, ['add', '-A']);
    git(tmp, ['commit', '-m', 'init']);
    git(tmp, ['tag', 'v1.3.2']);

    // 5. 15 pre-release tags: v1.3.3-rc.1 .. v1.3.3-rc.15.
    for (let i = 1; i <= 15; i++) {
      git(tmp, ['commit', '--allow-empty', '-m', `rc${i}`]);
      git(tmp, ['tag', `v1.3.3-rc.${i}`]);
    }

    // 6. One untagged commit so HEAD carries no release tag — the Step 6.5
    //    idempotency guard (getTagsAtHead) must NOT short-circuit before
    //    section 8 pre-release handling runs. LOAD-BEARING.
    git(tmp, ['commit', '--allow-empty', '-m', 'head-ahead']);

    // 7. Prepare run with positional `rc` label — emits JSON, no release.
    const r = runVersionJs(tmp, ['rc']);
    if (!r.json) {
      return emit(false, `no json output: exit=${r.exitCode} stderr=${r.stderr}`);
    }

    const bumpOptions = r.json.bumpOptions || {};
    const tags        = r.json.tags || {};
    const conflicts   = tags.conflictsWithNext || {};
    const all         = tags.all || [];

    // 8a. Continuation: counter advances past the highest existing rc tag (R20).
    if (bumpOptions.preRelease !== '1.3.3-rc.16') {
      return emit(false, `bumpOptions.preRelease expected 1.3.3-rc.16, got ${JSON.stringify(bumpOptions.preRelease)}`);
    }

    // 8b. Emitted pre-release target is free post-reconcile (KD8).
    if (conflicts.preRelease !== false) {
      return emit(false, `conflictsWithNext.preRelease expected false, got ${JSON.stringify(conflicts.preRelease)}`);
    }

    // 8c. Base-axis conflicts are all clear.
    if (conflicts.major !== false || conflicts.minor !== false || conflicts.patch !== false) {
      return emit(false, `conflictsWithNext base axes expected all false, got major=${conflicts.major} minor=${conflicts.minor} patch=${conflicts.patch}`);
    }

    // 8d. Regression guard: tags.all (getTagList → base-axis only) must NOT be
    //     broadened to include pre-release tags.
    const leakedRc = all.filter(t => String(t).startsWith('v1.3.3-rc.'));
    if (leakedRc.length > 0) {
      return emit(false, `tags.all unexpectedly includes pre-release tags: ${JSON.stringify(leakedRc)}`);
    }

    emit(true, `pre-release-continuation: bumpOptions.preRelease=1.3.3-rc.16 conflictsWithNext.preRelease=false tags.all excludes rc.*`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

testPreReleaseContinuation();
