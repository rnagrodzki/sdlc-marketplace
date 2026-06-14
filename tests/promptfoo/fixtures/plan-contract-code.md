# Sample Code Plan — G18 Contract Settlement (Fixes #459)

This fixture is a non-OpenSpec **code** plan. It carries three tasks for the G18 settlement gate:
- **Task 1** — a settled code task whose `Contract:` pins a concrete shape (signatures, names). G18 must PASS it.
- **Task 2** — an unsettled "update X to do Y" task with NO `Contract:` block. G18 must FLAG it (error-severity, blocks).
- **Task 3** — a mixed-artifact task (touches a `.js` source file plus a `.md` prompt). Its dominant artifact is the `.js` file, so G18 judges it against the **code** column.

---

# Token Refresh Plan

**Goal:** Add a token-refresh helper and wire it into the auth middleware.
**Architecture:** A stateless refresh helper validated by the existing middleware.
**Source:** conversation context
**Verification:** npm test

---

### Task 1: Refresh-token helper

**Complexity:** Standard
**Risk:** Low
**Depends on:** none
**Verify:** tests

**Files:**
- Create: `src/auth/refresh.ts`
- Test: `tests/auth/refresh.test.ts`

**Description:**
Create a refresh-token helper that issues a new access token from a valid refresh token.

**Acceptance criteria:**
- [ ] `refreshAccessToken` returns a new signed access token on a valid refresh token
- [ ] Throws `RefreshExpiredError` when the refresh token is expired

**Contract:**
- shape (code): `refreshAccessToken(refreshToken: string): string`; throws `RefreshExpiredError` | `RefreshInvalidError`; reads secret from `process.env.JWT_SECRET`; imports `signToken` from `../utils/jwt`.
- names: `refreshAccessToken`, `RefreshExpiredError`, `RefreshInvalidError`.
- mirror: existing helper style at `src/utils/jwt.ts:1-40`.
- decisions: typed errors over boolean returns (callers branch on error class).
- sync: `src/middleware/auth.ts` will import `refreshAccessToken` — signature must match.

---

### Task 2: Update the auth middleware to support refresh

**Complexity:** Standard
**Risk:** Medium
**Depends on:** Task 1
**Verify:** tests

**Files:**
- Modify: `src/middleware/auth.ts` — update it to handle refresh

**Description:**
Update `src/middleware/auth.ts` to do the refresh handling. Make it work with the new helper.

**Acceptance criteria:**
- [ ] The middleware handles refresh tokens
- [ ] Existing tests still pass

---

### Task 3: Refresh helper plus error-copy prompt

**Complexity:** Standard
**Risk:** Low
**Depends on:** Task 1
**Verify:** tests

**Files:**
- Modify: `src/auth/errors.ts` — add the refresh error messages
- Modify: `prompts/auth-error-copy.md` — list the new error strings

**Description:**
Add the refresh error messages to the error module and mirror the user-facing strings into the copy prompt. The primary deliverable is the `.ts` error module; the `.md` is a downstream mirror.

**Acceptance criteria:**
- [ ] `errors.ts` exports `REFRESH_EXPIRED_MESSAGE` and `REFRESH_INVALID_MESSAGE`
- [ ] The copy prompt lists both strings verbatim

**Contract:**
- shape (code): ADD two string constants to `src/auth/errors.ts` — `REFRESH_EXPIRED_MESSAGE = 'Your session expired. Sign in again.'` and `REFRESH_INVALID_MESSAGE = 'Could not refresh your session.'`; both exported named.
- names: `REFRESH_EXPIRED_MESSAGE`, `REFRESH_INVALID_MESSAGE`.
- mirror: existing constant style at `src/auth/errors.ts:1-20`.
- decisions: user-facing copy lives in the `.ts` source of truth; the `.md` prompt mirrors it byte-for-byte.
- sync: `prompts/auth-error-copy.md` lists both message strings verbatim.
