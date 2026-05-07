# sdlc-utilities Hooks

This directory contains the lifecycle hooks shipped by the `sdlc-utilities` plugin. Hooks are not user-invocable — they are wired by `hooks/hooks.json` and dispatched automatically by Claude Code.

## Compaction Recovery Filename Contract (issue #256)

The compaction-recovery file is the cross-session handoff used to resume an SDLC pipeline that was interrupted by context compaction or by Claude Code stopping mid-pipeline.

**Location:** `<mainWorktree>/.sdlc/execution/.compact-recovery-<branchSlug>.json`

- `<mainWorktree>` is the path of the main git worktree (NOT the current worktree). Resolution lives in `lib/state.js` and is shared with the per-pipeline state files (`ship-<branchSlug>-*.json`, `execute-<branchSlug>-*.json`).
- `<branchSlug>` is the current branch name with `/` replaced by `-` (the same slugifier used by `lib/state.js::slugifyBranch`).

### Producers

- `pre-compact-save.js` — writes the recovery file when Claude Code is about to compact the conversation.
- `stop-state-save.js` — writes the recovery file when Claude Code stops with an active pipeline state.

Both producers compute their own `branchSlug` and call `resolveStateDir()` from `lib/state.js` to obtain `<mainWorktree>/.sdlc/execution/`. The filename is `.compact-recovery-${branchSlug}.json`.

### Consumer

- `session-start.js` — on session start, computes the current branch's `branchSlug`, reads `.compact-recovery-${branchSlug}.json` from `resolveStateDir()`, surfaces a recovery prompt if the file is fresher than the freshness gate (default 1 hour), and unlinks the file after consumption.

The consumer reads ONLY the file matching its own branchSlug — it does not scan the directory for other branches' recovery files. This makes per-branch sessions completely isolated: a recovery written by branch A never trips a session opened on branch B.

### Legacy Filename

Pre-fix, the file was named `.compact-recovery.json` (no branch suffix). On session-start, if a legacy `.compact-recovery.json` (no suffix) is encountered alongside the per-branch file, it is unlinked silently only when its mtime is older than the 1-hour freshness gate. This avoids destroying a fresh file that an even-older plugin version might have written in a concurrent session — an edge case that is itself out of scope per the issue's YAGNI note.

### Why Per-Branch?

Before this fix, two parallel sessions on different branches shared one filename and either overwrote each other's recovery state or read the wrong session's state on resume. Disambiguating by `branchSlug` is the minimal-change fix because each hook already computes `branchSlug` for the per-branch state-file convention. Same-branch concurrent sessions remain a theoretical edge case explicitly out of scope (one branch is expected to host one active pipeline at a time).
