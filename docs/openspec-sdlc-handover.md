# OpenSpec → SDLC Handover Workflow

## Overview

OpenSpec owns the "what to build" — specs, proposals, and design decisions. SDLC owns the "how to build it" — implementation planning, parallel execution, code review, and shipping. The handover point is when spec artifacts flow into `/plan-sdlc`, which reads them to produce a fine-grained implementation plan. The integration is read-only: SDLC skills consume OpenSpec artifacts but never write to the `openspec/` directory.

---

## Ownership Boundary

| Phase | Owner | Key Actions |
|-------|-------|-------------|
| Requirements gathering | OpenSpec | `/opsx:propose`, `/opsx:explore` |
| Spec writing | OpenSpec | `/opsx:continue`, `/opsx:ff` — delta specs with ADDED/MODIFIED/REMOVED |
| Design decisions | OpenSpec | `design.md` — technical approach and architecture |
| Task decomposition (coarse) | OpenSpec | `tasks.md` — high-level checklist |
| **Handover** | **Artifact flow** | **SDLC reads OpenSpec artifacts read-only** |
| Implementation planning (fine-grained) | SDLC | `/plan-sdlc --spec` — decomposes into per-task metadata |
| Parallel execution | SDLC | `/execute-plan-sdlc` — wave-based dispatch with spec compliance |
| Code review | SDLC | `/review-sdlc` — multi-dimension review |
| Commit & PR | SDLC | `/commit-sdlc`, `/pr-sdlc` — semantic commit, auto-generated PR |
| Version & release | SDLC | `/version-sdlc` — semantic versioning and changelog |
| **Return to OpenSpec** | **Verification** | **`/opsx:verify` + `/opsx:archive`** |

---

## Stage-Aware Handoff

`session-start.js` detects the current OpenSpec stage using `lib/openspec.js` and suggests the appropriate SDLC command at each point. This eliminates the guardrail bypass gap where users would skip spec steps or invoke the wrong skill for their current stage.

| OpenSpec Stage | Artifact State | SDLC Action | Suggested By |
|---|---|---|---|
| Proposing | `proposal.md` only | None — spec in progress | session-start: "Continue spec: /opsx:continue" |
| Speccing | proposal + specs, no tasks | None — still spec work | session-start: "Continue spec: /opsx:ff" |
| Tasks ready | All artifacts, 0 tasks done | **Handoff** → `/plan-sdlc --from-openspec <name>` | session-start: "Plan with: /plan-sdlc --from-openspec \<name\>" |
| Implementing | Some tasks done, not all | Mixed ownership — OpenSpec apply or SDLC execute may be running | session-start: "Continue: /opsx:apply" or "/commit-sdlc" |
| Tasks complete | All checkboxes checked | `/ship-sdlc` (commit → review → PR) | session-start: "Ship: /ship-sdlc" |

**Note on `implementation-in-progress`:** This stage has mixed ownership. The user may be running `/opsx:apply` (OpenSpec-driven sequential execution) or `/execute-plan-sdlc` (SDLC wave-based execution). Session-start suggests both paths — the user chooses based on their workflow.

---

## End-to-End Workflow

### Step 1: Propose (OpenSpec)

`/opsx:propose "feature name"` creates `openspec/changes/<name>/` with `proposal.md` capturing intent, scope, and capabilities.

### Step 2: Develop the Spec (OpenSpec)

`/opsx:continue` (one artifact at a time) or `/opsx:ff` (all at once). Produces:

- **Delta specs** (`specs/*.md`) with ADDED/MODIFIED/REMOVED sections
- **`design.md`** for technical approach
- **`tasks.md`** for high-level checklist

### Step 3: Create Implementation Plan (SDLC)

`/plan-sdlc --spec` or `/plan-sdlc openspec/changes/<name>/`. Reads all artifacts:

- `proposal.md` → goal and scope
- `specs/*.md` → authoritative requirements (each ADDED/MODIFIED entry becomes at least one task)
- `design.md` → architecture constraints
- `tasks.md` → coarse decomposition reference (further decomposed into finer-grained tasks)

### Step 4: Execute the Plan (SDLC)

`/execute-plan-sdlc`. Wave-based parallel dispatch. When Source points to an OpenSpec change, the spec compliance reviewer additionally checks against delta spec requirements (per-wave + holistic check after all waves).

### Step 5: Review, Commit, and PR (SDLC)

- `/review-sdlc` — with `spec-compliance-review` dimension if installed
- `/commit-sdlc` — scope hint + `OpenSpec-Change` trailer from change name
- `/pr-sdlc` — auto-detects OpenSpec, pre-fills Business Context from `proposal.md`

### Step 6: Verify (OpenSpec)

`/opsx:verify` validates implementation completeness against specs.

### Step 7: Archive (OpenSpec)

`/opsx:archive` merges delta specs into main `specs/`, moves change to `archive/`.

### Workflow Diagram

