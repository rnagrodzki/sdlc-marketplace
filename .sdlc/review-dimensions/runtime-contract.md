---
name: runtime-contract
description: "Reviews the command-to-script-to-skill execution pipeline for temp file lifecycle, exit code semantics, argument passing, JSON schema agreement, and version skew resilience"
triggers:
  - "**/commands/*.md"
  - "**/skills/**/SKILL.md"
  - "**/scripts/*.js"
skip-when:
  - "**/node_modules/**"
  - "docs/**"
severity: high
model: opus
---

# Runtime Contract Review

Review the command→script→skill execution pipeline for correctness and resilience. Every command in this project follows the pattern: resolve script → run to temp file → read JSON → delegate to skill. A documented version skew bug in `pr-sdlc` (installed `pr-prepare.js` silently omitting `customTemplate`) illustrates how contract violations surface only at runtime. This dimension checks that all parties in the pipeline — command, script, and skill — agree on the interface.

## Checklist

- [ ] Commands that invoke scripts capture output via `--output-file` flag — the script writes JSON to a crypto-random temp file and prints its path to stdout. Never use `mktemp` in the bash block
- [ ] The temp file variable name is unique per command (e.g., `PR_CONTEXT_FILE`, `MANIFEST_FILE`, `VERSION_CONTEXT_FILE`) and not a generic name like `TMPFILE` that could shadow across steps
- [ ] Every temp file created by a command has a corresponding `rm -f` cleanup that executes on all exit paths — success, error, and user cancellation (look for cleanup noted in the workflow, not just in the "happy path")
- [ ] When a task creates state files under multiple prefixes (e.g., `plan-*`, `ship-*`, `execute-*`), the cleanup / GC logic must enumerate and sweep ALL created prefixes — not a subset. Asymmetric cleanup (sweeping `ship-*` and `execute-*` but omitting `plan-*`) leaves permanent orphans. Each new prefix must be added to the GC sweep at the same time it is introduced.
- [ ] Exit code handling matches script semantics: `0` = success with usable output, `1` = errors captured in JSON `errors` array, `2` = script crash — the command checks both `$?` and the `errors` array in the JSON
- [ ] `$ARGUMENTS` is passed to `node "$SCRIPT"` so that CLI flags reach the script as individual arguments — not concatenated into a single string
- [ ] JSON field names that the skill reads from the script output match the fields the script actually produces — no field name mismatches (e.g., skill reads `customTemplate` but script outputs `custom_template`)
- [ ] When a skill documents a version skew workaround (e.g., reading `.claude/pr-template.md` directly when `customTemplate` is null), the workaround handles both "field absent" and "field explicitly set to null"
- [ ] Scripts that accept `--project-root` default to `process.cwd()` — commands either pass `--project-root .` explicitly or correctly rely on the default
- [ ] The `diff_dir` temp directory created by `review-prepare.js` is cleaned up by the orchestrating skill (`rm -rf {manifest.diff_dir}`) after the review completes — not left to the command
- [ ] Commands delegate to exactly one skill and pass the parsed JSON context as the primary input — they do not partially process JSON fields or add derived fields before delegation
- [ ] Scripts write valid JSON to `stdout` and all error/diagnostic messages to `stderr` — commands capture `stdout` only (e.g., `node "$SCRIPT" ... > "$TEMP_FILE"`) and use `$?` for error detection
- [ ] When a command specifies `allowed-tools` in its frontmatter, `Skill` is listed (needed for delegation) and `Bash` is listed (needed for script execution)
- [ ] When a script resolves a flag from CLI + config inputs (e.g., `flags.X = config.X === true || args.X === true`), every SKILL.md decision site that gates on that concept references the resolved field (`flags.X`) — no SKILL.md site re-derives via `config.X`, raw `$ARGUMENTS`, or the original CLI string after Step 1 (CONSUME). Carve-outs that legitimately depend on persistent project state (e.g., CI scaffold install sites) must include an inline rationale comment explaining the divergence.

## Severity Guide

| Finding | Severity |
|---------|----------|
| Temp file not cleaned up — leaked on error path | high |
| Exit code not checked after script invocation | high |
| JSON field name mismatch between script output and skill reader | high |
| Script writes errors to stdout instead of stderr — corrupts JSON | high |
| `$ARGUMENTS` not passed to script — flags silently ignored | high |
| GC sweep omits a prefix class introduced by the same task | high |
| Version skew workaround missing null-vs-absent check | medium |
| Temp variable name shadows another variable in the same flow | medium |
| `--project-root` default assumption wrong for the usage context | medium |
| `diff_dir` cleanup responsibility ambiguous between command and skill | medium |
| `allowed-tools` missing `Skill` or `Bash` | medium |
| Command performs non-trivial JSON processing before delegation | low |
| SKILL.md decision site re-derives a script-resolved flag (e.g., reads `config.X` instead of `flags.X` after Step 1) | high |
| Carve-out site (legitimately reads `config.X`) lacks inline rationale comment | medium |
