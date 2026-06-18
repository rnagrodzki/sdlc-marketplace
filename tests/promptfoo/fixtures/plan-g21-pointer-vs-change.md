# Sample Plan — G21 Pointer-vs-Change-Ref Fixture

This fixture exercises the G21 self-contained code references gate. It distinguishes between two uses of `file:line` notation:

- **Task 1** — uses `src/pricing/discount.ts:42` as a **bare change site reference** with no surrounding context and no inline diff. G21 must **FLAG** Task 1.
- **Task 2** — uses `src/pricing/tax.ts:1-30` as a **`Contract.mirror` precedent pointer** (existing structure being copied, not changed). G21 must **PASS** Task 2 — pointer / mirror anchors are exempt.

---

# Pricing Module Plan

**Goal:** Apply a tiered discount to order totals and align tax calculation with the existing discount pattern.
**Architecture:** Domain service layer; pure functions.
**Source:** conversation context
**Verification:** npm test

---

## Deviations & assumptions

| Item | asked | does | why |
|------|-------|------|-----|
| Tiered discount | "add discount" | implements 3-tier table | supports future tier additions without code changes |

---

### Key Decisions

- KD1: Tiered discount implemented as a pure function; no side effects.
- KD2: Tax calculation mirrors existing discount module structure for consistency.

---

### Task 1: Apply tiered discount at src/pricing/discount.ts:42

**Complexity:** Standard
**Risk:** Medium
**Depends on:** none
**Verify:** tests

**Files:**
- Modify: `src/pricing/discount.ts`
- Test: `tests/pricing/discount.test.ts`

**Contract:**
- shape (code): `applyDiscount(total: number, tier: "bronze" | "silver" | "gold"): number`; throws `InvalidTierError`; pure function, no I/O.
- names: `applyDiscount`, `InvalidTierError`.
- decisions: KD1.

**Notes:**
Change the discount calculation at `src/pricing/discount.ts:42`.

**Acceptance criteria:**
- [ ] Bronze tier: 5% off; silver: 10% off; gold: 20% off
- [ ] `InvalidTierError` thrown for unrecognised tier strings

---

### Task 2: Add tax calculation mirroring discount module

**Complexity:** Standard
**Risk:** Low
**Depends on:** Task 1
**Verify:** tests

**Files:**
- Create: `src/pricing/tax.ts`
- Test: `tests/pricing/tax.test.ts`

**Contract:**
- shape (code): `calculateTax(subtotal: number, region: "EU" | "US" | "UK"): number`; throws `UnknownRegionError`; pure function, no I/O.
- names: `calculateTax`, `UnknownRegionError`.
- mirror: existing module structure at `src/pricing/tax.ts:1-30`.
- decisions: KD2.

**Acceptance criteria:**
- [ ] EU: 20% VAT; US: 8% sales tax; UK: 20% VAT
- [ ] `UnknownRegionError` thrown for unrecognised region strings
