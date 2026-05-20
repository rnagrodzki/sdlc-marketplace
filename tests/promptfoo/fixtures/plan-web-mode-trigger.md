# Plan Web-Mode Trigger Context

## plan-prepare.js Output (pre-computed)

```json
{
  "openspec": { "present": false, "activeChanges": [], "branchMatch": null },
  "fromOpenspec": null,
  "guardrails": [],
  "explorePack": {
    "manifestPath": "/tmp/sdlc-explore-feat-jwt-abc456/manifest.json",
    "outDir": "/tmp/sdlc-explore-feat-jwt-abc456",
    "scopeHintCount": 6,
    "webResearchSignal": true,
    "error": null
  },
  "errors": []
}
```

## User Request

What is the best practice for JWT validation in Node.js? Implement it in our auth service touching
`src/api/auth.ts`, `src/services/token.ts`, `src/middleware/auth-guard.ts`, `src/utils/crypto.ts`,
`src/models/session.ts`, `tests/auth.test.ts`.

## Note

`webResearchSignal: true` because the prompt contains "best practice". The orchestrator MUST emit
at least one `web` or `hybrid` dimension.

## Orchestrator Brief (simulated return)

```
Brief file: /tmp/sdlc-explore-feat-jwt-abc456/discovery-brief.md
Out dir: /tmp/sdlc-explore-feat-jwt-abc456
Dimensions: 5 (2 code, 2 web, 1 hybrid)
Web findings: 6
Contradictions: 1
Zero-finding dimensions: none
```

### Discovery Brief Contents

```markdown
# Discovery Brief

Generated: 2026-05-20T06:05:00Z
Dimensions: 5 (2 code, 2 web, 1 hybrid)

## Dimensions

| Dimension | Mode | Model | Findings | Status |
|---|---|---|---|---|
| jwt-current-impl | code | haiku | 2 | ACTIVE |
| token-expiry-paths | code | sonnet | 2 | ACTIVE |
| jwt-node-best-practices | web | sonnet | 3 | ACTIVE |
| jwks-uri-rotation | web | haiku | 1 | ACTIVE |
| rfc7519-exp-compliance | hybrid | sonnet | 2 | ACTIVE |

## Findings

### F-jwt-current-impl-* (code)
F-jwt-current-impl-1: src/api/auth.ts:42 — HS256 hardcoded; no algorithm allow-list
F-jwt-current-impl-2: src/services/token.ts:88 — No `exp` claim validation

### F-token-expiry-paths-* (code)
F-token-expiry-paths-1: src/middleware/auth-guard.ts:30 — Token decoded but expiry never checked
F-token-expiry-paths-2: src/utils/crypto.ts:15 — `verifyToken` accepts any algorithm string

### F-jwt-node-best-practices-* (web)
F-jwt-node-best-practices-1: https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet — Use RS256 or ES256 for asymmetric signing (recency: 2023, source-type: OWASP)
F-jwt-node-best-practices-2: https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp — Always validate `exp`, `iss`, `aud` claims (recency: 2022, source-type: vendor)
F-jwt-node-best-practices-3: https://nodejs.org/en/docs/guides/security — Use `jsonwebtoken` with `algorithms` option to prevent algorithm confusion attacks (recency: 2024, source-type: vendor)

### F-jwks-uri-rotation-* (web)
F-jwks-uri-rotation-1: https://www.rfc-editor.org/rfc/rfc7517 — JWKS URI enables hot-key-rotation without service restart (recency: 2015, source-type: RFC)

### F-rfc7519-exp-compliance-* (hybrid)
F-rfc7519-exp-compliance-1: src/services/token.ts:88 — Missing `exp` check; RFC 7519 §4.1.4 violation confirmed [conflicts-with-codebase]
F-rfc7519-exp-compliance-2: https://www.rfc-editor.org/rfc/rfc7519#section-4.1.4 — `exp` MUST be validated (recency: 2015, source-type: RFC) [web-only]

## Contradictions
F-jwt-current-impl-1 vs F-jwt-node-best-practices-1: current code uses HS256, OWASP recommends RS256 or ES256.

## Zero-Finding Dimensions
None.

## Best-Practice Synthesis
- F-jwt-node-best-practices-1: RECOMMENDATION — Switch from HS256 to RS256/ES256; add algorithm allow-list in `verifyToken`
- F-jwt-node-best-practices-2: RECOMMENDATION — Validate `exp`, `iss`, `aud` claims on every token decode
- F-jwt-node-best-practices-3: RECOMMENDATION — Pass `{ algorithms: ['RS256'] }` to `jsonwebtoken.verify()`
- F-jwks-uri-rotation-1: RECOMMENDATION — Consider JWKS URI endpoint for hot key rotation
- F-rfc7519-exp-compliance-2: RECOMMENDATION — Add explicit `exp` claim validation before any business logic
```
