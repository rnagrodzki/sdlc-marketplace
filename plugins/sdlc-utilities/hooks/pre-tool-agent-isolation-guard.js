#!/usr/bin/env node
'use strict';

/**
 * PreToolUse hook: Agent SDK isolation: "worktree" guardrail.
 *
 * Reads a JSON envelope from stdin (Claude Code hook protocol):
 *   { tool_name, tool_input, ... }
 *
 * When tool_name === 'Agent' and tool_input.isolation === 'worktree',
 * emits a blocking response (continue: false, stopReason, exit 2) that binds
 * under mode: bypassPermissions — unless the developer has opted out via
 * .sdlc/local.json hooks.agentIsolationGuard.enabled: false.
 *
 * Rationale: SDLC manages worktrees via util/worktree-create.js (git CLI).
 * The Agent SDK's isolation: "worktree" creates ephemeral worktrees at
 * .claude/worktrees/agent-<id> that are never the intended SDLC worktree,
 * causing commits to land in the wrong location.
 *
 * See issues #370, #372.
 * Opt-out: set hooks.agentIsolationGuard.enabled: false in .sdlc/local.json
 */

const fs = require('fs');
const path = require('path');

// Dependency resolution: the hook lives in plugins/.../hooks/; config.js is
// in plugins/.../scripts/lib/. Always look up relative to __dirname so test
// harnesses can copy or symlink the plugin tree elsewhere.
const LIB_ROOT = path.resolve(__dirname, '..', 'scripts', 'lib');

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { buf += chunk; });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

function emitContinue() {
  process.stdout.write(JSON.stringify({ continue: true }));
}

function emitBlock(reason) {
  process.stderr.write(reason + '\n');
  process.stdout.write(JSON.stringify({ continue: false, stopReason: reason, decision: 'block' }));
  process.exit(2);
}

/**
 * Read hooks.agentIsolationGuard.enabled from .sdlc/local.json.
 * Returns true (enabled) on any read or parse error — fails closed.
 * Does NOT read .sdlc/config.json (key is local-only per Key Decisions).
 */
function readLocalGuardConfig() {
  try {
    const { resolveSdlcRoot } = require(path.join(LIB_ROOT, 'config.js'));
    const root = resolveSdlcRoot();
    const localPath = path.join(root, '.sdlc', 'local.json');
    const raw = fs.readFileSync(localPath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

async function main() {
  let stdin;
  try {
    stdin = await readStdin();
  } catch (e) {
    process.stderr.write(`pre-tool-agent-isolation-guard: stdin read error: ${e.message}\n`);
    return emitContinue();
  }

  let envelope;
  try {
    envelope = JSON.parse(stdin || '{}');
  } catch (_) {
    // Malformed envelope — do not block on parse failure (defense-in-depth:
    // LLM-side prose rules are second line of defense).
    return emitContinue();
  }

  // Only act on Agent tool dispatches.
  if (!envelope || envelope.tool_name !== 'Agent') {
    return emitContinue();
  }

  // Check if tool_input.isolation === 'worktree'.
  if (!envelope.tool_input || envelope.tool_input.isolation !== 'worktree') {
    return emitContinue();
  }

  // Config opt-out: read .sdlc/local.json hooks.agentIsolationGuard.enabled.
  // Default = true (block). readLocalGuardConfig() catches all errors internally
  // and returns {} — no outer try/catch needed (fails closed by construction).
  const localCfg = readLocalGuardConfig();
  const enabled = localCfg?.hooks?.agentIsolationGuard?.enabled ?? true;
  if (!enabled) {
    return emitContinue();
  }

  return emitBlock(
    'BLOCKED: isolation: "worktree" is forbidden on Agent dispatch. ' +
    'SDLC worktrees are managed by util/worktree-create.js (git CLI). ' +
    'Adding isolation: "worktree" here creates .claude/worktrees/agent-<id> ephemeral paths ' +
    'that are not the intended SDLC worktree — commits land in the wrong location. ' +
    'Remove the isolation parameter from this Agent dispatch. ' +
    'To opt out per-developer, set `hooks.agentIsolationGuard.enabled: false` in ' +
    '.sdlc/local.json (or re-run /setup-sdlc and answer the prompt). ' +
    'See issues #370 #372.'
  );
}

main().catch((e) => {
  process.stderr.write(`pre-tool-agent-isolation-guard: uncaught error: ${e && e.stack || e}\n`);
  emitContinue();
});
