---
name: harden-sdlc
description: "Use this skill after an SDLC pipeline failure to analyze hardening surfaces (plan and execute guardrails, review dimensions, copilot instructions) and propose user-approved edits that would prevent the same class of failure next time. Strengthen-only in v1 — never relaxes or removes existing rules. Required arguments: --failure-text <string> --skill <caller-name>. Optional: --step, --operation, --exit-code, --error-type, --user-intent, --args-string. Triggers on: harden, strengthen guardrails, prevent this failure, learn from this failure, after pipeline failure."
user-invocable: true
argument-hint: "--failure-text <text> --skill <name> [--step <s>] [--operation <op>]"
model: sonnet
---

# Hardening After a Pipeline Failure

This skill runs after an SDLC pipeline failure to propose user-approved edits to
the project's hardening surfaces (plan guardrails, execute guardrails, review
dimensions, copilot instructions) so the same class of failure is caught earlier
next time. Implements `docs/specs/harden-sdlc.md`.

**Announce at start:** "I'm using harden-sdlc (sdlc v{sdlc_version})." — extract the version from the `sdlc:` line in the session-start system-reminder. If no version is in context, omit the parenthetical.

---

## Step 0 — Parse Arguments (R1, R2)

Required CLI flags: `--failure-text`, `--skill`. Optional: `--step`,
`--operation`, `--exit-code`, `--error-type`, `--user-intent`, `--args-string`.

If `--failure-text` or `--skill` is missing, stop with an error message and do
not proceed past this step. The prepare script enforces this hard constraint
again at runtime, but failing fast in the skill body avoids wasting a script
invocation.

---

## Step 1 — CONSUME: Run the Prepare Script (R4, R13, C5–C8)

> **VERBATIM** — Run this bash block exactly as written. Do not modify, rephrase, or simplify the commands.

```bash
SCRIPT=$(find ~/.claude/plugins -name "harden-prepare.js" -path "*/sdlc*/scripts/skill/harden-prepare.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/skill/harden-prepare.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/skill/harden-prepare.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate skill/harden-prepare.js. Is the sdlc plugin installed?" >&2; exit 2; }

MANIFEST_FILE=$(node "$SCRIPT" \
  --failure-text "$FAILURE_TEXT" \
  --skill "$SKILL_NAME" \
  --step "$STEP_NAME" \
  --operation "$OPERATION" \
  --exit-code "$EXIT_CODE_ARG" \
  --error-type "$ERROR_TYPE" \
  --user-intent "$USER_INTENT" \
  --args-string "$ARGS_STRING" \
  --output-file)
EXIT_CODE_PREPARE=$?
echo "MANIFEST_FILE=$MANIFEST_FILE"
echo "EXIT_CODE=$EXIT_CODE_PREPARE"
# Single canonical cleanup: trap fires only when MANIFEST_FILE was written so
# we do not attempt `rm -f ""` on a failed script invocation.
trap '[ -n "$MANIFEST_FILE" ] && rm -f "$MANIFEST_FILE"' EXIT INT TERM
```

Substitute the shell variables with values from the parsed arguments. Empty
values for optional fields are tolerated.

**On non-zero `EXIT_CODE_PREPARE`:**

- Exit code 1: required field missing — show the script's stderr and stop.
- Exit code 2: prepare script crashed — show stderr and stop. Do **not**
  recursively dispatch this skill on its own crash; this is a plugin defect and
  belongs in `error-report-sdlc`.

**Do NOT read the manifest file contents into the main context yet.** Step 2
needs only the classification preview (a small subset), and Step 3 hands the
full manifest path to the orchestrator agent.

---

## Step 2 — CLASSIFY: Surface the Failure Classification (R5, R9)

Read **only** the `failure.*` and `classification_hint` fields from
`MANIFEST_FILE` — do not load the full surface arrays into the main context.
Display a short preview to the user:

```
harden-sdlc: failure context loaded
  Skill:        {failure.skill}
  Step:         {failure.step or "—"}
  Operation:    {failure.operation or "—"}
  Failure (first 200 chars): {failure.text[:200]}
  Classification hint:  {classification_hint or "(none — orchestrator will classify)"}
```

