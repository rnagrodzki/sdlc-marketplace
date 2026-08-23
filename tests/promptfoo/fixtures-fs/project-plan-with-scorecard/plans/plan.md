# Fix something: Implementation Plan

**Goal:** Test goal — full valid plan with Verification Scorecard.
**Architecture:** Single helper module change.
**Source:** GitHub issue #998
**Verification:** node test

---

## Context

**What problem does this change solve?** The helper in `src/foo.js` returns the wrong output for one input case.

**What prompted this change now?** GitHub issue #998 reports the wrong output in production.

**What does success look like?** The helper returns the correct output for the reported case, with no change for other callers.

---

## Research Findings

`src/foo.js` is a small, single-purpose helper with no other callers in the codebase besides the path this issue reports on.

---

## Deviations & assumptions

| Item | asked | does | why |
|---|---|---|---|
| None | — | — | — |

---

## Key Decisions

- **Fix in place over rewrite:** The helper is small and correctly scoped; only the one faulty branch needs to change.

---

## Contract Examples

**Contract:**
- shape (code): `function doThing(input: string): string` — returns processed string
- names: `doThing`
- mirror: `src/foo.js`
- decisions: none
- sync: none

---

## Tasks

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

## Final Shape

`src/foo.js`'s helper returns the correct output for the previously-broken case. No other files or
callers change.

---

## OpenSpec Appendix

Not applicable — no OpenSpec change.

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
