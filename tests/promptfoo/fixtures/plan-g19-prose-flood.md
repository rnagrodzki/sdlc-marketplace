# Sample Plan — G19 Per-Surface Render Gate (Fixes #488)

This fixture is a **code** plan. It carries one task that trips the NEW per-surface G19
rule: the task touches TWO render-trigger surfaces — an HTTP request/response payload
(catalog #1) and a config/env-flag delta (catalog #7) — but only renders ONE of them.

- **Task 1** — adds a `PATCH /jobs/{id}/priority` endpoint AND a new
  `MAX_PRIORITY_QUEUE_DEPTH` env var. The env var's config delta IS rendered as a
  typed-op table (artifact #7, RFC 6902) — an incidental render for a surface UNRELATED
  to the endpoint. The endpoint's request/response payload (artifact #1, AIP-193) is
  described ENTIRELY in prose in the Description field — no fenced block, no table, no
  before→after diff for that surface anywhere in the task.
  Under the OLD binary G19 (any render anywhere in the task body satisfies the gate),
  this task would PASS because it does render *something* (the env var table). Under the
  NEW per-surface G19, the un-rendered payload surface must still be flagged — a render
  for one surface does NOT excuse prose for another surface in the same task. G19 must
  FLAG Task 1 for the un-rendered HTTP payload surface (error-severity, blocking).

---

# Job Priority Plan

**Goal:** Add a PATCH /jobs/{id}/priority endpoint that updates a job's priority, plus a new env var that caps queue depth for priority processing.
**Architecture:** REST handler wired into the existing Express router; priority is an integer 1-10; queue depth capped via a new env var read at startup.
**Source:** conversation context
**Verification:** npm test

---

### Task 1: PATCH /jobs/{id}/priority — update priority + add MAX_PRIORITY_QUEUE_DEPTH env var

**Complexity:** Standard
**Risk:** Medium
**Depends on:** none
**Verify:** tests

**Files:**
- Create: `src/routes/jobs-priority.ts`
- Modify: `src/config/env.ts`
- Test: `tests/routes/jobs-priority.test.ts`

**Description:**
Add a `PATCH /jobs/{id}/priority` route. The route accepts a JSON body with a single
`priority` field, an integer between 1 and 10 inclusive. On success it returns 200 with
the updated job record, containing the job's `id`, its new `priority`, and an
`updatedAt` timestamp. When `priority` is missing, non-numeric, or outside the 1-10
range, the route returns 422 with a structured error body containing the field name
that failed validation and a human-readable message. The handler also reads a new
environment variable, `MAX_PRIORITY_QUEUE_DEPTH`, at startup to cap how many jobs may
sit in the priority queue simultaneously.

**Acceptance criteria:**
- [ ] Returns 200 with the updated job record on valid input
- [ ] Returns 422 with a structured error body on invalid `priority`
- [ ] `MAX_PRIORITY_QUEUE_DEPTH` is read once at startup with a default of `50`

**Contract:**
- shape (code): `updateJobPriority(id: string, body: UpdatePriorityBody): Promise<Job>`; throws `JobNotFoundError` | `InvalidPriorityError`; reads from `process.env.MAX_PRIORITY_QUEUE_DEPTH`.
- names: `updateJobPriority`, `UpdatePriorityBody`, `JobNotFoundError`, `InvalidPriorityError`, `MAX_PRIORITY_QUEUE_DEPTH`.
- mirror: existing route style at `src/routes/orgs.ts:1-50`.
- decisions: typed errors over boolean returns; env var read once at module load, not per-request.
- sync: `src/config/env.ts` — new env var must be documented alongside existing `DB_URL`/`LOG_LEVEL` entries.

**Rendered artifacts:**

`MAX_PRIORITY_QUEUE_DEPTH` config delta (artifact #7 — RFC 6902 typed-op table):

| Op  | Key                         | Type    | Value | Notes                                     |
|-----|------------------------------|---------|-------|---------------------------------------------|
| add | `MAX_PRIORITY_QUEUE_DEPTH`   | integer | `50`  | Default cap; overridable per environment    |
