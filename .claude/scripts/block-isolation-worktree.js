#!/usr/bin/env node
/**
 * PreToolUse hook — blocks Agent dispatch with isolation: "worktree".
 *
 * SDLC manages its own worktrees via util/worktree-create.js (git CLI).
 * The Claude Code SDK's isolation: "worktree" creates ephemeral worktrees
 * at .claude/worktrees/agent-<id> — these are never the intended SDLC
 * worktree and cause changes to land in the wrong location.
 *
 * See issues #370, #371, #372.
 */
'use strict';

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString());
    if (input.tool_input && input.tool_input.isolation === 'worktree') {
      process.stderr.write(
        'BLOCKED: isolation: "worktree" is forbidden in this repo.\n' +
        'SDLC manages worktrees via util/worktree-create.js (git CLI).\n' +
        'The Agent SDK\'s isolation: "worktree" creates .claude/worktrees/agent-<id>\n' +
        'which is never the intended SDLC worktree.\n' +
        'Remove the isolation parameter from this Agent dispatch.\n' +
        'See: https://github.com/rnagrodzki/sdlc-marketplace/issues/370\n'
      );
      process.exit(1);
    }
  } catch (_) {
    // Unparseable input — don't block
  }
  process.exit(0);
});
