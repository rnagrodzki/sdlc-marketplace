# Plan Document Format Reference

Canonical format for implementation plans produced by `plan-sdlc` and consumed by `execute-plan-sdlc`. Both skills reference this document.

---

## Document Header (required)

Every plan document must begin with this header:

```markdown
# [Feature Name] Implementation Plan

**Goal:** [One sentence describing what this plan implements]
**Architecture:** [2–3 sentences about the overall approach and key design decisions]
**Source:** [Spec file path, or "conversation context" if no file]
**Verification:** [Primary verification command — e.g., "npm test", "go test ./...", "make test"]

---
```

All four fields are required. `execute-plan-sdlc` uses `Verification` as the default test command.

## Key Decisions (optional)

Capture architecture and design decisions made during planning that executing agents need to understand. Place this section between the document header and the first task block.

```markdown
## Key Decisions

- **[Choice A] over [Choice B]:** [Why — reference codebase patterns or constraints, not preference]
- **[Choice C] over [Choice D]:** [Why]
```

**What to include:**
- Choices where a reasonable implementer might choose differently without context
- Decisions backed by codebase evidence (e.g., "existing modules use pattern X in Y")
- Architecture decisions that affect multiple tasks

**What to skip:**
- Obvious decisions where only one reasonable option existed
- Stylistic preferences with no execution impact

Recommended for plans with 5+ tasks. Omit for simple plans. The Key Decisions section is free-text — `execute-plan-sdlc` does not parse it, but agents receive it as context alongside task descriptions.

---

## Guardrail Compliance (optional)

Present when `plan.guardrails` are configured in `.sdlc/config.json`. Produced by plan-sdlc Step 4.
`execute-plan-sdlc` does not parse this section — it documents constraint evaluation for reviewers.

```markdown
## Guardrail Compliance

| Guardrail | Severity | Status | Rationale |
|---|---|---|---|
| no-direct-db-access | error | PASS | No tasks modify database schema files |
| prefer-composition | warning | PASS | No class hierarchies proposed |
```

---

## Per-Task Block (required for every task)

```markdown
### Task N: [Component Name]

**Complexity:** Trivial | Standard | Complex
**Risk:** Low | Medium | High
**Depends on:** Task X, Task Y (or "none")
**Verify:** tests | build | lint | manual

**Files:**
- Create: `exact/relative/path/to/file.ts`
- Modify: `exact/relative/path/to/existing.ts` — [one line: what changes]
- Test: `tests/exact/relative/path/to/test.ts`

**Description:**
[Full description of what to implement: what to build, how it connects to existing code,
expected behavior, edge cases to handle. Include code snippets for non-obvious patterns.
Complete enough that an agent with no codebase context can execute it.]

**Acceptance criteria:**
- [ ] [Specific, verifiable criterion]
- [ ] [Another criterion]

**Contract:** (required for every artifact-touching task — the decided shape execution renders verbatim)
- shape (<code|docs|openspec>): [the type-aware decided shape — see the per-type column guidance below]
- names: [exact symbols / IDs / headings / fields this deliverable introduces or touches]
- mirror: [the existing artifact this mirrors, with line anchors — the source of truth to copy structure from]
- decisions: [per-task decided choices bound to this deliverable; cite `## Key Decisions` where relevant]
- sync: [sibling artifacts that must stay byte-consistent with this deliverable]