The orchestrator (Step 3) is responsible for the authoritative classification.
Continue to Step 3.

---

## Step 3 — ANALYZE: Dispatch the harden-orchestrator Agent (R6)

Use the `Agent` tool with:

- `subagent_type`: `sdlc:harden-orchestrator`
- `model`: `haiku`
- `prompt` (exactly two lines, no other content):

  ```text
  MANIFEST_FILE: <ERROR_CONTEXT_FILE>
  PROJECT_ROOT: <cwd>
  ```

  Substitute `<ERROR_CONTEXT_FILE>` with the absolute path captured in Step 1
  (`MANIFEST_FILE`) and `<cwd>` with the current working directory.

The orchestrator returns ONLY a JSON object:

```json
{
  "classification": "user-code | plugin-defect | ambiguous",
  "classificationRationale": "string",
  "routeToErrorReport": false,
  "errorReportPayload": null,
  "proposals": [ ... ]
}
```

Capture the returned object as `RESULT`. If JSON parse fails, stop and surface
the raw response to the user (per spec E4 — no retry, the issue is unrelated to
the failure being analyzed).

---

## Step 4 — Branch on Classification (R9)

If `RESULT.classification == "plugin-defect"` AND `RESULT.routeToErrorReport ==
true`: jump to **Step 6 — PLUGIN-DEFECT ROUTE**. Skip Step 5 (PRESENT and APPLY)
entirely — no surface edits are appropriate for plugin defects.

Otherwise (`user-code` or `ambiguous`), display the classification and rationale
to the user, then continue to Step 5 (PRESENT and APPLY).

```
Classification: {RESULT.classification}
Rationale:      {RESULT.classificationRationale}
```

If `RESULT.proposals` is empty, report `No actionable hardening proposals — the
failure signal does not point at any of the loaded surfaces.` and exit cleanly
(the trap from Step 1 cleans up the manifest).

---

## Step 5 — PRESENT and APPLY (R7, R8, R10, R12, C9, C10)

For each proposal in `RESULT.proposals`, present the full patch preview to the
user. Then use `AskUserQuestion`:

> Proposal {i+1} of {N}: {action} on {surface}
> Target: {targetFile}
> Rationale: {rationale}
>
> Preview:
> ```
> {patch}
> ```
>
> Apply this proposal?

Options: **apply** | **skip** | **cancel**

- **apply** — proceed to validation and write
- **skip** — record the proposal as skipped, continue to the next
- **cancel** — abort the entire skill (no further proposals processed); the
  trap cleans up the manifest

### 5a. Validate Before Write (R12)

When the user selects **apply**, validate the proposed change BEFORE writing:

- For `surface == "plan-guardrails"` or `"execute-guardrails"`: the target is
  `.sdlc/config.json`. Construct the prospective merged JSON in memory, then
  validate via the canonical guardrails validator:

  ```bash
  VALIDATOR=$(find ~/.claude/plugins -name "validate-guardrails.js" -path "*/sdlc*/scripts/ci/validate-guardrails.js" 2>/dev/null | head -1)
  [ -z "$VALIDATOR" ] && [ -f "plugins/sdlc-utilities/scripts/ci/validate-guardrails.js" ] && VALIDATOR="plugins/sdlc-utilities/scripts/ci/validate-guardrails.js"
  [ -z "$VALIDATOR" ] && { echo "ERROR: Could not locate ci/validate-guardrails.js. Is the sdlc plugin installed?" >&2; exit 2; }
  ```

  Run the validator against the prospective config. On non-zero exit, surface
  the validator's error to the user and use AskUserQuestion to offer **retry**
  (let user adjust the patch inline) or **cancel** (skip this proposal). Never
  silently commit a schema-invalid edit.

- For `surface == "review-dimensions"`: validate the prospective dimension file
  against `schemas/review-dimension.schema.json` via
  `lib/dimensions.js::validateDimensionFile`. Same retry/cancel handling on
  failure.

- For `surface == "copilot-instructions"`: no schema — apply the edit directly
  after the user's `apply` answer.

### 5b. Write After Validation Passes

Use Edit (preferred) or Write to apply the approved, validated change to
`proposal.targetFile`. Display a one-line confirmation:

