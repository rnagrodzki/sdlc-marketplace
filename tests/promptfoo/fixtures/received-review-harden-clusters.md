# PR Review Feedback — Multiple Harden-Surface Clusters (Issue #429)

## Pull Request
PR #429: feat(guardrails): tighten SDLC guardrail coverage
Branch: feature/guardrail-coverage → main
Repository: user/my-project

## Prepare Manifest (excerpt)

```json
{
  "flags": {
    "auto": false,
    "alwaysHardenFromReview": false,
    "hardenClusterCap": 5
  },
  "threads": [
    { "id": "T1", "status": "outstanding", "hardenSurfaceHint": "review-dimensions", "hardenTargetFileHint": ".sdlc/review-dimensions/security.md", "severity": "high" },
    { "id": "T2", "status": "outstanding", "hardenSurfaceHint": "review-dimensions", "hardenTargetFileHint": ".sdlc/review-dimensions/security.md", "severity": "high" },
    { "id": "T3", "status": "outstanding", "hardenSurfaceHint": "review-dimensions", "hardenTargetFileHint": ".sdlc/review-dimensions/architecture.md", "severity": "medium" },
    { "id": "T4", "status": "outstanding", "hardenSurfaceHint": "plan-guardrails", "hardenTargetFileHint": null, "severity": "high" },
    { "id": "T5", "status": "outstanding", "hardenSurfaceHint": "plan-guardrails", "hardenTargetFileHint": null, "severity": "medium" },
    { "id": "T6", "status": "outstanding", "hardenSurfaceHint": "execute-guardrails", "hardenTargetFileHint": null, "severity": "medium" },
    { "id": "T7", "status": "outstanding", "hardenSurfaceHint": "copilot-instructions", "hardenTargetFileHint": null, "severity": "low" },
    { "id": "T8", "status": "outstanding", "hardenSurfaceHint": "review-dimensions", "hardenTargetFileHint": ".sdlc/review-dimensions/performance.md", "severity": "medium" },
    { "id": "T9", "status": "outstanding", "hardenSurfaceHint": "review-dimensions", "hardenTargetFileHint": ".sdlc/review-dimensions/logging.md", "severity": "low" }
  ]
}
```

## Review Comments

### Thread T1 — security dimension gap (high)
File: .sdlc/review-dimensions/security.md, Line 5
Reviewer: alice
Verdict: agree-will-fix

> ### Finding 1
> - **Severity**: high
> - **Title**: Security review dimension missing injection-attack trigger
> - **Description**: The `.sdlc/review-dimensions/security.md` dimension does not trigger on SQL/command-injection patterns. PRs introducing raw query construction would bypass security review.
> - **Suggestion**: Add injection patterns to `triggers` list in `.sdlc/review-dimensions/security.md`.

### Thread T2 — security dimension severity gap (high)
File: .sdlc/review-dimensions/security.md, Line 12
Reviewer: alice
Verdict: agree-will-fix

> ### Finding 2
> - **Severity**: high
> - **Title**: Security dimension severity is medium — should be critical
> - **Description**: Auth-related findings in `.sdlc/review-dimensions/security.md` default to medium severity. Security defects warrant critical.
> - **Suggestion**: Raise severity from `medium` to `critical` in `.sdlc/review-dimensions/security.md`.

### Thread T3 — architecture dimension too narrow (medium)
File: .sdlc/review-dimensions/architecture.md, Line 8
Reviewer: bob
Verdict: agree-will-fix

> ### Finding 3
> - **Severity**: medium
> - **Title**: Architecture review dimension does not cover cross-cutting concerns
> - **Description**: `.sdlc/review-dimensions/architecture.md` triggers only on new files; cross-cutting refactors are missed.
> - **Suggestion**: Extend `triggers` in `.sdlc/review-dimensions/architecture.md` to match modified structural files.

### Thread T4 — plan guardrail missing test-coverage rule (high)
File: src/services/auth.ts, Line 3
Reviewer: charlie
Verdict: agree-will-fix

> ### Finding 4
> - **Severity**: high
> - **Title**: Plan guardrails lack mandatory test-coverage rule
> - **Description**: The `plan.guardrails` array has no rule requiring new source files to include tests. Several recent PRs shipped untested code.
> - **Suggestion**: Add a `test-coverage-required` guardrail to `plan.guardrails` in `.sdlc/config.json`.

### Thread T5 — plan guardrails missing scope-creep rule (medium)
File: src/services/auth.ts, Line 47
Reviewer: charlie
Verdict: agree-will-fix

> ### Finding 5
> - **Severity**: medium
> - **Title**: Plan guardrails missing scope-creep guard
> - **Description**: `plan.guardrails` has no no-scope-creep rule, allowing plans to silently expand beyond stated requirements.
> - **Suggestion**: Add `no-scope-creep` to `plan.guardrails`.

### Thread T6 — execute guardrails missing wave-failure handling (medium)
File: plugins/sdlc-utilities/skills/execute-plan-sdlc/SKILL.md, Line 22
Reviewer: dave
Verdict: agree-will-fix

> ### Finding 6
> - **Severity**: medium
> - **Title**: Execute guardrails don't enforce wave-failure halt
> - **Description**: `execute.guardrails` allows partial execution even when a task wave fails validation. This masks broken builds.
> - **Suggestion**: Add a `wave-failure-halts-pipeline` guardrail to `execute.guardrails`.

### Thread T7 — copilot instructions missing security guidance (low)
File: .github/instructions/general.instructions.md, Line 1
Reviewer: eve
Verdict: agree-will-fix

> ### Finding 7
> - **Severity**: low
> - **Title**: Copilot instructions missing OWASP security guidance
> - **Description**: `.github/instructions/general.instructions.md` does not instruct the AI to check for OWASP Top 10 patterns.
> - **Suggestion**: Add security-check instruction to `.github/instructions/general.instructions.md`.

### Thread T8 — performance dimension too permissive (medium)
File: .sdlc/review-dimensions/performance.md, Line 3
Reviewer: alice
Verdict: agree-will-fix

> ### Finding 8
> - **Severity**: medium
> - **Title**: Performance review dimension missing N+1 query trigger
> - **Description**: `.sdlc/review-dimensions/performance.md` does not flag N+1 database query patterns.
> - **Suggestion**: Add ORM loop patterns to `triggers` in `.sdlc/review-dimensions/performance.md`.

### Thread T9 — logging dimension severity too low (low)
File: .sdlc/review-dimensions/logging.md, Line 2
Reviewer: bob
Verdict: agree-will-fix

> ### Finding 9
> - **Severity**: low
> - **Title**: Logging dimension severity below threshold for compliance
> - **Description**: `.sdlc/review-dimensions/logging.md` severity is `low`; compliance audits require at least `medium`.
> - **Suggestion**: Raise severity in `.sdlc/review-dimensions/logging.md` to `medium`.
