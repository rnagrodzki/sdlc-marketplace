---
applyTo: "**/commands/*.md,**/skills/**/SKILL.md"
---
# script-resolution — Review Instructions

Reviews find-based script resolution and Glob-based reference lookup patterns in commands and skills for runtime correctness across installed and development contexts.

Default severity: high

## Checklist

- Every script resolution uses the two-step pattern: `find ~/.claude/plugins` first, then `find .` fallback — both steps include `-path "*/scripts/*"` to narrow scope
- `find .` fallback uses `-path "*/scripts/*"` to narrow the search — never bare `-name "script.js"` without a path filter (risks matching unrelated scripts in user projects)
- The script filename in `-name "script.js"` exactly matches the file as it exists in `plugins/*/scripts/` (case-sensitive, no typos, correct extension)
- Every resolution block ends with a failure guard: `[ -z "$SCRIPT" ] && { echo "ERROR: ..."; exit 2; }` — no silent continuation with an empty `$SCRIPT`
- The error message in the failure guard names the specific script and explains how to fix it (e.g., "Is the sdlc plugin installed?")
- Glob-based reference file lookups (REFERENCE.md, EXAMPLES.md, agent definitions) use `path: ~/.claude` first and explicitly document a cwd fallback if not found
- Glob patterns for reference file lookups are specific enough to match exactly one file — e.g., `**/review-sdlc/REFERENCE.md` not `**/REFERENCE.md`
- No resolution pattern uses hardcoded absolute paths other than the conventional `~/.claude/plugins` prefix
- When a skill re-resolves the same script in a later step, both resolution blocks use identical find patterns — no divergent logic for the same script
- `head -1` is used after `find` — verify the script name is specific enough that exactly one match is expected

## Severity Guide

| Finding | Severity |
|---------|----------|
| Missing failure guard — script runs with empty `$SCRIPT` | high |
| `find .` fallback without `-path "*/scripts/*"` | high |
| Script filename mismatch between resolution pattern and actual file | high |
| Glob reference lookup pattern too broad | medium |
| Missing cwd fallback for Glob-based reference lookup | medium |
| Error message doesn't name the script or suggest a fix | medium |
| Divergent resolution patterns for the same script across steps | medium |
| Hardcoded absolute path other than `~/.claude/plugins` | medium |
| `head -1` on a find pattern that could produce multiple matches | low |

## Note

In Claude Code reviews, files matching these patterns are excluded: `**/node_modules/**`, `docs/**`.
Copilot path-specific instructions do not support exclusion patterns — use judgment when findings apply to these files.
