# G17 Fixture: UPDATE-behavior — B1 Contract Change

## Context

A plan modifies an existing file to add a new CLI flag. No new files are created. The `cli-interface` dimension covers `src/cli/**` but does not yet have a checklist item for CLI flag backward-compatibility.

## Plan file (excerpt)

```markdown
### Task 1: Add --timeout flag to the export command

**Files:**
- Modify: src/cli/export.js
- Modify: src/cli/export.test.js

**Description:** Add a new `--timeout <ms>` CLI flag to the export command. Default: 30000ms. Timeout is enforced via AbortController. No existing behavior changes when the flag is omitted (backward-compatible addition). This is a public API surface change — the flag appears in `--help` output and is documented in the CLI reference.
```

## Dimension catalog (`.sdlc/review-dimensions/`)

```yaml
# cli-interface.md frontmatter
name: cli-interface
triggers:
  - "src/cli/**"
severity: medium
```

`src/cli/export.js` is covered by `cli-interface` (trigger matches). But the description indicates a public CLI flag addition — B1 criterion.

## Learnings log (`.sdlc/learnings/log.md`)

No recent `harden-sdlc` entries.

## Expected G17 output

G17 should fire **B1** for `cli-interface` (plan describes a public CLI flag change — a contract surface).

Expected finding:
- `kind`: `UPDATE-behavior`
- `dimension`: `cli-interface`
- `criteria`: includes `B1`
- `severity_hint`: `high`
- `patch`: references adding a backward-compatibility or flag-contract checklist item
- `why`: references the public CLI flag addition (`--timeout`)

Expected rendering: `## Suggested Review Dimensions` with `### UPDATE: cli-interface (B1)` H3 block.

**No CREATE proposals** — `src/cli/export.js` is covered by an existing trigger; no uncovered path exists.