```text
    OpenSpec                                        SDLC Skills
    ────────                                        ───────────

 1. /opsx:propose "add user notifications"
    └─► openspec/changes/add-user-notifications/
        ├── proposal.md
        └── specs/

 2. /opsx:continue
    └─► openspec/changes/add-user-notifications/
        ├── proposal.md
        ├── specs/*.md  (delta specs)
        ├── design.md
        └── tasks.md
                │
                │  ── artifacts flow ──►
                │
                ▼
                                             3. /plan-sdlc --spec
                                                reads proposal, specs,
                                                design, tasks
                                                └─► implementation plan

                                             4. /execute-plan-sdlc
                                                wave-based parallel dispatch
                                                + spec compliance checks
                                                └─► implemented code

                                             5. /review-sdlc
                                                /commit-sdlc
                                                /pr-sdlc
                                                └─► reviewed, committed, PR
                │
                │  ◄── return ──
                │
                ▼
 6. /opsx:verify
    └─► validates implementation completeness

 7. /opsx:archive
    └─► merges delta specs into main specs/
```

---

## Artifact Flow Map

| OpenSpec Artifact | SDLC Consumer | How It's Used |
|---|---|---|
| `proposal.md` | `/plan-sdlc` | Goal, scope, and what's in/out |
| `proposal.md` | `/pr-sdlc` | Pre-fills Business Context and Benefits sections |
| `specs/*.md` (delta specs) | `/plan-sdlc` | Authoritative requirements — each ADDED/MODIFIED entry becomes at least one task |
| `specs/*.md` (delta specs) | `/execute-plan-sdlc` | Spec compliance checks (per-wave in Step 5c-bis, holistic in Step 8-bis) |
| `design.md` | `/plan-sdlc` | Architecture constraints and key technical decisions |
| `tasks.md` | `/plan-sdlc` | Coarse decomposition reference — further decomposed into plan-sdlc's finer-grained tasks |
| Change directory name | `/commit-sdlc` | Scope hint for commit message + `OpenSpec-Change` trailer |

For detection mechanics and per-skill behavior details, see [OpenSpec Integration — Technical Reference](openspec-integration.md).

---

## Decision Guide: Which Execution Path?

| Dimension | `/opsx:apply` | SDLC Pipeline |
|---|---|---|
| Best for | Simple, linear changes | Complex, multi-file features |
| Task granularity | Uses OpenSpec's `tasks.md` directly | Decomposes into finer-grained tasks with metadata |
| Parallelism | Sequential execution | Wave-based parallel agent dispatch |
| Spec compliance | Manual verification | Automated per-wave + holistic checks |
| Error recovery | Manual | Automatic model escalation on failure |
| Review integration | Separate | Built-in multi-dimension review |
| When to choose | Task checklist is sufficient, < 5 files changed | 5+ files, multiple subsystems, need automated verification |

---

## Workflow Patterns

### Pattern 1: Spec-First (recommended for non-trivial features)

**When:** Requirements benefit from structured specification before implementation.

**Flow:** `/opsx:propose` → `/opsx:continue` → `/plan-sdlc --from-openspec <name>` → `/ship-sdlc` → `/opsx:verify` → `/opsx:archive`

**Example:** Adding a new notification system with multiple channels, user preferences, and delivery guarantees.

### Pattern 2: Plan-First with Spec Prompt

**When:** Moderate changes where you want the option of spec rigor without committing upfront.

**Flow:** Start with `/plan-sdlc`. If a functional change is detected and OpenSpec is present, the skill proposes switching to spec-first. Choose to start `/opsx:propose`, continue planning directly, or load an existing spec.

**Example:** Adding a new API endpoint — might benefit from speccing, might not.

### Pattern 3: Direct Planning (non-functional changes)

**When:** Refactoring, config updates, documentation, CI/CD changes.

**Flow:** `/plan-sdlc` → `/execute-plan-sdlc` → ship. OpenSpec shows a passive hint, no interruption.

**Example:** Migrating from Jest to Vitest, updating CI pipeline.

### Pattern 4: Existing Spec, New Session

**When:** Spec work was done earlier or by a teammate.

**Flow:** `/plan-sdlc --from-openspec <name>` → picks up existing artifacts directly.

**Example:** Designer wrote specs last week, developer picks up implementation today.

### Pattern 5: Speed Run to SDLC

**When:** You want the fastest path from idea to shipped code with spec traceability.

**Flow:** `/opsx:new` → `/opsx:ff` → `/plan-sdlc --from-openspec <name>` → `/ship-sdlc` → `/opsx:archive`

**Example:** Small feature with clear scope — spec it quickly, plan from the spec, ship in one pipeline.

---

## Setting Up the Integration

1. **Install OpenSpec CLI:** `npm install -g @fission-ai/openspec@latest`
2. **Initialize in project:** `openspec init`
3. **Add spec compliance review dimension:** `/setup-sdlc --dimensions` and select `spec-compliance-review`
4. **Branch naming:** match branch name to `openspec/changes/<name>/` directory for auto-detection (e.g., branch `add-user-notifications` for change `openspec/changes/add-user-notifications/`)

---

## See Also

- [OpenSpec Overview](openspec-overview.md) — what OpenSpec is, all commands and concepts
- [OpenSpec Integration — Technical Reference](openspec-integration.md) — detection algorithm, per-skill behavior matrix, design principles