**openspec-task:** (optional — present only when plan was generated with `--from-openspec`)
- change: <change-name>
- ref: <kebab-slug-6char-hash>
- line: <1-indexed-line-number-at-plan-time>
- title: <verbatim-task-title-at-plan-time>
```

---

## The `Contract:` block

Every artifact-touching task carries a `**Contract:**` block: a bold-label header line followed by
an indented `- key: value` list, mirroring the `**openspec-task:**` sub-block precedent above. It
pins the **decided shape** of the deliverable so execution renders it verbatim rather than
re-deriving (or stalling BLOCKED on) a design decision planning already closed. The G18 settlement
gate flags any artifact-touching task whose Contract is absent or merely restates "update X to do Y".

Keys: `shape`, `names`, `mirror`, `decisions`, `sync`.

`shape` is **type-aware** — the plan type is derived from the task's `Files:` paths, and the decided
shape follows that type's column:

| Plan type | `Files:` signal | `shape` pins |
|---|---|---|
| **code** | source files (`.js`/`.ts`/etc.), `SKILL.md` | signatures / types / flags / error-cases / import-paths |
| **docs** | `docs/**`, reference `*.md` | template + section list + audience + cross-links |
| **openspec** (spec) | `docs/specs/**`, `openspec/**` | requirement IDs ADD/MODIFY/REMOVE + delta text + numbering + downstream obligations |

A mixed-artifact task (e.g. a `.js` change plus a `.md` prompt) is judged against its **dominant**
artifact's column — the one its primary deliverable touches.

### Worked example — code

```markdown
**Contract:**
- shape (code): `signToken(payload: object, expiresIn: string): string` and
  `verifyToken(token: string): object`; throws `JwtExpiredError` | `JwtInvalidError` on failure;
  import `jsonwebtoken`; secret from `process.env.JWT_SECRET`.
- names: `signToken`, `verifyToken`, `JwtExpiredError`, `JwtInvalidError`.
- mirror: existing util module style at `src/utils/hash.ts:1-40`.
- decisions: typed errors over boolean returns (callers branch on error class).
- sync: `src/middleware/auth.ts` imports `verifyToken` — signature must match.
```

### Worked example — docs

```markdown
**Contract:**
- shape (docs): MODIFY `docs/skills/auth.md`. Add a `## Token Lifecycle` section (audience: end
  users) after `## Usage`; bullet list of the 3 token states; cross-link to `/version-sdlc`.
- names: section heading `## Token Lifecycle`.
- mirror: the `## Usage` / `## Flags` section style at `docs/skills/auth.md:10-40`.
- decisions: user-facing prose only — no internal API references.
- sync: must match the field names introduced in the format reference (`Contract:` keys).
```

### Worked example — openspec / spec

```markdown
**Contract:**
- shape (openspec): ADD requirement `R7` to `docs/specs/auth.md` under `## Core Requirements`;
  MODIFY `R3`'s acceptance clause to cite the new token-state enum; delta text exactly as in the
  Description; numbering continues from `R6`.
- names: `R7` (new), `R3` (modified).
- mirror: requirement-block style at `docs/specs/auth.md:21-22` (R5/R6).
- decisions: numeric `R7` (not a named ID) — matches the file's existing numbering convention.
- sync: SKILL.md Step 2 authors it; execute-plan-sdlc consumes it via the fact sheet.
```

---

## Out-of-scope OpenSpec tasks (optional)

Present only when `--from-openspec` was used AND at least one OpenSpec task has no plan
coverage. Documents intentional exclusions so the G16 coverage gate passes and the archive
gate (R38) does not suppress the suggestion at execute time.

Format:
- <verbatim OpenSpec task title> — <one-line rationale>

---

## Field Value Constraints

| Field | Allowed Values | Notes |
|---|---|---|
| Complexity | `Trivial` \| `Standard` \| `Complex` | Used by execute-plan-sdlc for model assignment and wave building |
| Risk | `Low` \| `Medium` \| `High` | High-risk tasks trigger a user confirmation gate before execution |
| Depends on | `Task N, Task M` or `none` | Must reference tasks by their exact number; no forward references |
| Verify | `tests` \| `build` \| `lint` \| `manual` | Multiple allowed: `tests, build` |
| Contract | Indented `- key: value` list with keys `shape`, `names`, `mirror`, `decisions`, `sync` | Required for every artifact-touching task; `shape` is type-aware (code/docs/openspec column derived from `Files:` paths); judged by G18 |
| Files → Create | Relative path from project root | Must be exact — agents use this to know what to create |
| Files → Modify | Relative path + one-line description of change | Required if an existing file is modified |
| Files → Test | Relative path from project root | Omit row if task has no tests |
| openspec-task → change | String | OpenSpec change directory name |
| openspec-task → ref | kebab-slug + 6-char sha256 suffix | Computed from task title at plan time |
| openspec-task → line | Integer ≥ 1 | 1-indexed line in tasks.md at plan time |
| openspec-task → title | String | Verbatim task title at plan time |

---

## Example Plan

```markdown
# User Authentication Implementation Plan

**Goal:** Add JWT-based authentication to the API server.
**Architecture:** Stateless JWT tokens validated by middleware; user records in the existing database; no session storage.
**Source:** docs/specs/auth-spec.md
**Verification:** npm test

---

### Task 1: JWT utility module

**Complexity:** Standard
**Risk:** Low
**Depends on:** none
**Verify:** tests

**Files:**
- Create: `src/utils/jwt.ts`
- Test: `tests/utils/jwt.test.ts`

**Description:**
Create a JWT utility module that exports `signToken(payload, expiresIn)` and `verifyToken(token)`.
Use the `jsonwebtoken` npm package (already installed). Sign with `process.env.JWT_SECRET`.
`verifyToken` should throw a typed error (`JwtExpiredError` | `JwtInvalidError`) on failure.

**Acceptance criteria:**
- [ ] `signToken` returns a JWT string with the given payload
- [ ] `verifyToken` returns the decoded payload on valid tokens
- [ ] `verifyToken` throws `JwtExpiredError` on expired tokens
- [ ] `verifyToken` throws `JwtInvalidError` on malformed tokens
- [ ] Tests cover all four cases: sign, verify success, verify expired, verify invalid

---

### Task 2: Auth middleware

**Complexity:** Standard
**Risk:** Medium
**Depends on:** Task 1
**Verify:** tests

**Files:**
- Create: `src/middleware/auth.ts`
- Test: `tests/middleware/auth.test.ts`

**Description:**
Create Express middleware that reads the `Authorization: Bearer <token>` header,
calls `verifyToken` from Task 1, and attaches the decoded payload to `req.user`.
On missing or invalid token, respond with `401 { error: "Unauthorized" }`.
Import path: `import { verifyToken } from '../utils/jwt'`.

**Acceptance criteria:**
- [ ] Valid token: attaches decoded payload to `req.user` and calls `next()`
- [ ] Missing header: responds 401 with `{ error: "Unauthorized" }`
- [ ] Invalid/expired token: responds 401 with `{ error: "Unauthorized" }`
- [ ] Tests cover all three cases
```

---

## What NOT to Include in Plans

- Full implementation code (code snippets for patterns are fine; complete implementations are not).
  Exception: a task's `Contract.shape` pins signatures / sections / requirement deltas — not full
  bodies. A concrete Contract shape is the decided interface, not an implementation, and is NOT
  flagged by this rule.
- Absolute file paths (always use paths relative to project root)
- Superpowers-specific directives or REQUIRED SUB-SKILL headers
- References to tools or skills the executing agent should use
- Tasks with fewer than 2 acceptance criteria (not specific enough)
- Tasks that touch more than 5 files (split them)
