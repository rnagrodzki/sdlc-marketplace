# `/guardrails-init-sdlc` — Plan Guardrail Initialization

## Overview

Scans the project's codebase structure, dependencies, and architecture to propose and configure plan guardrails in `.claude/sdlc.json`. Each guardrail defines a constraint that `/plan-sdlc` evaluates during its critique phases. Delegates scanning to `guardrails-prepare.js` and validation to `guardrails-validate.js`.

---

## Usage

```text
/guardrails-init-sdlc
/guardrails-init-sdlc --add
```

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--add` | Expansion mode — propose only guardrails not already configured | off |

---

## Examples

### Initial setup

```text
/guardrails-init-sdlc
```

Scans the project, proposes guardrails based on detected signals (database layer, API patterns, test structure, CI), and presents an interactive selection. Selected guardrails are written to `.claude/sdlc.json`.

### Expand existing guardrails

```text
/guardrails-init-sdlc --add
```

Reads existing guardrails, scans for new proposals that don't overlap, and lets you add to the current set without replacing.

---

## Prerequisites

- Git repository
- `.claude/sdlc.json` exists (created by `/setup-sdlc` or manually)

---

## What It Creates or Modifies

| Artifact | Path | Action |
|----------|------|--------|
| Project config | `.claude/sdlc.json` | Adds or updates `plan.guardrails` array |

---

## Related Skills

- [`/plan-sdlc`](plan-sdlc.md) — consumes guardrails during critique phases (Steps 3 and 5)
- [`/setup-sdlc`](setup-sdlc.md) — delegates guardrail setup to this skill in Step 4
- [`/review-init-sdlc`](review-init-sdlc.md) — analogous pattern for review dimensions

<!--
NOTE: This section is for GitHub markdown browsing only.
On the site (rnagrodzki.github.io/sdlc-marketplace), Related Skills are rendered
as styled SkillCard tiles auto-generated from `site/src/data/skills-meta.ts` connections.
The remark-strip-related-skills plugin removes this section before site rendering.
To add/update related skills on the site, edit the `connections` array in skills-meta.ts.
-->
