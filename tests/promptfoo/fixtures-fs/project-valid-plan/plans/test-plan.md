# Test Feature Implementation Plan

**Goal:** Add a test feature to validate plan format checking.
**Architecture:** Simple module with two files and standard test coverage.
**Source:** conversation context
**Verification:** npm test

---

## Key Decisions

- **Standalone module over extending existing:** Keeps the scope small and testable.

---

### Task 1: Create utility module

**Complexity:** Standard
**Risk:** Low
**Depends on:** none
**Verify:** tests

**Files:**
- Create: `src/utils/helper.js`
- Test: `tests/utils/helper.test.js`

**Description:**
Create a utility module that exports a `formatDate(date)` function. It should accept a Date object and return an ISO 8601 formatted string. Handle null/undefined input by returning null.

**Acceptance criteria:**
- [ ] `formatDate` returns ISO string for valid Date
- [ ] `formatDate` returns null for null/undefined input
- [ ] Tests cover both cases

---

### Task 2: Create API endpoint

**Complexity:** Standard
**Risk:** Medium
**Depends on:** Task 1
**Verify:** tests, build

**Files:**
- Create: `src/routes/dates.js`
- Modify: `src/routes/index.js` — add dates route import

**Description:**
Create a GET `/api/dates/now` endpoint that returns the current date using the `formatDate` utility from Task 1. Response format: `{ date: "<iso-string>" }`.

**Acceptance criteria:**
- [ ] GET /api/dates/now returns 200 with JSON body
- [ ] Response contains `date` field with ISO string
- [ ] Uses formatDate from Task 1

---

### Task 3: Add documentation

**Complexity:** Trivial
**Risk:** Low
**Depends on:** Task 2
**Verify:** manual

**Files:**
- Modify: `README.md` — add API endpoint documentation

**Description:**
Add a section to the README documenting the new `/api/dates/now` endpoint, including example request and response.

**Acceptance criteria:**
- [ ] README contains endpoint documentation
- [ ] Example request and response included
