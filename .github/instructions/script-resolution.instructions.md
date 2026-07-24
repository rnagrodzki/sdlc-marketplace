---
applyTo: "**/commands/*.md,**/skills/**/SKILL.md"
---
# script-resolution — Review Instructions

Reviews injected-path script resolution and Glob-based reference lookup patterns in commands and skills for runtime correctness across installed and development contexts.

Auto-approving the injected-path invocation form is a user-deployed recommendation, not
something this checklist enforces: see `permissions.allow` in `settings.json` (documented in
`plugins/sdlc-utilities/scripts/README.md` and `docs/plugin-installation.md`), never `SKILL.md`
frontmatter.

Default severity: high

## Checklist

- Every plugin-script invocation uses the injected-path form: `node "<PLUGIN_ROOT>/scripts/<subdir>/<script>.js"` — no `find ~/.claude/plugins` resolver, no `$SCRIPT` variable, no cached-version ranking, no `trap`
- The block instructs the model to substitute `<PLUGIN_ROOT>` from the `sdlc plugin root:` line injected into session context by the `SessionStart` hook
- The script path in `<PLUGIN_ROOT>/scripts/<subdir>/<script>.js` exactly matches the file as it exists in `plugins/*/scripts/` (case-sensitive, no typos, correct extension, correct subdirectory)
- No resolver of any form (old `find`-based or the new injected-path form) appears in a subagent prompt template (`**/*-prompt.md`) or orchestrator agent template (`agents/*.md`) — the injected line is absent in subagent context, so any resolver there fails silently; pre-computed paths must be passed in instead
- Glob-based reference file lookups (REFERENCE.md, EXAMPLES.md, agent definitions) use `path: ~/.claude` first and explicitly document a cwd fallback if not found
- Glob patterns for reference file lookups are specific enough to match exactly one file — e.g., `**/review-sdlc/REFERENCE.md` not `**/REFERENCE.md`
- No resolution pattern uses hardcoded absolute paths other than the `<PLUGIN_ROOT>` substitution described above
- When a skill re-resolves the same script in a later step, both resolution blocks use the identical injected-path form — no divergent logic for the same script

## Canonical pattern

```bash
node "<PLUGIN_ROOT>/scripts/<subdir>/<script>.js"
```

`<PLUGIN_ROOT>` is substituted from the `sdlc plugin root: <abs>` line injected into session
context by the `SessionStart` hook on `startup`, `clear`, and `compact`. Because the hook that
fired IS the active install, its root is the one correct target — no version ranking or `find`
traversal is needed (#258 dissolved).

## Severity Guide

| Finding | Severity |
|---------|----------|
| `find ~/.claude/plugins` resolver used instead of the injected-path form — can silently select a fixture or marketplace-clone copy of the script | high |
| Plugin-script resolver (old or new form) present in a subagent prompt template or orchestrator agent template — the injected line is absent there, so resolution fails silently | high |
| Script path mismatch between resolution pattern and actual file | high |
| Missing/incorrect instruction to substitute `<PLUGIN_ROOT>` from the `sdlc plugin root:` context line | medium |
| Glob reference lookup pattern too broad | medium |
| Missing cwd fallback for Glob-based reference lookup | medium |
| Divergent resolution patterns for the same script across steps | medium |
| Hardcoded absolute path other than the `<PLUGIN_ROOT>` substitution | medium |

## Note

In Claude Code reviews, files matching these patterns are excluded: `**/node_modules/**`, `docs/**`.
Copilot path-specific instructions do not support exclusion patterns — use judgment when findings apply to these files.
