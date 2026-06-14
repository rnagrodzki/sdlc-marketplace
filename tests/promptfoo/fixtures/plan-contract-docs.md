# Sample Docs / OpenSpec Plan — G18 Contract Settlement (Fixes #459)

This fixture is a **docs/openspec** plan. It carries two tasks for the G18 settlement gate:
- **Task 1** — a settled docs/openspec task whose `Contract:` pins a concrete shape (sections for the doc, requirement deltas for the spec). G18 must PASS it.
- **Task 2** — an unsettled "update X to do Y" task with NO `Contract:` block. G18 must FLAG it (error-severity, blocks).

The task plan type is derived from `Files:` paths: `docs/specs/**` → openspec/spec column; `docs/**` reference `*.md` → docs column.

---

# Token Lifecycle Documentation Plan

**Goal:** Document the token lifecycle and add the matching spec requirement.
**Architecture:** A new spec requirement plus a user-facing reference section.
**Source:** conversation context
**Verification:** manual

---

### Task 1: Spec + reference doc for token lifecycle

**Complexity:** Standard
**Risk:** Low
**Depends on:** none
**Verify:** manual

**Files:**
- Modify: `docs/specs/auth.md` — add the token-lifecycle requirement
- Modify: `docs/skills/auth.md` — add a Token Lifecycle reference section

**Description:**
Add a spec requirement codifying the three token states and a matching user-facing reference section.

**Acceptance criteria:**
- [ ] `docs/specs/auth.md` defines the new requirement with the three states
- [ ] `docs/skills/auth.md` documents the lifecycle for end users

**Contract:**
- shape (openspec): ADD requirement `R7` to `docs/specs/auth.md` under `## Core Requirements`; `R7` enumerates the three token states (active / refreshable / expired) and the transition rules; numbering continues from `R6`. ADD a `## Token Lifecycle` section to `docs/skills/auth.md` (audience: end users) after `## Usage`, with a bulleted list of the three states and a cross-link to `/version-sdlc`.
- names: `R7` (spec), `## Token Lifecycle` (doc heading).
- mirror: requirement-block style at `docs/specs/auth.md:21-22` (R5/R6); doc-section style at `docs/skills/auth.md:10-40` (`## Usage` / `## Flags`).
- decisions: numeric `R7` (not a named ID) — matches the file's existing numbering convention.
- sync: the doc's three-state list must match the `R7` state names byte-for-byte.

---

### Task 2: Update the auth doc to mention refresh

**Complexity:** Standard
**Risk:** Low
**Depends on:** none
**Verify:** manual

**Files:**
- Modify: `docs/skills/auth.md` — update it to cover refresh

**Description:**
Update `docs/skills/auth.md` so it covers the refresh behavior. Make the doc reflect the new flow.

**Acceptance criteria:**
- [ ] The doc mentions refresh
- [ ] The doc reads cleanly
