# Add Webhook Signing Implementation Plan

**Goal:** Sign every outbound webhook payload so receivers can verify authenticity.
**Architecture:** Add an HMAC-SHA256 signature header to the existing webhook delivery path; no new services.
**Source:** openspec/changes/add-webhook-signing/tasks.md
**Verification:** npm test

---

## Context

**What problem does this change solve?** Receivers cannot verify that a webhook came from us, so a forged request looks identical to a real one.

**What prompted this change now?** OpenSpec change `add-webhook-signing` requires signed payloads before the next partner integration ships.

**What does success look like?** Every outbound webhook carries an HMAC signature header, and unsigned inbound callbacks are rejected with a 401.

---

## Research Findings

Webhook delivery already retries on 5xx with exponential backoff (`src/billing/webhookRetry.ts:12-40`) — this plan reuses it rather than rebuilding it. No existing code validates webhook signatures, but Node's built-in `crypto` module covers the HMAC need without a new dependency.

---

## Deviations & assumptions

| Item | asked | does | why |
|---|---|---|---|
| None | — | — | — |

---

## Key Decisions

- **HMAC-SHA256 over a signed JWT:** Matches the OpenSpec change's stated payload format and avoids adding a JWT dependency for a single header.

---

## Contract Examples

**Contract:**
- shape (code): `function signPayload(payload: string, secret: string): string` — returns hex HMAC-SHA256 digest
- names: `signPayload`
- mirror: `src/billing/webhookRetry.ts:1-40`
- decisions: HMAC-SHA256 per Key Decisions
- sync: `src/billing/webhookSend.ts` calls `signPayload` before dispatch

---

## Tasks

### Task 1: Add payload signing helper

**Complexity:** Standard
**Risk:** Low
**Depends on:** none
**Verify:** tests

**Files:**
- Create: `src/billing/webhookSign.ts`
- Test: `tests/billing/webhookSign.test.ts`
- Modify: `src/billing/webhookSend.ts` — call `signPayload` before dispatch and attach the `X-Webhook-Signature` header

**Acceptance criteria:**
- [ ] `signPayload` returns a hex HMAC-SHA256 digest of the payload using the shared secret
- [ ] `webhookSend` attaches `X-Webhook-Signature` to every outbound request
- [ ] Tests cover a known payload/secret/digest triple

**Contract:**
- shape (code): `function signPayload(payload: string, secret: string): string` — returns hex HMAC-SHA256 digest
- names: `signPayload`
- mirror: `src/billing/webhookRetry.ts:1-40`
- decisions: HMAC-SHA256 per Key Decisions
- sync: `src/billing/webhookSend.ts` imports `signPayload`

---

## Final Shape

Every outbound webhook carries an `X-Webhook-Signature` header computed with HMAC-SHA256. Retry
behavior is unchanged — the existing exponential-backoff helper still owns delivery retries. No new
services or dependencies are introduced.

---

## Verification Scorecard

*(Requirement traceability)*

### Requirement → Task traceability

| Surface | Requirement | Covered by |
|---|---|---|
| src/billing/webhookSign.ts | Signed webhook payloads | Task 1 |

### Quality dimensions

| Dimension | Verdict | Notes |
|---|---|---|
| Completeness | PASS | Task 1 covers the change |

**Verdict: Ready to execute.**

---

## OpenSpec Appendix

**Requirement inventory** (`openspecContext.requirements[]`):

| reqId | capability | type | covering task(s) |
|---|---|---|---|
| R7 | webhook-signing | ADDED | Task 1 |

**Delta spec fragment** (`openspec/changes/add-webhook-signing/specs/billing/spec.md`):

```markdown
## ADDED Requirements
### Requirement: Signed webhook payloads
The system SHALL sign every outbound webhook payload with HMAC-SHA256.
```
