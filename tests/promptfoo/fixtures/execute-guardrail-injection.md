# Execute — Guardrail Injection (Fixes #392 / R33)

## Plan in context (4 tasks across 2 waves)

```
# Auth Refactor Implementation Plan

**Goal:** Extract token validation into a dedicated service
**Architecture:** Pure refactor — extract methods, add tests, no behavior change
**Source:** conversation context
**Verification:** npm test -- auth

---

### Task 1: Create TokenValidator class
**Complexity:** Standard
**Risk:** Low
**Depends on:** none
**Verify:** npm test -- token-validator
**Files:** Create: src/auth/token-validator.ts; Test: src/auth/token-validator.test.ts
**Description:** New class extracting token parse + verify logic.
**Acceptance criteria:** ...

### Task 2: Wire TokenValidator into auth middleware
**Complexity:** Standard
**Risk:** Low
**Depends on:** Task 1
**Verify:** npm test -- auth-middleware
**Files:** Modify: src/auth/middleware.ts
**Description:** Replace inline parsing with TokenValidator.
**Acceptance criteria:** ...
```

## activeGuardrails (loaded from .sdlc/config.json → execute.guardrails)

```json
[
  { "id": "no-direct-db-access", "description": "Do not import db client outside repo layer", "severity": "error" },
  { "id": "no-axios", "description": "Prefer the project's native fetch wrapper over axios", "severity": "warning" }
]
```

## Pre-built wave manifest for Wave 1 (Task 1 only)

```json
{
  "waveNumber": 1,
  "totalWaves": 2,
  "qualityTier": "balanced",
  "escalationBudget": 2,
  "tasks": [
    { "id": "T1", "name": "Create TokenValidator class", "complexity": "Standard", "risk": "Low", "assignedModel": "sonnet", "files": { "create": ["src/auth/token-validator.ts"], "test": ["src/auth/token-validator.test.ts"] } }
  ],
  "guardrails": [
    { "id": "no-direct-db-access", "description": "Do not import db client outside repo layer", "severity": "error" },
    { "id": "no-axios", "description": "Prefer the project's native fetch wrapper over axios", "severity": "warning" }
  ],
  "expectedFiles": ["src/auth/token-validator.ts", "src/auth/token-validator.test.ts"],
  "verificationHint": "npm test -- token-validator"
}
```

Question for the test: render the Agent prompt the wave-runner would dispatch for T1. Show the
"## Project Guardrails" section verbatim. (Section MUST be present because `guardrails` is non-empty.)
