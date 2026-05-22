# G17 Fixture: UPDATE — Rename/Directory Drift (U3)

## Context

A plan renames the `lib/` directory to `core/`. An existing dimension explicitly targets `lib/**` — its trigger glob will be stale after the rename.

## Plan file (excerpt)

```markdown
### Task 1: Rename lib/ to core/ for clarity

**Files:**
- Modify: core/auth.js (moved from lib/auth.js)
- Modify: core/db.js (moved from lib/db.js)
- Modify: core/utils.js (moved from lib/utils.js)

**Description:** Rename-only refactor: move all files from lib/ to core/. No behavior change. Update all import paths.
```

## Dimension catalog (`.sdlc/review-dimensions/`)

```yaml
# lib-quality.md frontmatter
name: lib-quality
triggers:
  - "lib/**"
severity: medium
```

The plan renames `lib/` → `core/`, making the `lib/**` trigger stale.

## Learnings log (`.sdlc/learnings/log.md`)

No recent `harden-sdlc` entries with `lib-quality` in a `Dimensions:` line.

## Expected G17 output

G17 should fire **U3** (plan renames `lib/` which is explicitly named in `lib-quality` triggers).

Expected finding:
- `kind`: `UPDATE-path`
- `dimension`: `lib-quality`
- `criteria`: includes `U3`
- `severity_hint`: `high`
- `patch`: describes updating the trigger glob from `lib/**` to `core/**`
- `why`: references the directory rename from `lib/` to `core/`

**Pure-refactor suppression does NOT apply to U3:** U3 fires on structural trigger staleness regardless of behavior intent. The description says "rename-only" but U3 is a path-integrity criterion, not a behavior criterion — B-criteria suppression does not extend to U-criteria.

Expected rendering: `## Suggested Review Dimensions` section with a `### UPDATE: lib-quality (U3)` H3 block.
