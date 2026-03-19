# `/plugin-check-sdlc` — Plugin Discovery Validation

## Overview

Validates the full plugin discovery and cross-reference chain so that the plugin
works correctly after installation from GitHub. Checks 16 structural properties
across marketplace manifests, plugin manifests, skills, scripts, hooks,
and agents — catching broken references before users encounter runtime failures.

---

## Usage

```text
/plugin-check-sdlc
```

Run from the root of the `sdlc-marketplace` repository.

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--markdown` | Output a formatted markdown report instead of delegating to the interactive skill | — |

---

## Examples

### All checks pass

```text
/plugin-check-sdlc
```

Expected output:

```
Plugin discovery check: 0 error(s), 0 warning(s)
pass: 16/16
✓ All discovery checks passed.
```

### Issues found

```text
/plugin-check-sdlc
```

Example output when a name mismatch exists:

```
Plugin discovery check: 1 error(s), 0 warning(s)
pass: 15/16  fail: 1/16

[PD5] name-consistency (ERROR)
marketplace.json plugin name(s) do not match plugin.json name(s)
  - Plugin entry name "sdlc-v2" in marketplace.json does not match
    plugin.json name "sdlc" — this causes "plugin not found" on update
```

The skill then guides you through fixing the mismatch and re-runs validation.

---

## What It Checks

| ID | Check | Validates |
|----|-------|-----------|
| PD1 | marketplace-manifest-exists | `.claude-plugin/marketplace.json` exists and is valid JSON |
| PD2 | marketplace-schema-reference | `$schema` field present |
| PD3 | marketplace-required-fields | `name` and `plugins` array present |
| PD4 | plugin-source-paths-valid | Each plugin `source` resolves to a dir with `plugin.json` |
| PD5 | name-consistency | marketplace plugin name matches `plugin.json` name |
| PD6 | plugin-required-fields | `name`, `description`, `version` in `plugin.json` |
| PD7 | semver-format | `version` is valid semantic version |
| PD8 | commands-discoverable | Command `.md` files have frontmatter with `description` |
| PD9 | command-skill-refs-valid | Skills referenced in commands exist |
| PD10 | command-script-refs-valid | Scripts referenced in commands exist |
| PD11 | skills-discoverable | Skill dirs have `SKILL.md` with `name` + `description` |
| PD12 | skill-supporting-files-exist | Sibling files referenced in `SKILL.md` exist |
| PD13 | skill-agent-refs-valid | Agents referenced in skills exist |
| PD14 | skill-script-refs-valid | Scripts referenced in skills exist |
| PD15 | hooks-valid-json | `hooks/hooks.json` exists and is valid JSON |
| PD16 | agents-discoverable | Agent files have `name`, `description`, `tools` frontmatter |

---

## Prerequisites

- Node.js >= 16 (uses built-in modules only, no `npm install`)
- Must be run from the `sdlc-marketplace` repository root (or pass `--project-root`)
- The `sdlc` plugin must be installed (`/plugin install sdlc@sdlc-marketplace`) or the
  script must be accessible in the current directory tree

---

## What It Creates or Modifies

This command is read-only. It does not create or modify any files.

If issues are found, the skill guides you through targeted edits to the files that
failed their checks. Re-run `/plugin-check-sdlc` after fixing to confirm.

---

## Related Skills

- [`/version-sdlc`](version-sdlc.md) — bumps the version validated by PD7
- [`/review-init-sdlc`](review-init-sdlc.md) — creates review dimensions referenced at runtime
- [`validate-plugin-consistency`](.claude/skills/validate-plugin-consistency/SKILL.md) — complementary check for internal code conventions (script resolution order, temp file usage)
