# SDLC Plugin Interop

How the SDLC plugin detects project state and what happens when co-installed plugins disagree.

## Authority model

SDLC detects OpenSpec initialization by checking for `openspec/config.yaml` — the canonical marker file created by `openspec init`. This file is the single evidence path used across all SDLC skills and hooks.

Detection is performed in two layers:

1. **Session-start hook** (`hooks/session-start.js`) — runs `detectActiveChanges` from `scripts/lib/openspec.js` and emits an `INITIALIZED` line into the `<system-reminder>` block with the evidence file path and spec count.
2. **Prepare scripts** (`scripts/skill/plan.js`, `scripts/skill/ship.js`) — re-run `detectActiveChanges` and include an `authoritative` field in their JSON output, citing `openspec/config.yaml` as the evidence path.

Both layers produce deterministic, script-driven output. Skills consume the prepare-script output and do not independently re-derive OpenSpec state.

## What to do when plugins conflict

When two plugins inject contradictory OpenSpec state into the same session context (one says "initialized", another says "not initialized"), trust the plugin that cites an evidence path.

SDLC's detection always names the exact file it checked (`openspec/config.yaml`). If another plugin's detection disagrees, the likely cause is one of:

- The other plugin checks for a different marker file (e.g., `.openspec/` instead of `openspec/`).
- The other plugin's detection runs before `openspec init` has completed.
- The other plugin caches state from a prior session where OpenSpec was not yet initialized.

When SDLC detects a contradictory "not initialized" signal in the session context alongside its own positive detection, it emits an audit line and continues with its own result. This is informational — SDLC does not attempt to correct the other plugin's output.

If you encounter a false-negative detection from another plugin, report it to that plugin's maintainer. SDLC cannot fix detection logic it does not own.

## Known conflicts

The `ai-setup-automation` plugin historically checked for `.openspec/` (dotfile path) instead of the `openspec/` directory that the OpenSpec CLI actually creates. This was fixed in [rnagrodzki/ai-setup-automation#28](https://github.com/rnagrodzki/ai-setup-automation/issues/28). If you see contradictory signals from that plugin, update to the version that includes the fix.

## What SDLC cannot do

SDLC has no mechanism to suppress, override, or reorder output from other plugins. Plugin isolation is a platform-level concern — Claude Code loads plugins independently and concatenates their session-start output into a single `<system-reminder>` block. SDLC can only control its own output and instruct its own skills to prefer its own detection results.
