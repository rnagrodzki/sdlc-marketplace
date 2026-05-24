# PR Review Feedback — Auto Mode + Deferred Harden (Issue #429, R25 Cell 3)

## Pull Request
PR #430: fix(config): schema version bump
Branch: feature/schema-v4 → main
Repository: user/my-project

## Configuration Context

`flags.auto = true`, `flags.alwaysHardenFromReview = false`

Per R25 cell 3: Step 11.6 must SKIP consent gate, SKIP dispatch entirely, and append
a deferred-action entry to `.sdlc/learnings/log.md` in R26 format.

## Prepare Manifest (excerpt)

```json
{
  "flags": {
    "auto": true,
    "alwaysHardenFromReview": false,
    "hardenClusterCap": 5
  },
  "pr": { "number": 430, "owner": "user", "repo": "my-project" },
  "threads": [
    { "id": "T1", "status": "outstanding", "hardenSurfaceHint": "review-dimensions", "hardenTargetFileHint": ".sdlc/review-dimensions/security.md", "severity": "high" },
    { "id": "T2", "status": "outstanding", "hardenSurfaceHint": "plan-guardrails", "hardenTargetFileHint": null, "severity": "medium" },
    { "id": "T3", "status": "outstanding", "hardenSurfaceHint": "execute-guardrails", "hardenTargetFileHint": null, "severity": "medium" }
  ]
}
```

## Review Comments

### Thread T1 — security dimension missing threat-model trigger (high)
File: .sdlc/review-dimensions/security.md, Line 4
Reviewer: alice
Verdict: agree-will-fix

> ### Finding 1
> - **Severity**: high
> - **Title**: Security review dimension missing threat-model trigger
> - **Description**: `.sdlc/review-dimensions/security.md` does not trigger on new external API integrations. Threat-model gaps go unreviewed.
> - **Suggestion**: Add external-API pattern to `triggers` in `.sdlc/review-dimensions/security.md`.

### Thread T2 — plan guardrails missing minimal-blast-radius rule (medium)
File: docs/specs/harden-sdlc.md, Line 30
Reviewer: bob
Verdict: agree-will-fix

> ### Finding 2
> - **Severity**: medium
> - **Title**: Plan guardrails missing minimal-blast-radius rule
> - **Description**: `plan.guardrails` allows plans that modify widely shared modules without an explicit blast-radius analysis. Risk goes unquantified.
> - **Suggestion**: Add `minimal-blast-radius` guardrail to `plan.guardrails` in `.sdlc/config.json`.

### Thread T3 — execute guardrails missing idempotency check (medium)
File: plugins/sdlc-utilities/scripts/skill/harden-prepare.js, Line 15
Reviewer: charlie
Verdict: agree-will-fix

> ### Finding 3
> - **Severity**: medium
> - **Title**: Execute guardrails missing idempotency-check rule
> - **Description**: `execute.guardrails` has no rule requiring migration and init scripts to be idempotent. Re-runs corrupt state silently.
> - **Suggestion**: Add `state-machine-idempotency` guardrail to `execute.guardrails`.
