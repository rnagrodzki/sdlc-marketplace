# `/harden-sdlc` — Strengthen Hardening Surfaces After a Pipeline Failure

## Overview

Use this skill after an SDLC pipeline failure to analyze the project's hardening surfaces (plan and execute guardrails, review dimensions, copilot instructions) and propose user-approved edits that would catch the same class of failure earlier next time. Strengthen-only in v1 — never relaxes or removes existing rules. No surface is edited without explicit per-proposal approval.

---

## Usage

```text
/harden-sdlc --failure-text "<full failure text>" --skill <caller-name>
```

The skill is also opt-in dispatched from `plan-sdlc`, `execute-plan-sdlc`, `review-sdlc`, and `commit-sdlc` failure menus. `ship-sdlc` is intentionally NOT a caller — it delegates failure handling to its sub-skills, so harden-sdlc reaches the user through whichever sub-skill failed.

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--failure-text <string>` | Full text of the failure being analyzed (REQUIRED) | — |
| `--skill <name>` | Caller skill that produced the failure (REQUIRED) | — |
| `--step <name>` | Step or section that failed | empty |
| `--operation <name>` | Operation the caller was attempting | empty |
| `--exit-code <int>` | Exit code or HTTP status from the failure | empty |
| `--error-type <kind>` | `script crash` / `CLI failure` / `API error` / `build failure` / `escalation` | empty |
| `--user-intent <string>` | Short description of what the user was trying to do | empty |
| `--args-string <string>` | Arguments the caller skill was invoked with | empty |

---

## Examples

### Standalone invocation after a guardrail block

```text
/harden-sdlc \
  --failure-text "Guardrail no-auto-eval failed: plan task 7 invokes promptfoo eval" \
  --skill plan-sdlc \
  --step "Step 4 — IMPROVE" \
  --operation "error-severity guardrail block"
```

Expected: prepare script writes a manifest to `$TMPDIR/sdlc-harden-*.json` with all five surfaces loaded, the orchestrator classifies the failure as `user-code`, and one or more `plan-guardrails` proposals are presented for approval.

### Caller-dispatched invocation from execute-plan-sdlc

```text
Skill(harden-sdlc) with args:
  --failure-text "Wave 2 output violates spec-first: SKILL.md edited without matching spec edit"
  --skill execute-plan-sdlc
  --step "5c-ter"
  --operation "post-wave guardrail evaluation"
```

Expected: harden-sdlc resumes the user's interactive flow within the caller skill, presents proposals tightening the relevant guardrail's description or severity, and returns to the caller after the user approves or skips.

### Plugin-defect classification routing to error-report-sdlc

```text
/harden-sdlc \
  --failure-text "harden-prepare.js crashed with exit code 2: undefined readSection" \
  --skill harden-sdlc \
  --step "Step 1 — CONSUME" \
  --error-type "script crash" \
  --exit-code 2
```

Expected: orchestrator emits `classification: "plugin-defect"`, no surface proposals are presented, and the user is asked to confirm dispatch of `error-report-sdlc` with the supplied payload.

---

## Prerequisites

- **`.sdlc/config.json`** — optional. When present, plan and execute guardrails are loaded from `plan.guardrails[]` and `execute.guardrails[]`. When absent, those surface arrays are empty and the orchestrator simply skips them.
- **`.sdlc/review-dimensions/*.md`** — optional. When present, each dimension's frontmatter is parsed via `lib/dimensions.js` and exposed as a hardening surface.
- **`.github/instructions/*.instructions.md`** — optional. When present, frontmatter `applyTo` patterns are exposed as a hardening surface (body content is not loaded).
- **`error-report-sdlc`** — required for the plugin-defect routing path. The prepare script resolves `REFERENCE.md` via in-repo path, then peer-relative fallback.
- **`gh` CLI / git** — only `git rev-parse` and `git diff --shortstat` are used (read-only). No network calls in the prepare script.

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| `$TMPDIR/sdlc-harden-<hex>.json` | Transient manifest written by `harden-prepare.js`; cleaned up by trap on every exit path |
| `.sdlc/config.json` | When user approves a `plan-guardrails` or `execute-guardrails` proposal — schema-validated via `ci/validate-guardrails.js` before write |
| `.sdlc/review-dimensions/<name>.md` | When user approves a `review-dimensions` proposal — validated via `lib/dimensions.js::validateDimensionFile` before write |
| `.github/instructions/<name>.instructions.md` | When user approves a `copilot-instructions` proposal — direct write after approval |
| `.sdlc/learnings/log.md` | One-line append after each invocation summarizing classification, applied/skipped counts, and the failure trigger |

No file is written without an explicit `apply` AskUserQuestion answer recorded for that specific proposal.

---

## Related Skills

- [`/plan-sdlc`](plan-sdlc.md) — caller; dispatches harden-sdlc at Step 4 error-severity guardrail block and Step 5 reviewer-loop max-iterations escalation
- [`/execute-plan-sdlc`](execute-plan-sdlc.md) — caller; dispatches harden-sdlc at Step 5a-pre and Step 5c-ter guardrail FAIL menus and at Step 6 persistent task-failure escalation
- [`/review-sdlc`](review-sdlc.md) — caller; dispatches harden-sdlc at Step 5 actionable-findings menu when verdict is CHANGES REQUESTED with at least one dimension blocker
- [`/commit-sdlc`](commit-sdlc.md) — caller; dispatches harden-sdlc at Step 5 subject-pattern reject as an alternative to editing the subject
- [`/error-report-sdlc`](error-report-sdlc.md) — receives plugin-defect routing when classification points at plugin code rather than user content
- [`/setup-sdlc`](setup-sdlc.md) — initial authoring of guardrails, dimensions, and copilot instructions — harden-sdlc strengthens what setup-sdlc creates

<!--
NOTE: This section is for GitHub markdown browsing only.
On the site (rnagrodzki.github.io/sdlc-marketplace), Related Skills are rendered
as styled SkillCard tiles auto-generated from `site/src/data/skills-meta.ts` connections.
The remark-strip-related-skills plugin removes this section before site rendering.
To add/update related skills on the site, edit the `connections` array in skills-meta.ts.
-->
