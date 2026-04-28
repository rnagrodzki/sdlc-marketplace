/**
 * jira-write-guard-test.js — drives the PreToolUse hook and its helper modules.
 *
 * Used by datasets/jira-sdlc-guardrail-exec.yaml via script-runner.js. Each
 * --op invocation runs one isolated scenario, prints a single
 * "RESULT: <PASS|FAIL> <details>" line on stdout, and exits 0 when the
 * scenario matches expectations. We never throw on assertion failure — we
 * print and exit non-zero so the eval tooling can surface reasons.
 *
 * Operations:
 *   helper-payload-hash      — key-order independence + determinism
 *   helper-placeholder       — detects markers in nested ADF; ignores < 3 chars
 *   helper-template          — override beats shipped; missing returns null
 *   helper-artifact-store    — round-trip + stale-detection
 *
 *   hook-allow               — feeds a valid envelope (with artifacts present),
 *                               asserts {"continue":true}
 *   hook-deny                — feeds an envelope expected to be denied,
 *                               asserts permissionDecision == "deny" and reason
 *                               substring match
 *   hook-continue            — non-matching tool / malformed input, asserts
 *                               {"continue":true}
 *
 * Args (per scenario):
 *   --op <name>
 *   --tool <tool_name>            (hook-* ops)
 *   --payload-fixture <path>      (hook-* ops; relative to repo root)
 *   --reason-substring <text>     (hook-deny only)
 *   --artifacts <state>           one of: fresh | missing-approval | missing-critique | stale | none
 *   --template-mode <mode>        one of: shipped | override | none (default shipped)
 *   --tmp-prefix <name>           name suffix for the per-test tmpdir (avoids collisions)
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const LIB = path.join(REPO_ROOT, 'plugins/sdlc-utilities/skills/jira-sdlc/lib');
const HOOK = path.join(REPO_ROOT, 'plugins/sdlc-utilities/hooks/pre-tool-jira-write-guard.js');

const { payloadHash } = require(path.join(LIB, 'payload-hash.js'));
const { findPlaceholders, PLACEHOLDER_REGEX } = require(path.join(LIB, 'placeholder-detect.js'));
const { extractHeadings, loadTemplateHeadings } = require(path.join(LIB, 'template-fingerprint.js'));
const store = require(path.join(LIB, 'artifact-store.js'));

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return def;
  return process.argv[i + 1];
}

function emit(ok, details) {
  console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'} ${details}`);
  process.exitCode = ok ? 0 : 1;
  // Do NOT call process.exit() — it bypasses `finally` blocks, leaving artifact
  // files behind and polluting subsequent test runs that share os.tmpdir().
  return ok;
}

// ---- Helper-module tests ----

function helperPayloadHash() {
  const h1 = payloadHash({ a: 1, b: 2, c: { x: 1, y: 2 } });
  const h2 = payloadHash({ c: { y: 2, x: 1 }, b: 2, a: 1 });
  const h3 = payloadHash({ a: 1, b: 2, c: { x: 1, y: 2 } });
  if (h1 !== h2) return emit(false, `key-order: ${h1} != ${h2}`);
  if (h1 !== h3) return emit(false, `determinism: ${h1} != ${h3}`);
  if (!/^[0-9a-f]{64}$/.test(h1)) return emit(false, `format: ${h1}`);
  emit(true, `hash=${h1.slice(0, 12)}…`);
}

function helperPlaceholder() {
  const adf = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'See {issue_id}' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Owner: [name of owner]' }] },
    ],
  };
  const m = findPlaceholders({ description: 'No marker here', adf });
  if (m.length !== 2) return emit(false, `expected 2 markers, got ${m.length}: ${JSON.stringify(m)}`);
  const shortBracket = findPlaceholders({ s: '[ab]' });
  if (shortBracket.length !== 0) return emit(false, `short bracket should be ignored: ${JSON.stringify(shortBracket)}`);
  // Sanity: regex global flag works
  if (!PLACEHOLDER_REGEX.global) return emit(false, 'regex missing /g flag');
  emit(true, `markers=${m.length}`);
}

function helperTemplate() {
  // Shipped Bug.md must exist
  const tplShipped = loadTemplateHeadings('Bug', REPO_ROOT);
  if (tplShipped.source !== 'shipped' || tplShipped.headings.size === 0) {
    return emit(false, `shipped resolution failed: ${JSON.stringify({ source: tplShipped.source, n: tplShipped.headings.size })}`);
  }
  // Build a temp project root with override
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-tpl-test-'));
  fs.mkdirSync(path.join(tmpRoot, '.claude/jira-templates'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpRoot, '.claude/jira-templates/Bug.md'),
    '# Override\n## Custom Section\n## Another\n',
    'utf8'
  );
  const tplOverride = loadTemplateHeadings('Bug', tmpRoot);
  if (tplOverride.source !== 'override') {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    return emit(false, `override not preferred: ${tplOverride.source}`);
  }
  if (!tplOverride.headings.has('Custom Section') || !tplOverride.headings.has('Another')) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    return emit(false, `override headings missing: ${[...tplOverride.headings].join(',')}`);
  }
  // Missing template
  const tplMiss = loadTemplateHeadings('NoSuchType', REPO_ROOT);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  if (tplMiss.source !== null) return emit(false, `missing should be null, got ${tplMiss.source}`);
  emit(true, `shipped=${tplShipped.headings.size} override=ok missing=null`);
}

function helperArtifactStore() {
  const hash = crypto.randomBytes(16).toString('hex');
  store.writeCritique(hash, { initial: 'I', findings: ['F'], final: 'F' });
  store.writeApprovalToken(hash);
  let v = store.verifyArtifacts(hash);
  if (!v.approval || !v.critique) return emit(false, `verify fresh: ${v.reason}`);
  store.consumeArtifacts(hash);
  v = store.verifyArtifacts(hash);
  if (v.approval || v.critique) return emit(false, 'verify after consume should fail');
  // Stale detection — write then backdate mtime
  const hash2 = crypto.randomBytes(16).toString('hex');
  store.writeCritique(hash2, { initial: 'I', findings: [], final: 'F' });
  store.writeApprovalToken(hash2);
  const oldTime = Date.now() - (store.TTL_MS + 60_000);
  fs.utimesSync(store.approvalPath(hash2), oldTime / 1000, oldTime / 1000);
  fs.utimesSync(store.critiquePath(hash2), oldTime / 1000, oldTime / 1000);
  v = store.verifyArtifacts(hash2);
  if (v.approval || v.critique || !/stale/.test(v.reason || '')) {
    store.consumeArtifacts(hash2);
    return emit(false, `stale detection failed: reason=${v.reason}`);
  }
  store.consumeArtifacts(hash2);
  emit(true, 'roundtrip+stale ok');
}

// ---- Hook integration tests ----

function setupTmpProjectRoot(templateMode) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-guard-fix-'));
  if (templateMode === 'override') {
    fs.mkdirSync(path.join(root, '.claude/jira-templates'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.claude/jira-templates/Bug.md'),
      '# Bug Override\n## Steps to reproduce\n## Expected\n## Actual\n',
      'utf8'
    );
  }
  return root;
}

function setupArtifacts(toolInput, mode) {
  if (mode === 'none') return null;
  const hash = payloadHash(toolInput);
  if (mode === 'fresh') {
    store.writeCritique(hash, { initial: 'I', findings: [], final: 'F' });
    store.writeApprovalToken(hash);
  } else if (mode === 'missing-approval') {
    store.writeCritique(hash, { initial: 'I', findings: [], final: 'F' });
  } else if (mode === 'missing-critique') {
    store.writeApprovalToken(hash);
  } else if (mode === 'stale') {
    store.writeCritique(hash, { initial: 'I', findings: [], final: 'F' });
    store.writeApprovalToken(hash);
    const old = Date.now() - (store.TTL_MS + 60_000);
    fs.utimesSync(store.approvalPath(hash), old / 1000, old / 1000);
    fs.utimesSync(store.critiquePath(hash), old / 1000, old / 1000);
  }
  return hash;
}

function loadFixture(rel) {
  const full = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(full)) throw new Error(`fixture missing: ${rel}`);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function runHook(envelope, projectRoot) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify(envelope),
    encoding: 'utf8',
    cwd: projectRoot || REPO_ROOT,
    timeout: 5000,
  });
  return { stdout: r.stdout || '', stderr: r.stderr || '', exitCode: r.status ?? -1 };
}

function parseHookOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return {};
  try { return JSON.parse(trimmed); } catch { return { _parseError: trimmed.slice(0, 200) }; }
}

function hookCommon(expectedKind, reasonSubstring) {
  const op = arg('--op');
  const tool = arg('--tool');
  const fixture = arg('--payload-fixture');
  const artifactsMode = arg('--artifacts', 'fresh');
  const templateMode = arg('--template-mode', 'shipped');

  let toolInput = null;
  let envelope = null;
  let projectRoot = templateMode === 'override' ? setupTmpProjectRoot('override') : null;

  try {
    if (fixture === '__malformed__') {
      const r = spawnSync('node', [HOOK], { input: 'not json', encoding: 'utf8', cwd: REPO_ROOT, timeout: 5000 });
      const parsed = parseHookOutput(r.stdout);
      if (parsed.continue !== true) return emit(false, `malformed: expected continue, got ${r.stdout}`);
      return emit(true, 'malformed-input → continue:true');
    }
    if (fixture === '__no_input__') {
      envelope = { tool_name: tool };
      const r = runHook(envelope, projectRoot);
      const parsed = parseHookOutput(r.stdout);
      if (parsed.continue !== true) return emit(false, `no tool_input: expected continue, got ${r.stdout}`);
      return emit(true, 'missing-tool-input → continue:true');
    }

    toolInput = loadFixture(fixture);
    if (artifactsMode !== 'skip') setupArtifacts(toolInput, artifactsMode);
    envelope = { tool_name: tool, tool_input: toolInput };
    const r = runHook(envelope, projectRoot);
    const parsed = parseHookOutput(r.stdout);

    if (expectedKind === 'allow') {
      if (parsed.continue !== true) return emit(false, `expected allow, got: ${r.stdout}`);
      return emit(true, 'allow');
    }
    if (expectedKind === 'continue') {
      if (parsed.continue !== true) return emit(false, `expected continue, got: ${r.stdout}`);
      return emit(true, 'continue');
    }
    if (expectedKind === 'deny') {
      const decision = parsed.hookSpecificOutput && parsed.hookSpecificOutput.permissionDecision;
      const reason = parsed.hookSpecificOutput && parsed.hookSpecificOutput.permissionDecisionReason;
      if (decision !== 'deny') return emit(false, `expected deny, got decision=${decision} stdout=${r.stdout}`);
      if (reasonSubstring && !(reason || '').toLowerCase().includes(reasonSubstring.toLowerCase())) {
        return emit(false, `reason missing "${reasonSubstring}": ${reason}`);
      }
      return emit(true, `deny reason="${reason}"`);
    }
    return emit(false, `unknown expectedKind ${expectedKind}`);
  } finally {
    // Best-effort cleanup
    try { if (toolInput) store.consumeArtifacts(payloadHash(toolInput)); } catch { /* noop */ }
    try { if (projectRoot) fs.rmSync(projectRoot, { recursive: true, force: true }); } catch { /* noop */ }
  }
}

const op = arg('--op');
try {
  switch (op) {
    case 'helper-payload-hash':   helperPayloadHash(); break;
    case 'helper-placeholder':    helperPlaceholder(); break;
    case 'helper-template':       helperTemplate(); break;
    case 'helper-artifact-store': helperArtifactStore(); break;
    case 'hook-allow':            hookCommon('allow'); break;
    case 'hook-continue':         hookCommon('continue'); break;
    case 'hook-deny':             hookCommon('deny', arg('--reason-substring')); break;
    default:
      console.log(`RESULT: FAIL unknown op "${op}"`);
      process.exitCode = 2;
  }
} catch (e) {
  console.log(`RESULT: FAIL ${op}: ${e && e.message}`);
  process.exitCode = 1;
}
