# PR Review Feedback (Severity-tagged for issue #233)

## Pull Request
PR #233: feat(auth): add JWT validation
Branch: feature/jwt-validation → main
Repository: user/my-project

## Local Configuration

`.sdlc/local.json`:

```json
{
  "receivedReview": {
    "alwaysFixSeverities": ["critical"]
  }
}
```

## Prepare Manifest (excerpt)

```json
{
  "flags": { "auto": false, "alwaysFixSeverities": ["critical"] },
  "threads": [
    { "id": "T1", "severity": "critical", "path": "src/auth/jwt.ts", "line": 18 },
    { "id": "T2", "severity": "medium", "path": "src/auth/jwt.ts", "line": 42 }
  ]
}
```

## Review Comments

### Comment 1 (Thread T1) — confirmed bug, severity critical
File: src/auth/jwt.ts, Line 18
Reviewer: alice
Comment body (verbatim, as posted by review-sdlc):

> ### Finding 1
> - **File**: src/auth/jwt.ts
> - **Line**: 18
> - **Severity**: critical
> - **Title**: JWT signature verification skipped on missing key
> - **Description**: The `verify()` call falls through to `decode()` when the public key cannot be loaded, accepting any token unverified. This is a critical authentication bypass.
> - **Suggestion**: Throw on missing key; never decode without verifying.

Verdict: agree, will fix.

### Comment 2 (Thread T2) — confirmed style, severity medium
File: src/auth/jwt.ts, Line 42
Reviewer: bob
Comment body (verbatim):

> ### Finding 2
> - **File**: src/auth/jwt.ts
> - **Line**: 42
> - **Severity**: medium
> - **Title**: Variable shadowing reduces readability
> - **Description**: The inner `payload` shadows the outer scope. Functionally fine; renaming improves clarity.
> - **Suggestion**: Rename to `decodedPayload`.

Verdict: agree, will fix.
