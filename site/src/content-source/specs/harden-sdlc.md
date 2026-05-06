# harden-sdlc Specification

> User-invocable skill that, after an SDLC pipeline failure, analyzes the five hardening surfaces (plan guardrails, execute guardrails, review dimensions, copilot instructions, plugin self-bugs) and proposes user-approved edits that would prevent the same class of failure. Strengthen-only in v1.

**User-invocable:** yes
**Model:** sonnet (orchestrator pinned `haiku` per agent frontmatter)
**Prepare script:** `skill/harden-prepare.js`

## Arguments

- A1: `--failure-text <string>` — full text of the failure being analyzed (REQUIRED)
- A2: `--skill <skill-name>` — caller skill that produced the failure (REQUIRED)
- A3: `--step <name>` — step or section that failed (optional)
- A4: `--operation <name>` — operation the caller was attempting (optional)
- A5: `--exit-code <int>` — exit code or HTTP status from the failure (optional)
- A6: `--error-type <kind>` — `script crash` / `CLI failure` / `API error` / `build failure` / `escalation` (optional)
- A7: `--user-intent <string>` — short description of what the user was trying to do (optional)
- A8: `--args-string <string>` — arguments the caller skill was invoked with (optional)
- A9: `--output-file` — print manifest path only and exit 0 (mirrors `error-report-prepare.js` posture)

## Core Requirements

- R1: Required CLI flags `--failure-text` and `--skill` MUST be enforced — missing either yields a non-zero exit and a structured error message; the skill MUST NOT proceed past Step 1 (CONSUME) when validation fails.
- R2: Optional CLI flags (A3–A8) MUST be accepted and forwarded verbatim into the prepare-script manifest; absent fields surface as empty strings (or `null` for `exitCode`).
- R3: Stdin JSON fallback MUST be supported on the prepare script for long string fields (mirroring `error-report-prepare.js`); CLI flags take precedence over stdin fields.
- R4: The prepare script `harden-prepare.js` MUST load all five hardening surfaces deterministically into a single manifest:
  - Plan guardrails — `.sdlc/config.json` `plan.guardrails[]` (via `lib/config.js::readSection`)
  - Execute guardrails — `.sdlc/config.json` `execute.guardrails[]` (via `lib/config.js::readSection`)
  - Review dimensions — `.sdlc/review-dimensions/*.md` (frontmatter parsed via `lib/dimensions.js::extractFrontmatter` + `parseSimpleYaml`)
  - Copilot instructions — `.github/instructions/*.instructions.md` (frontmatter `applyTo` extracted; body NOT loaded)
  - Sibling-skill resolution — absolute path to `error-report-sdlc/REFERENCE.md` resolved via the canonical find-then-fallback pattern