```
Applied {action} on {surface} → {targetFile}
```

Severity vocabulary MUST be preserved per surface (R10):

- `plan-guardrails` / `execute-guardrails` use `error|warning`
- `review-dimensions` use `critical|high|medium|low|info`

The orchestrator already chose the correct vocabulary in its proposal — never
substitute one vocabulary for the other.

---

## Step 6 — PLUGIN-DEFECT ROUTE: Dispatch error-report-sdlc (R9)

When `RESULT.classification == "plugin-defect"`:

1. Display `RESULT.errorReportPayload` to the user as the proposed
   `error-report-sdlc` dispatch payload.
2. Use AskUserQuestion: **dispatch error-report-sdlc** | **cancel**.
3. On `dispatch error-report-sdlc`: Glob `**/error-report-sdlc/REFERENCE.md`,
   follow it, and dispatch with `skill=<failure.skill>`,
   `step=<failure.step>`, `operation=<failure.operation>`,
   `error=<failure.text>`, `exit-or-http-code=<failure.exitCode>`,
   `error-type=<failure.errorType or "script crash">`. This matches the
   canonical Glob-then-follow idiom used elsewhere in the plugin (e.g.,
   `review-sdlc/SKILL.md` Step 0 error path).
4. Do NOT edit any user-side hardening surface in the plugin-defect path. The
   no-silent-write invariant applies here too — the user must explicitly
   approve the error-report dispatch.

The trap from Step 1 cleans up the manifest on every exit path.

---

## Step 7 — Learning Capture

Append a single line to `.claude/learnings/log.md` summarizing the hardening
action:

```
## YYYY-MM-DD — harden-sdlc: <classification> for <failure.skill> at <failure.step>
Applied: <count> proposal(s) across <surface-list> | Skipped: <count> | Routed: <yes|no>
Trigger: <first 80 chars of failure.text>
```

Mirror the append pattern used by `commit-sdlc` and `execute-plan-sdlc`. Create
the `.claude/learnings/` directory and `log.md` file if they don't exist.

---

## DO NOT

- Edit any surface without an `apply` AskUserQuestion answer recorded for that
  specific proposal — the no-silent-write invariant is non-negotiable.
- Propose relaxing or removing existing rules — v1 is strengthen-only.
- Run `promptfoo eval` automatically — evaluation runs are user-initiated only.
- Invoke `error-report-sdlc` for `user-code` classifications — only the
  `plugin-defect` branch routes there.
- Read the full manifest contents into the main context — Step 2 reads only
  `failure.*` and `classification_hint`; the orchestrator owns the rest.
- Auto-dispatch this skill from a caller skill without explicit user selection
  in the caller's failure-handling menu.
- Recursively dispatch this skill on its own prepare-script or orchestrator
  crash — log the failure and stop.
- Substitute one severity vocabulary for another (sdlc.json `error|warning` vs
  review-dimensions `critical|high|medium|low|info`) — preserve per surface.

---

## When This Skill Is Invoked

- **Standalone:** `/harden-sdlc --failure-text "..." --skill plan-sdlc --step "Step 5" --operation "reviewer-loop"`
- **Caller-dispatched:** `plan-sdlc`, `execute-plan-sdlc`, `review-sdlc`, and
  `commit-sdlc` each present an opt-in menu option at their failure surfaces
  that dispatches `Skill(harden-sdlc)` with the same flag shape. `ship-sdlc` is
  intentionally NOT a caller — it delegates failure handling to its sub-skills,
  so harden-sdlc reaches the user through whichever sub-skill failed.

---

## See Also

- `docs/specs/harden-sdlc.md` — behavioral spec (source of truth)
- `docs/skills/harden-sdlc.md` — usage reference for end users
- `plugins/sdlc-utilities/agents/harden-orchestrator.md` — orchestrator agent
- `plugins/sdlc-utilities/scripts/skill/harden-prepare.js` — surface loader
- [`/error-report-sdlc`](../error-report-sdlc/SKILL.md) — plugin-defect route
- [`/setup-sdlc`](../setup-sdlc/SKILL.md) — initial guardrail/dimension authoring
