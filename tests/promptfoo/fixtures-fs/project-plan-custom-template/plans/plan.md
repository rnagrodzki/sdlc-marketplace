# Add Rate Limiting Implementation Plan

**Goal:** Add per-IP rate limiting to the public API.
**Architecture:** Token-bucket limiter middleware in front of existing routes; counters stored in the existing Redis cache.
**Source:** conversation context
**Verification:** npm test

---

## Context

**What problem does this change solve?** A single client can flood the public API with requests, starving other tenants.

**What prompted this change now?** Incident #77: one client's retry loop degraded the API for everyone.

**What does success look like?** Requests from a single IP over the configured threshold get a 429 response; other clients are unaffected.

---

## Deviations & assumptions

| Item | asked | does | why |
|---|---|---|---|
| None | — | — | — |

---

## Key Decisions

- **Token bucket over fixed window:** Smooths bursts instead of resetting hard at a boundary, matching how the existing Redis cache client is already used elsewhere.

---

## Security Impact

Rate limit keys are derived from the client IP address only — no additional PII is stored. Limiter
state lives in the existing Redis cache with the same TTL policy as other ephemeral keys, so no new
retention obligations are introduced.

---

## Contract Examples

**Contract:**
- shape (code): `function checkRateLimit(ip: string): boolean` — returns true when the request is allowed
- names: `checkRateLimit`
- mirror: `src/cache/redisClient.ts:1-30`
- decisions: token bucket per Key Decisions
- sync: `src/middleware/rateLimit.ts` calls `checkRateLimit`

---

## Tasks

### Task 1: Add rate limit middleware

**Complexity:** Standard
**Risk:** Medium
**Depends on:** none
**Verify:** tests

**Files:**
- Create: `src/middleware/rateLimit.ts`
- Test: `tests/middleware/rateLimit.test.ts`

**Acceptance criteria:**
- [ ] Requests under the threshold pass through unchanged
- [ ] Requests over the threshold receive a 429 response
- [ ] Tests cover both cases

**Contract:**
- shape (code): `function checkRateLimit(ip: string): boolean` — returns true when the request is allowed
- names: `checkRateLimit`
- mirror: `src/cache/redisClient.ts:1-30`
- decisions: token bucket per Key Decisions
- sync: `src/middleware/rateLimit.ts` calls `checkRateLimit`

---

## Final Shape

Every public API request passes through a rate-limit check keyed on client IP before reaching its
handler. Clients over the threshold get a 429 response; the existing Redis cache tracks counts with no
new infrastructure.

---

## Verification Scorecard

*(Requirement traceability)*

### Requirement → Task traceability

| Surface | Requirement | Covered by |
|---|---|---|
| src/middleware/rateLimit.ts | Per-IP rate limiting | Task 1 |

### Quality dimensions

| Dimension | Verdict | Notes |
|---|---|---|
| Completeness | PASS | Task 1 covers the change |

**Verdict: Ready to execute.**
