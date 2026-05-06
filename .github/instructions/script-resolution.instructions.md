---
applyTo: "**/commands/*.md,**/skills/**/SKILL.md"
---
# script-resolution — Review Instructions

Reviews find-based script resolution and Glob-based reference lookup patterns in commands and skills for runtime correctness across installed and development contexts.

Default severity: high

## Checklist

- Every script resolution uses the two-step pattern: `find ~/.claude/plugins` first, then static path fallback — the `find` step includes `-path "*/sdlc*/scripts/*"` to narrow scope to sdlc-utilities
- The `-path` filter in the primary `find` uses `*/sdlc*/scripts/<script>.js` (or `*/sdlc*/lib/config.js` for config.js) — never bare `-name "script.js"` or a generic `*/scripts/*` filter that could match plugins outside sdlc-utilities
- The script filename in `-name "script.js"` exactly matches the file as it exists in `plugins/*/scripts/` (case-sensitive, no typos, correct extension)
- Every resolution block ends with a failure guard: `[ -z "$SCRIPT" ] && { echo "ERROR: ..."; exit 2; }` — no silent continuation with an empty `$SCRIPT`
- The error message in the failure guard names the specific script and explains how to fix it (e.g., "Is the sdlc plugin installed?")
- Glob-based reference file lookups (REFERENCE.md, EXAMPLES.md, agent definitions) use `path: ~/.claude` first and explicitly document a cwd fallback if not found
- Glob patterns for reference file lookups are specific enough to match exactly one file — e.g., `**/review-sdlc/REFERENCE.md` not `**/REFERENCE.md`
- No resolution pattern uses hardcoded absolute paths other than the conventional `~/.claude/plugins` prefix
- When a skill re-resolves the same script in a later step, both resolution blocks use identical find patterns — no divergent logic for the same script
- The `find` pipeline ends with `| sort -V | tail -1` — never bare `| head -1`. With multiple cached plugin versions present (e.g. `0.17.38` and `0.18.4` side-by-side under `~/.claude/plugins/cache/sdlc-marketplace/sdlc/`), filesystem-traversal order is non-deterministic and `head -1` may resolve a stale version. `sort -V | tail -1` does natural version ordering and selects the newest semver. See #258.

## Canonical pattern

```bash
SCRIPT=$(find ~/.claude/plugins -name "<script>.js" -path "*/sdlc*/scripts/<subdir>/<script>.js" 2>/dev/null | sort -V | tail -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/<subdir>/<script>.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/<subdir>/<script>.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate <script>.js. Is the sdlc plugin installed?" >&2; exit 2; }
```

## Severity Guide

| Finding | Severity |
|---------|----------|
| Missing failure guard — script runs with empty `$SCRIPT` | high |
| `find ~/.claude/plugins` without `-path "*/sdlc*/scripts/*"` — could match scripts from other plugins | high |
| Script filename mismatch between resolution pattern and actual file | high |
| Glob reference lookup pattern too broad | medium |
| Missing cwd fallback for Glob-based reference lookup | medium |
| Error message doesn't name the script or suggest a fix | medium |
| Divergent resolution patterns for the same script across steps | medium |
| Hardcoded absolute path other than `~/.claude/plugins` | medium |
| Bare `| head -1` after `find ~/.claude/plugins` (no `sort -V | tail -1`) — picks an arbitrary cached version (#258) | high |

## Note

In Claude Code reviews, files matching these patterns are excluded: `**/node_modules/**`, `docs/**`.
Copilot path-specific instructions do not support exclusion patterns — use judgment when findings apply to these files.
