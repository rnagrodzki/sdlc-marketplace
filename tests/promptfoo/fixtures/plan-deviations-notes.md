# Sample Plan — Deviations section + Notes rationale-only (Fixes #472)

This fixture is a **code** plan. It exercises R47 (top-of-plan `## Deviations & assumptions`
section, columns Item | asked | does | why) and R48/G20 (the per-task `Notes:` field is
optional and rationale-only; G20 flags a `Notes:` block that restates the Contract/acceptance).

- **Task 1** — carries a `Notes:` block with ONLY rationale (why a queue was chosen). G20 must
  PASS it.
- **Task 2** — carries a `Notes:` block that RESTATES its Contract/acceptance (re-lists the
  function signature and the acceptance bullets) instead of carrying rationale. G20 must FLAG
  it (error-severity, blocking).

---

# Notification Dispatch Plan

**Goal:** Add a notification dispatcher that sends emails through a background queue.
**Architecture:** Producer enqueues jobs; a worker drains the queue and calls the email provider.
**Source:** conversation context
**Verification:** npm test

---

## Deviations & assumptions

| Item | asked | does | why |
|---|---|---|---|
| background queue | "send notifications" | dispatches via a background queue, not inline | provider rate limits make synchronous sends unreliable |
| retry policy | (not specified) | retries failed sends 3× with backoff | implied by "reliable delivery" success criterion |

---

### Task 1: Notification queue producer

**Complexity:** Standard
**Risk:** Low
**Depends on:** none
**Verify:** tests

**Files:**
- Create: `src/notify/producer.ts`
- Test: `tests/notify/producer.test.ts`

**Notes:** (optional — rationale only, ≤5 lines; the "what" lives in Files/Contract/Acceptance)
A queue decouples request latency from provider latency; chosen over inline sends because the
provider rate-limits bursts and synchronous calls would block the request thread.

**Acceptance criteria:**
- [ ] Enqueues one job per recipient
- [ ] Rejects an empty recipient list with `EmptyRecipientsError`

**Contract:**
- shape (code): `enqueueNotification(job: NotifyJob): Promise<void>`; throws `EmptyRecipientsError`.
- names: `enqueueNotification`, `NotifyJob`, `EmptyRecipientsError`.
- mirror: existing producer style at `src/queue/job-producer.ts:1-40`.
- decisions: producer validates recipients; worker owns retry policy.
- sync: `NotifyJob` shape with Task 2.

---

### Task 2: Notification queue worker (Notes restates Contract)

**Complexity:** Standard
**Risk:** Medium
**Depends on:** Task 1
**Verify:** tests

**Files:**
- Create: `src/notify/worker.ts`
- Test: `tests/notify/worker.test.ts`

**Notes:** (optional — rationale only, ≤5 lines; the "what" lives in Files/Contract/Acceptance)
Implements `drainQueue(job: NotifyJob): Promise<void>` which throws `ProviderError`. It enqueues
one job per recipient and rejects an empty recipient list. Returns void on success and retries
failed sends three times.

**Acceptance criteria:**
- [ ] Drains all queued jobs
- [ ] Retries a failed send 3× before dead-lettering

**Contract:**
- shape (code): `drainQueue(job: NotifyJob): Promise<void>`; throws `ProviderError`.
- names: `drainQueue`, `ProviderError`.
- mirror: existing worker style at `src/queue/job-worker.ts:1-50`.
- decisions: worker owns retry + dead-letter; producer does not retry.
- sync: `NotifyJob` shape with Task 1.
