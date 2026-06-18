# Sample Plan — Per-Distinct-Shape Render Cap (Fixes #472)

This fixture is a **code** plan. It exercises the per-distinct-shape render rule (R49, catalog
#2/#3): when a task touches MULTIPLE distinct events / endpoints / operations whose contract shapes
differ, each distinct shape renders its OWN record — the cap is one elided example per distinct
contract shape, not one shared example for the whole task.

- **Task 1** — a webhook dispatcher that emits THREE distinct events (`order.created`,
  `order.refunded`, `order.cancelled`), each with a different payload shape. Per the catalog #2/#3
  rule, each distinct event must render its own field-diff / before→after record. Rendering only one
  shared example would under-specify the other two distinct shapes.

---

# Webhook Event Dispatcher Plan

## Deviations & assumptions

| Item | asked | does | why |
|---|---|---|---|
| Event fan-out | "emit order webhooks" | emits three distinct event types | each lifecycle transition carries a different payload contract |

**Goal:** Add a webhook dispatcher that emits order lifecycle events to subscriber endpoints.
**Architecture:** Outbox-pattern dispatcher reading committed order events; one HTTP POST per subscriber per event.
**Source:** conversation context
**Verification:** npm test

---

### Task 1: Order lifecycle webhook dispatcher

**Complexity:** Complex
**Risk:** Medium
**Depends on:** none
**Verify:** tests

**Files:**
- Create: `src/webhooks/dispatch.ts`
- Test: `tests/webhooks/dispatch.test.ts`

**Notes:** outbox pattern chosen over inline POST so delivery failures cannot roll back the order write.

**Acceptance criteria:**
- [ ] Emits `order.created` with the full order body on creation
- [ ] Emits `order.refunded` with refund amount and reason on refund
- [ ] Emits `order.cancelled` with cancellation reason on cancel
- [ ] Each event POSTs once per subscriber and records delivery status

**Contract:**
- shape (code): `dispatch(event: OrderEvent, subscribers: Subscriber[]): Promise<DeliveryResult[]>`; events are `order.created` | `order.refunded` | `order.cancelled`, each a distinct payload contract.
- names: `dispatch`, `OrderEvent`, `Subscriber`, `DeliveryResult`.
- mirror: existing dispatcher style at `src/webhooks/legacy-dispatch.ts:1-60`.
- decisions: one POST per subscriber per event; at-least-once delivery.
- sync: `src/webhooks/subscribe.ts` registers subscribers — shape must match.

**Rendered artifacts:**

`order.created` event record (distinct shape #1):

```
{ "type": "order.created", "orderId": "o_1", "total": 4200, "currency": "USD", "items": [ … ] }
```

`order.refunded` event record (distinct shape #2):

```
{ "type": "order.refunded", "orderId": "o_1", "refundAmount": 4200, "reason": "customer_request", … }
```

`order.cancelled` event record (distinct shape #3):

```
{ "type": "order.cancelled", "orderId": "o_1", "reason": "fraud_hold", "cancelledBy": "u_9", … }
```
