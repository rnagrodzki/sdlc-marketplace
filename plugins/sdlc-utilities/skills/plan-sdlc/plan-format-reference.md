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

## Deviations & assumptions (required)

Every plan must carry a top-of-plan `## Deviations & assumptions` section, placed immediately after
the document header (before `## Key Decisions`). It records each way the plan diverges from, or
assumes beyond, the literal request — so reviewers can audit intent without reconstructing it.

```markdown
## Deviations & assumptions

| Item | asked | does | why |
|---|---|---|---|
| Notification delivery | "send notifications" | dispatches via a background queue | decouples request latency from delivery; mirrors existing worker pattern |
| Retry policy | (not specified) | adds 3-attempt exponential backoff | transient broker failures must not drop messages |
```

The columns are `Item | asked | does | why`. When a plan introduces no divergences or assumptions,
render the header with a single row stating "none". The section is required on every plan.

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

**Notes:** (optional — rationale only, ≤5 lines; the "what" lives in Files/Contract/Acceptance)
[Why this is built the way it is — non-obvious constraints, trade-offs, or context an agent needs
to make the right call. Omit when the Files/Contract/Acceptance triple already says everything.
Do NOT restate signatures, sections, or acceptance bullets here — that is the Contract's job, and
concrete artifacts are rendered per `## Concrete Artifacts (render don't narrate)`.]

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
  MODIFY `R3`'s acceptance clause to cite the new token-state enum; delta text pinned in this
  Contract `shape`; numbering continues from `R6`.
- names: `R7` (new), `R3` (modified).
- mirror: requirement-block style at `docs/specs/auth.md:21-22` (R5/R6).
- decisions: numeric `R7` (not a named ID) — matches the file's existing numbering convention.
- sync: SKILL.md Step 2 authors it; execute-plan-sdlc consumes it via the fact sheet.
```

---

## Concrete Artifacts (render don't narrate)

### Principle

When a task has a concrete artifact — a payload shape, a field delta, a state transition, a config
change — **show it** as a fenced block, table, or before→after diff. Prose is for rationale only.
Reviewers should be able to verify correctness by reading the artifact directly, not by reconstructing
it from a description.

### Surface-Conditional Trigger Table

Render an artifact only when the task surface matches the trigger. Size-conditional: trivial
docs/rename tasks with no structural change render nothing.

| # | Artifact | Trigger (task surface) | Render-as (sourced convention) |
|---|---|---|---|
| 1 | API request/response payload | Adds/changes HTTP endpoint or consumes external API | HTTP/JSON, success + error paired (AIP-193) |
| 2 | Data structure w/ marked field changes | Adds/modifies struct / schema / DTO / table item | Field-diff: `+`add `−`remove, `null`=remove, `…` elide unchanged (RFC 7386/6902); every distinct event/endpoint/operation renders its own record |
| 3 | Operation end-state / outcome | Data-writing operation | Before→after record in the data's own shape (RFC 7386); every distinct event/endpoint/operation renders its own record |
| 4 | Workflow now→after | Changes an existing flow | 2-col now→after table (text) or Mermaid `flowchart`/`sequenceDiagram`/`stateDiagram` — house-style |
| 5 | State-transition table | Adds/changes a status enum / state machine | Transition table: from → event → to (Nygard ADR) or Mermaid `flowchart`/`sequenceDiagram`/`stateDiagram` |
| 6 | Call-order | Multi-component interaction | Numbered call-order list (caller → callee → effect) or Mermaid `flowchart`/`sequenceDiagram`/`stateDiagram` — house-style |
| 7 | Config / flag / env delta | Adds env var / feature flag / default | Typed-op table: add/replace/remove (RFC 6902) |
| 8 | Error / failure-mode | Non-trivial unhappy path | Canonical error table: condition → status/code/behaviour (AIP-193) |

### Rendering Conventions

One elided example per distinct contract shape (not per surface category). Scale verbosity to change size.

**#1 — API payload (RFC 7386 / AIP-193): success + error paired**

```http
POST /v1/tokens
{ "userId": "u_42", "expiresIn": "1h" }

200 OK
{ "token": "eyJ…", "expiresAt": "2026-06-17T12:00:00Z" }

400 Bad Request
{ "error": { "code": 400, "status": "INVALID_ARGUMENT",
             "message": "expiresIn must be a duration string" } }
```

**#2 — Field-diff (RFC 7386 / RFC 6902): `+`add `−`remove, `null`=remove, `…` elide unchanged**

```diff
  { "id": 7,
+   "status": "active",     # added member
-   "legacyFlag": true,     # removed (null per RFC 7386 also removes)
    … }                     # unchanged members elided (Google Design Docs)
