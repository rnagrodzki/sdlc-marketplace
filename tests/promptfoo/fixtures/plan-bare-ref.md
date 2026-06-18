# Sample Plan — Code Reference Anchoring (Fixes #472)

This fixture is a **code** plan. It exercises the "Code reference anchoring" convention (R51): a
bare `file:line` pointer is forbidden as a CHANGE reference (it must be anchored with surrounding
lines / full body + inline `-`/`+` diff), while a `Contract.mirror` line-anchor remains VALID as a
precedent pointer to existing structure being copied.

- **Task 1** — modifies `applyDiscount` in an existing module. It currently references the change
  site only as a bare `src/pricing/discount.ts:42` pointer (the violation the convention forbids),
  while its `Contract.mirror` carries a line-anchor `src/pricing/tax.ts:1-30` (the allowed carve-out:
  a precedent pointer, not a change ref). A correct render embeds the surrounding lines + an inline
  diff for the change, and leaves the mirror anchor untouched.

---

# Discount Validation Plan

## Deviations & assumptions

| Item | asked | does | why |
|---|---|---|---|
| Input validation | "fix the discount math" | adds range validation on the rate | a negative or >1 rate silently produced wrong totals |

**Goal:** Fix the discount calculation to reject out-of-range rates.
**Architecture:** Guard the rate at the top of the existing pure function; no new modules.
**Source:** conversation context
**Verification:** npm test

---

### Task 1: Validate discount rate in applyDiscount

**Complexity:** Standard
**Risk:** Low
**Depends on:** none
**Verify:** tests

**Files:**
- Modify: `src/pricing/discount.ts` — guard the rate and fix the multiplier
- Test: `tests/pricing/discount.test.ts`

**Notes:** the old formula multiplied by the rate instead of `(1 - rate)`, so every "10% off" charged 10% of total.

**Acceptance criteria:**
- [ ] Throws `RangeError` when rate is `< 0` or `> 1`
- [ ] Returns `total * (1 - rate)` for valid rates
- [ ] Existing callers unaffected for in-range rates

**Contract:**
- shape (code): `applyDiscount(order: Order, rate: number): number`; throws `RangeError` on out-of-range rate.
- names: `applyDiscount`.
- mirror: existing pure-pricing-function style at `src/pricing/tax.ts:1-30`.
- decisions: validate at function entry; keep the function pure.
- sync: `src/pricing/checkout.ts` calls `applyDiscount` — signature unchanged.

**Change reference:** the bug is at `src/pricing/discount.ts:42`.
