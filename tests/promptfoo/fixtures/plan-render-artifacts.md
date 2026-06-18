# Sample Plan — G19 Render-Artifacts Gate (Fixes #470)

This fixture is a **code** plan. It carries three tasks for the G19 render-artifacts gate:
- **Task 1** — an HTTP-endpoint + status-enum task that RENDERS the required conventions: a success+error payload pair (artifact #1, AIP-193), a +/-/null field-diff with … elision (artifact #2, RFC 7386/6902), and a from→event→to state-transition table (artifact #5, Nygard). G19 must PASS it.
- **Task 2** — a renderable-surface task (adds an HTTP endpoint) that NARRATES the payload in prose, renders no fenced block or table. G19 must FLAG it (error-severity, blocking).
- **Task 3** — a docs-typo task that touches no renderable surface and renders nothing. G19 must NOT flag it (no artifact demanded).

---

# Org Status Plan

**Goal:** Add a PUT /orgs/{id} endpoint that updates an organisation's name and status, plus a typo fix in README.md.
**Architecture:** REST handler wired into the existing Express router; status field is a string enum.
**Source:** conversation context
**Verification:** npm test

---

### Task 1: PUT /orgs/{id} — update name and status

**Complexity:** Standard
**Risk:** Low
**Depends on:** none
**Verify:** tests

**Files:**
- Create: `src/routes/orgs.ts`
- Test: `tests/routes/orgs.test.ts`

**Description:**
Add a `PUT /orgs/{id}` route that accepts `{ name: string, status: "active" | "suspended" | "archived" }` and returns 204 on success or 400 on validation failure.

**Acceptance criteria:**
- [ ] Returns 204 and persists changes on valid input
- [ ] Returns 400 with a structured error body on invalid `status` value
- [ ] `status` transitions follow the allowed state machine (active → suspended → archived)

**Contract:**
- shape (code): `updateOrg(id: string, body: UpdateOrgBody): Promise<void>`; throws `OrgNotFoundError` | `InvalidStatusTransitionError`; reads from `process.env.DB_URL`.
- names: `updateOrg`, `UpdateOrgBody`, `OrgNotFoundError`, `InvalidStatusTransitionError`.
- mirror: existing route style at `src/routes/users.ts:1-50`.
- decisions: typed errors over boolean returns; status transitions validated in domain layer, not route handler.
- sync: `src/middleware/auth.ts` guards this route — no auth changes needed.

**Rendered artifacts:**

Request / response pair (artifact #1 — AIP-193 success+error):

```json
// PUT /orgs/{id} — 204 success (empty body)
// Request
{
  "name": "Acme Corp",
  "status": "suspended"
}
// Response: 204 No Content

// PUT /orgs/{id} — 400 validation error
// Response
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "Cannot transition from 'active' to 'archived' directly.",
    "status": 400
  }
}
```

Field diff for `UpdateOrgBody` (artifact #2 — RFC 7386/6902, +/-/null with … elision):

| Field    | Before          | After             | Notes                        |
|----------|-----------------|-------------------|------------------------------|
| `name`   | `"Acme"`        | `"Acme Corp"`     | + updated                    |
| `status` | `"active"`      | `"suspended"`     | + transitioned               |
| `id`     | `"org-123"`     | `"org-123"`       | null (unchanged, path param) |
| …        | …               | …                 | (other fields elided)        |

Status state-transition table (artifact #5 — Nygard from→event→to):

| From        | Event              | To           |
|-------------|--------------------|--------------|
| `active`    | suspend            | `suspended`  |
| `suspended` | reactivate         | `active`     |
| `suspended` | archive            | `archived`   |
| `active`    | ~~archive~~        | —            |

---

### Task 2: POST /orgs — create organisation (narrated only)

**Complexity:** Standard
**Risk:** Medium
**Depends on:** Task 1
**Verify:** tests

**Files:**
- Create: `src/routes/orgs-create.ts`
- Test: `tests/routes/orgs-create.test.ts`

**Description:**
Add a `POST /orgs` route that creates a new organisation. The route accepts a JSON body with a name field and an optional plan field (string enum: "free", "pro", "enterprise"). On success it returns 201 with the created org id. On missing name it returns 400. The plan field defaults to "free" if omitted.

**Acceptance criteria:**
- [ ] Returns 201 with `{ id: "..." }` on valid input
- [ ] Returns 400 when name is missing
- [ ] plan defaults to "free" when omitted

---

### Task 3: Fix typo in README.md

**Complexity:** Trivial
**Risk:** Low
**Depends on:** none
**Verify:** manual

**Files:**
- Modify: `README.md`

**Description:**
Fix the typo "organisaiton" → "organisation" in the project overview section of README.md.

**Acceptance criteria:**
- [ ] Typo corrected in README.md