- R5: The orchestrator agent MUST classify the failure as exactly one of `user-code`, `plugin-defect`, `ambiguous`, with a one-sentence rationale tied to the failure signal.
- R6: For each hardening surface (plan-guardrails, execute-guardrails, review-dimensions, copilot-instructions), the orchestrator MUST decide PROPOSE or SKIP and, when PROPOSE, emit a proposal with `surface`, `action`, `targetFile`, `patch` (preview), and `rationale` linked to the failure signal.
- R7: No surface file MAY be edited without an explicit per-proposal user approval recorded via AskUserQuestion in the SKILL.md main context. The orchestrator agent MUST NOT have file-write capability — the no-silent-write invariant is enforced at the tool boundary.
- R8: All v1 proposals MUST be in the strengthen-only direction (add a guardrail, tighten a description, raise severity, narrow a glob). Proposals to relax, remove, or weaken existing rules are forbidden in v1; the orchestrator MUST self-critique against this constraint before emitting JSON.
- R9: When classification is `plugin-defect`, the orchestrator MUST set `routeToErrorReport=true`, populate `errorReportPayload` with the suggested `--skill / --step / --operation / --error-text` for `error-report-sdlc`, and emit an empty `proposals` array. The SKILL.md MUST then dispatch `error-report-sdlc` instead of editing any user-side surface.
- R10: Severity vocabulary MUST be preserved per destination surface — sdlc.json guardrails use `error|warning`; review-dimensions use `critical|high|medium|low|info` (per `lib/dimensions.js::VALID_SEVERITIES`). Proposals must use the destination surface's vocabulary, never substitute one for the other.
- R11: The skill MUST support both standalone invocation (`/harden-sdlc --failure-text "…" --skill plan-sdlc`) and caller-dispatched invocation (Skill-tool dispatch from `plan-sdlc`, `execute-plan-sdlc`, `review-sdlc`, `commit-sdlc`); pipeline state (ship-sdlc paused state, execute-plan-sdlc state file) is optional context and absent values MUST NOT block execution.
- R12: Any proposed edit to `.sdlc/config.json` MUST be validated against `schemas/sdlc-config.schema.json` via `plugins/sdlc-utilities/scripts/ci/validate-guardrails.js` before write. Validation failure MUST surface the validator error to the user and offer retry-or-cancel — never silent commit.
- R13: Prepare script output is the single authoritative source for all contracted fields (P-fields) — script-provided values take unconditional precedence over skill-generated content, and all factual context (config, surface contents, sibling-skill paths, repo state) must originate from script output to ensure deterministic behavior.
- R-config-version (issue #232): The prepare script `skill/harden-prepare.js` MUST call `verifyAndMigrate(projectRoot, 'project')` at start. The call is short-circuited when CLI `--skip-config-check` OR env `SDLC_SKIP_CONFIG_CHECK=1` is present; both gates resolve into a single `flags.skipConfigCheck` boolean in the prepare output (CLI > env > default false). On migration failure the prepare emits non-zero exit and an `errors[]` entry naming the failing step; SKILL.md halts with that text verbatim.
  - Acceptance: prepare output includes `flags.skipConfigCheck` and a `migration` block (or null when skipped); SKILL.md gates further work on `errors.length === 0`.

## Workflow Phases

1. CONSUME — validate args, run prepare script, capture manifest path
   - **Script:** `skill/harden-prepare.js`
   - **Params:** A1–A8 forwarded
   - **Output:** JSON → P1–P10 (failure context, classification hint, five surface arrays, sibling skill path, pipeline state, repo metadata)
2. CLASSIFY — surface manifest classification + rationale to user; on `plugin-defect`, jump directly to ROUTE
3. ANALYZE — dispatch `harden-orchestrator` agent (model: haiku, tools: Read) with `MANIFEST_FILE` and `PROJECT_ROOT`; agent emits ONLY a JSON object with `classification`, `proposals`, `routeToErrorReport`, `errorReportPayload`
4. PRESENT — display every proposal with full patch preview; AskUserQuestion per proposal (`apply | skip`) plus global `cancel`
5. APPLY — for each approved proposal: validate against the surface's schema; on pass, write the file; on fail, surface validator error and offer retry-or-cancel
6. ROUTE — when classification is `plugin-defect`, dispatch `error-report-sdlc` using the canonical Glob-then-follow pattern with the orchestrator-supplied payload (no surface edits)
7. LEARN — append a one-line entry to `.sdlc/learnings/log.md` summarizing the hardening action

## Quality Gates

- G1: Proposal coherence — every emitted proposal MUST cite a specific failure-signal element (a guardrail id, a dimension name, a copilot pattern, or a verbatim phrase from `failure.text`) in its `rationale`
- G2: Surface coverage — when failure signal is non-empty, the orchestrator MUST evaluate every loaded surface (skip is acceptable but must be intentional, not omission)
- G3: Classification accuracy — `classification` MUST match observable evidence; `plugin-defect` requires the failure to point at plugin code (script crash inside `plugins/sdlc-utilities/`, agent malformed JSON, prepare-script exit 2), not user-code or config
- G4: No-silent-write invariant — across all paths (success, cancel, agent crash, validation fail) the count of files written without an `apply` AskUserQuestion answer MUST be zero

## Prepare Script Contract

- P1: `failure.text` (string) — verbatim from `--failure-text`
- P2: `failure.skill` (string) — verbatim from `--skill`
- P3: `failure.step` / `failure.operation` / `failure.exitCode` / `failure.errorType` / `failure.userIntent` / `failure.argsString` — optional context fields, empty when absent
- P4: `classification_hint` (string|null) — `user-code` | `plugin-defect` | `ambiguous` | `null`
- P5: `surfaces.planGuardrails[]` — `{id, severity, description}` objects
- P6: `surfaces.executeGuardrails[]` — `{id, severity, description}` objects
- P7: `surfaces.reviewDimensions[]` — `{name, severity, description, triggers, model, path}` objects
- P8: `surfaces.copilotInstructions[]` — `{applyTo, name, path}` objects
- P9: `surfaces.errorReportSkillPath` (string) — absolute path to resolved `error-report-sdlc/REFERENCE.md`
- P10: `pipeline.shipState` / `pipeline.executeState` — optional summaries of paused pipeline state (or `null`)
- P11: `repository.root` / `repository.branch` / `repository.recentDiffSummary` — git short-stat only, no full body

## Error Handling

- E1: Missing `--failure-text` or `--skill` → exit code 1; stdout JSON `{ errors: [...] }`; SKILL.md aborts at Step 1
- E2: Malformed surface file (e.g., dimension file with broken frontmatter) → record in manifest `errors[]`; surface returns the parseable subset; SKILL.md surfaces the warning to user but proceeds
- E3: Unknown failure type / classification cannot be determined → orchestrator emits `classification: "ambiguous"` with rationale; SKILL.md proceeds with proposals if any surface has signal, otherwise reports "no actionable hardening" and exits cleanly
- E4: Orchestrator returns malformed or non-JSON output → SKILL.md aborts with the raw response shown to user; no retry (issue is unrelated to the failure being analyzed)

## Constraints

- C1: No shell-out beyond read-only `git` (`git rev-parse --abbrev-ref HEAD`, `git diff --shortstat`); no `gh`, no `curl`, no network calls in the prepare script
- C2: `harden-prepare.js` MUST be ≤ 200 lines; surface-specific loaders MAY be extracted into `lib/harden-surfaces.js` to honor this bound
- C3: No LLM logic in the loader — all five surfaces are loaded deterministically by the prepare script; SKILL.md MUST NOT glob, parse YAML, or read config directly
- C4: No `promptfoo eval` invocation anywhere in the skill, its prepare script, or its tests (per `no-auto-eval` guardrail)
- C5: Must not skip, bypass, or defer prepare script execution — the script must run and exit successfully before any skill phase begins
- C6: Must not override, reinterpret, or discard prepare script output — for every P-field, the script return value is authoritative and final; the skill must not substitute LLM-generated alternatives
- C7: Must not independently compute, infer, or fabricate values for any field the prepare script is contracted to provide — if the script fails or a field is absent, the skill must stop rather than fill in data
- C8: Must not re-derive data the prepare script already computes via shell commands, tool calls, or LLM inference — script output is the sole source for all factual context, preserving deterministic behavior
- C9: Must not propose relaxing or removing existing rules in v1 (strengthen-only invariant)
- C10: Must not auto-dispatch from caller skills — every caller integration is opt-in via menu selection only

## Integration

- I1: Caller-skill dispatch contract — `plan-sdlc`, `execute-plan-sdlc`, `review-sdlc`, `commit-sdlc` each present an opt-in menu option that dispatches `Skill(harden-sdlc)` with `--failure-text`, `--skill`, `--step`, `--operation` (and optionally `--exit-code`). Canonical menu wording is shared across callers per `cross-skill-consistency` and `no-opposite-logical-vectors` guardrails.
- I2: `error-report-sdlc` handoff — when `classification == "plugin-defect"`, harden-sdlc dispatches `error-report-sdlc` instead of editing user-side surfaces; the orchestrator-supplied `errorReportPayload` carries `--skill / --step / --operation / --error-text` ready to forward.
- I3: `schemas/sdlc-config.schema.json` validation — proposed sdlc.json edits MUST pass `plugins/sdlc-utilities/scripts/ci/validate-guardrails.js` (canonical validator) before write; review-dimension edits MUST pass `schemas/review-dimension.schema.json`.
- I4: Session-start state — paused ship-sdlc state file (`.sdlc/execution/ship-*.json`) and execute-plan-sdlc state file (`.sdlc/execution/execute-*.json`) are optional context for the manifest; harden-sdlc reads these files when present but does not require them. `ship-sdlc` is intentionally NOT a caller — it delegates failure handling to its sub-skills, and harden-sdlc reaches the user through whichever sub-skill failed.

## Source

Fixes #221.
