---
applyTo: "**/commands/*.md,**/skills/**/SKILL.md,**/scripts/*.js"
---
# runtime-contract — Review Instructions

Reviews the command-to-script-to-skill execution pipeline for temp file lifecycle, exit code semantics, argument passing, JSON schema agreement, and version skew resilience.

Default severity: high

## Checklist

- Commands that invoke scripts capture output via `--output-file` flag — the script writes JSON to a crypto-random temp file and prints its path to stdout. Never use `mktemp` in the bash block
- The temp file variable name is unique per command (e.g., `PR_CONTEXT_FILE`, `MANIFEST_FILE`) — not a generic name like `TMPFILE` that could shadow across steps
- Every temp file has a corresponding `rm -f` cleanup that executes on all exit paths — success, error, and user cancellation
- Exit code handling matches script semantics: `0` = success, `1` = errors in JSON `errors` array, `2` = script crash — the command checks both `$?` and the `errors` array
- `$ARGUMENTS` is passed to `node "$SCRIPT"` so CLI flags reach the script as individual arguments — not concatenated into a single string
- JSON field names that the skill reads from script output match the fields the script actually produces — no field name mismatches
- Version skew workarounds handle both "field absent" and "field explicitly set to null"
- Scripts that accept `--project-root` default to `process.cwd()` — commands either pass `--project-root .` explicitly or correctly rely on the default
- The `diff_dir` temp directory created by `review-prepare.js` is cleaned up by the orchestrating skill after review completes — not left to the command
- Commands delegate to exactly one skill and pass the parsed JSON context as the primary input — they do not partially process JSON fields before delegation
- Scripts write valid JSON to `stdout` and all error/diagnostic messages to `stderr`
- When a command specifies `allowed-tools`, `Skill` and `Bash` are both listed

## Severity Guide

| Finding | Severity |
|---------|----------|
| Temp file not cleaned up on error path | high |
| Exit code not checked after script invocation | high |
| JSON field name mismatch between script output and skill reader | high |
| Script writes errors to stdout — corrupts JSON | high |
| `$ARGUMENTS` not passed to script — flags silently ignored | high |
| Version skew workaround missing null-vs-absent check | medium |
| Temp variable name shadows another variable in the same flow | medium |
| `--project-root` default assumption wrong for the usage context | medium |
| `diff_dir` cleanup responsibility ambiguous | medium |
| `allowed-tools` missing `Skill` or `Bash` | medium |
| Command performs non-trivial JSON processing before delegation | low |

## Note

In Claude Code reviews, files matching these patterns are excluded: `**/scripts/lib/**`, `**/node_modules/**`, `docs/**`.
Copilot path-specific instructions do not support exclusion patterns — use judgment when findings apply to these files.
