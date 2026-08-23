# Appendix Heading Injection Implementation Plan

**Goal:** Test goal — validates that fenced example content does not corrupt task extraction.
**Architecture:** Single real task; the plan's appendix documents a worked example that itself contains a `### Task` heading and a nested triple-backtick code fence.
**Source:** openspec/changes/example-change/tasks.md
**Verification:** node test

---

## Deviations & assumptions

| Item | asked | does | why |
|---|---|---|---|
| None | — | — | — |

---

### Task 1: Do the real thing

**Complexity:** Standard
**Risk:** Low
**Depends on:** none
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

## Appendix

Example of how a task block should look when authoring future plans against this template —
reproduced verbatim, including its own nested code fence, so authors can see the target shape without
opening another file. This example is documentation only; it is not a real task, and the fence below
must not be counted as one.

````markdown
### Task 1: Example placeholder task (not a real task — documentation only)

**Complexity:** Trivial
**Risk:** Low
**Depends on:** none
**Verify:** manual

**Files:**
- Create: `example/placeholder.js`

**Acceptance criteria:**
- [ ] Placeholder criterion

```json
{ "example": true, "note": "nested triple-backtick fence inside a 4-backtick fence" }
```
````
