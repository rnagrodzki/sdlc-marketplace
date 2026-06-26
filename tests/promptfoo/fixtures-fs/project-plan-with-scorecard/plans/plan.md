# Fix something: Implementation Plan

**Goal:** Test goal — full valid plan with Verification Scorecard.
**Architecture:** Single helper module change.
**Source:** GitHub issue #998
**Verification:** node test

---

## Deviations & assumptions

| Item | asked | does | why |
|---|---|---|---|
| None | — | — | — |

---

### Task 1: Do the thing

**Complexity:** Standard
**Risk:** Low
**Depends on:** —
**Verify:** manual

**Files:**
- Modify: `src/foo.js` — update the helper

**Acceptance criteria:**
- [ ] Helper updated

**Contract:**
- shape (code): `function doThing(input: string): string` — returns processed string
- names: `doThing`
- mirror: `src/foo.js`
- decisions: none
- sync: none

---

## Verification Scorecard

*(Requirement traceability)*

### Requirement → Task traceability

| Surface | Requirement | Covered by |
|---|---|---|
| src/foo.js | Helper updated | Task 1 |

### Quality dimensions

| Dimension | Verdict | Notes |
|---|---|---|
| Completeness | PASS | Task 1 covers the change |

**Verdict: Ready to execute.**
