---
name: script-resolution
description: "Reviews find-based script resolution and Glob-based reference lookup patterns in commands and skills for runtime correctness across installed and development contexts"
triggers:
  - "**/commands/*.md"
  - "**/skills/**/SKILL.md"
skip-when:
  - "**/node_modules/**"
  - "docs/**"
severity: high
---

# Script Resolution Review

Review the runtime script resolution and file reference lookup patterns embedded in command and skill markdown files. This project resolves Node.js helper scripts at runtime using `find ~/.claude/plugins ... | head -1` with a `find .` fallback. These patterns must work both when the plugin is installed via the Claude Code marketplace (`~/.claude/plugins/`) and when running directly from the repository.

## Checklist

- [ ] Every script resolution uses the two-step pattern: `find ~/.claude/plugins` first, then `find .` fallback — both steps include `-path "*/scripts/*"` to narrow scope
- [ ] `find .` fallback uses `-path "*/scripts/*"` to narrow the search — never bare `-name "script.js"` without a path filter (risks matching unrelated scripts in user projects)
- [ ] The script filename in `-name "script.js"` exactly matches the file as it exists in `plugins/*/scripts/` (case-sensitive, no typos, correct extension)
- [ ] Every resolution block ends with a failure guard: `[ -z "$SCRIPT" ] && { echo "ERROR: ..."; exit 2; }` — no silent continuation with an empty `$SCRIPT`
- [ ] The error message in the failure guard names the specific script and explains how to fix it (e.g., "Is the sdlc plugin installed?")
- [ ] Glob-based reference file lookups (REFERENCE.md, EXAMPLES.md, agent definitions) use `path: ~/.claude` first and explicitly document a cwd fallback if not found
- [ ] Glob patterns for reference file lookups are specific enough to match exactly one file — e.g., `**/review-sdlc/REFERENCE.md` not `**/REFERENCE.md`
- [ ] No resolution pattern uses hardcoded absolute paths other than the conventional `~/.claude/plugins` prefix
- [ ] When a skill re-resolves the same script in a later step (e.g., first in Step 2 for validation, then in Step 7 for execution), both resolution blocks use identical find patterns — no divergent logic for the same script
- [ ] `head -1` is used after `find` to pick one result — verify the script name is specific enough that exactly one match is expected; flag if the name is generic enough to create ambiguity

## Severity Guide

| Finding | Severity |
|---------|----------|
| Missing failure guard — script runs with empty `$SCRIPT` | high |
| `find .` fallback without `-path "*/scripts/*"` — could match unrelated files | high |
| Script filename mismatch between resolution pattern and actual file | high |
| Glob reference lookup pattern too broad — could match wrong file | medium |
| Missing cwd fallback for Glob-based reference lookup | medium |
| Error message in failure guard doesn't name the script or suggest a fix | medium |
| Divergent resolution patterns for the same script across steps | medium |
| Hardcoded absolute path other than `~/.claude/plugins` | medium |
| `head -1` on a find pattern that could produce multiple matches | low |