```

**#3 — Before→after end-state (RFC 7386): original then modified record in the data's own shape**

```
Before:  { "id": 12, "status": "pending", "retries": 0, … }
After:   { "id": 12, "status": "active",  "retries": 0, … }
```

**#4 — Workflow now→after (house-style): 2-column table**

| Now | After |
|---|---|
| Request → Auth middleware → Handler | Request → Rate-limit → Auth middleware → Handler |
| … | … |

**#5 — State-transition table (Nygard ADR): from → event → to**

| From | Event | To |
|---|---|---|
| `pending` | payment confirmed | `active` |
| `active` | manual cancel | `cancelled` |
| … | … | … |

**#6 — Call-order (house-style): numbered list, text or Mermaid**

```
1. Client → POST /v1/tokens → TokenService
2. TokenService → validate(payload) → Validator (returns ok | ValidationError)
3. TokenService → sign(payload) → JwtUtil (returns token string)
…
```

**#7 — Config/flag/env delta (RFC 6902): typed ops add/replace/remove**

| Op | Key | Type | Value | Notes |
|---|---|---|---|---|
| add | `RATE_LIMIT_MAX` | integer | `100` | Requests per minute per IP |
| replace | `LOG_LEVEL` | string | `"info"` | Was `"debug"` |
| … | … | … | … | … |

**#8 — Error/failure-mode (AIP-193): condition → status/code/behaviour**

| Condition | HTTP status | Code | Behaviour |
|---|---|---|---|
| Token expired | 401 | `UNAUTHENTICATED` | Refresh flow triggered |
| Token malformed | 401 | `UNAUTHENTICATED` | Request rejected, no refresh |
| … | … | … | … |

### Size Cap and Anti-Bloat

- One elided example per distinct contract shape (not per surface category) (use `…` to elide unchanged members, rows, or steps).
- Scale verbosity to change size: a one-field addition needs one diff line, not a full schema dump.
- Trivial docs or rename tasks with no structural change: render nothing.
- Over-detailing belongs in code review, not in the plan (Cvet: the #1 RFC failure mode).

### References

- RFC 7386 — JSON Merge Patch: <https://datatracker.ietf.org/doc/html/rfc7386>
- RFC 6902 — JSON Patch: <https://datatracker.ietf.org/doc/html/rfc6902>
- AIP-193 — Errors: <https://google.aip.dev/193>
- Google Design Docs: <https://www.industrialempathy.com/posts/design-docs-at-google/>
- Rust RFC template: <https://github.com/rust-lang/rfcs/blob/master/0000-template.md>
- Nygard ADR: <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions>

### Code reference anchoring

A bare `file:line` pointer is forbidden as a **change reference** — it forces the reader to open the
file and is silently invalidated the moment surrounding lines shift. When a task references code it
will change, anchor it self-contained: embed the surrounding lines (or the full function body) and
show the edit as an inline `-`/`+` diff so the change is reviewable from the plan alone.

```diff
  function applyDiscount(order, rate) {
-   return order.total * rate;
+   if (rate < 0 || rate > 1) throw new RangeError("rate out of bounds");
+   return order.total * (1 - rate);
  }
```

Carve-out: `Contract.mirror` line-anchors (e.g. `src/utils/hash.ts:1-40`) remain valid — there they
are **precedent pointers** to existing structure being copied, not change references. The mirror
anchor names the source of truth to imitate; the prohibition applies only to lines the task edits.

### One rationale per decision (R52)

State each de-dup or design rationale exactly once and reference it; do not repeat the same
justification across multiple tasks or sections. When two tasks share a rationale, record it in
`## Key Decisions` and cite it — duplicated prose drifts out of sync when one copy is edited.

### Claim→source table

When a plan asserts behavioural claims that rest on external evidence (a spec clause, an RFC, a
codebase pattern, a web finding), back them with a claim→source table so each claim is traceable
and falsifiable rather than asserted.

| Claim | Source |
|---|---|
| Errors return `INVALID_ARGUMENT` on bad input | AIP-193 |
| Status transitions are validated in the domain layer | `src/routes/users.ts:1-50` |

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

## Deviations & assumptions

| Item | Issue asked | Plan does | Why |
|------|-------------|-----------|-----|
| Token storage | "sessions or stateless?" | Stateless JWT, no session store | Spec defers to implementer; stateless avoids new infra |

---

### Task 1: JWT utility module

**Complexity:** Standard
**Risk:** Low
**Depends on:** none
**Verify:** tests

**Files:**
- Create: `src/utils/jwt.ts`
- Test: `tests/utils/jwt.test.ts`

**Notes:** (optional — rationale only, ≤5 lines; the "what" lives in Files/Contract/Acceptance)
Reuse the already-installed `jsonwebtoken` package rather than hand-rolling signing; typed errors let the middleware (Task 2) branch on failure cause.

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

**Notes:** (optional — rationale only, ≤5 lines; the "what" lives in Files/Contract/Acceptance)
Middleware (not per-route guards) keeps auth enforcement in one place and reuses Task 1's `verifyToken` so the failure taxonomy stays single-sourced.

**Acceptance criteria:**
- [ ] Valid token: attaches decoded payload to `req.user` and calls `next()`
- [ ] Missing header: responds 401 with `{ error: "Unauthorized" }`
- [ ] Invalid/expired token: responds 401 with `{ error: "Unauthorized" }`
- [ ] Tests cover all three cases
```

---

## What NOT to Include in Plans

- Full implementation code / full schema-IDL dumps (code snippets for patterns are fine; complete
  implementations and full schema dumps are not).
  Exception: a task's `Contract.shape` pins signatures / sections / requirement deltas — not full
  bodies. A concrete Contract shape is the decided interface, not an implementation, and is NOT
  flagged by this rule.
  EXCEPTION (R46): one capped, elided (`…`) review artifact per distinct contract shape is encouraged — a
  payload/field-diff/state-table is distinct from a full implementation body or schema dump, which
  stay excluded. See `## Concrete Artifacts (render don't narrate)` for the 8-artifact catalog and
  rendering conventions.
- Absolute file paths (always use paths relative to project root)
- Superpowers-specific directives or REQUIRED SUB-SKILL headers
- References to tools or skills the executing agent should use
- Tasks with fewer than 2 acceptance criteria (not specific enough)
- Tasks that touch more than 5 files (split them)
