# OpenSpec Integration

## Overview

The sdlc-utilities plugin detects and consumes [OpenSpec](https://github.com/Fission-AI/OpenSpec/) artifacts when present in a project. OpenSpec owns the specification workflow (proposing changes, writing delta specs, designing solutions); SDLC skills own the implementation workflow (planning, executing, reviewing, committing, and creating PRs). The integration is read-only — SDLC skills read OpenSpec artifacts but never write to `openspec/`.

---

## Prerequisites

| Requirement | Install | Notes |
| --- | --- | --- |
| OpenSpec CLI | `npm install -g @fission-ai/openspec@latest` | Requires Node.js 20.19.0+ |
| Project initialized | `openspec init` | Creates `openspec/` directory with `config.yaml` |
| sdlc-utilities plugin | `/plugin install sdlc@sdlc-marketplace` | See [Getting Started](getting-started.md) |

---

## How Detection Works

Every skill that supports OpenSpec runs the same lightweight detection:

1. **Glob** for `openspec/config.yaml` — if absent, skip OpenSpec integration entirely (zero overhead).
2. **Glob** `openspec/changes/*/proposal.md` (excluding `archive/`) — find active changes.
3. **Resolve** the active change:
   - If exactly one exists → use it.
   - If multiple exist → match against the current git branch name.
   - If ambiguous → ask the user (`plan-sdlc`) or silently skip (`pr-sdlc`, `commit-sdlc`).

When `openspec/` is absent, all skills behave identically to their non-OpenSpec behavior. Detection adds one failing Glob call (~milliseconds) — no measurable overhead.

### Detection vs Loading

Detection (Tier 1) is always on — one Glob for `config.yaml`, zero file reads, negligible cost. Loading (Tier 2) is opt-in — triggered by the `--spec` flag or an explicit spec path. Without `--spec`, skills detect OpenSpec presence and print a hint but do not read artifacts.

---

## End-to-End Workflow

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
                                             3. /plan-sdlc
                                                reads proposal.md, specs/*.md,
                                                design.md, tasks.md
                                                └─► implementation plan

                                             4. /execute-plan-sdlc
                                                wave-based parallel dispatch
                                                + spec compliance checks
                                                └─► implemented code

                                             5. /review-sdlc
                                                /commit-sdlc
                                                /pr-sdlc
                                                └─► reviewed, committed, PR created
                │
                │  ◄── verify ──
                │
                ▼
 6. /opsx:verify
    └─► validates implementation completeness

 7. /opsx:archive
    └─► merges delta specs into main specs/
```

### Step 1: Propose a Change (OpenSpec)

```text
/opsx:propose "add user notifications"
```

OpenSpec creates `openspec/changes/add-user-notifications/` with `proposal.md` capturing intent, scope, and capabilities.

### Step 2: Develop the Spec (OpenSpec)

```text
/opsx:continue
```

Work through delta specs (`specs/*.md`) with ADDED/MODIFIED/REMOVED sections, then `design.md` for technical approach, then `tasks.md` for a high-level task checklist.

### Step 3: Create Implementation Plan (SDLC)

```text
/plan-sdlc --spec
# or with explicit path (implicitly enables spec loading):
# /plan-sdlc openspec/changes/add-user-notifications/
```

plan-sdlc reads all OpenSpec artifacts:

- `proposal.md` → goal and scope
- `specs/*.md` → authoritative requirements (every ADDED/MODIFIED entry becomes at least one task)
- `design.md` → architecture constraints and key decisions
- `tasks.md` → coarse decomposition reference (further decomposed into plan-sdlc's finer-grained tasks)

Produces an implementation plan with the `**Source:**` header pointing to the OpenSpec change.

### Step 4: Execute the Plan (SDLC)

```text
/execute-plan-sdlc
```

Executes the plan with wave-based parallel dispatch. When the plan's Source points to an OpenSpec change, the spec compliance reviewer additionally checks implementations against the delta spec requirements — not just the task acceptance criteria.

### Step 5: Review, Commit, and PR (SDLC)

```text
/review-sdlc          # with spec-compliance-review dimension if installed
/commit-sdlc          # scope hint from OpenSpec change name
/pr-sdlc              # Business Context pre-filled from proposal.md
```

### Step 6: Verify and Archive (OpenSpec)

```text
/opsx:verify          # validates implementation completeness
/opsx:archive         # merges delta specs into main specs/
```

---

## Per-Skill Behavior

| Skill | Without OpenSpec | With OpenSpec |
| --- | --- | --- |
| `/plan-sdlc` | Asks for requirements via conversation | Detects presence, prints hint. With `--spec`: reads proposal, delta specs, design, and tasks from the active change |
| `/execute-plan-sdlc` | Spec compliance checks task acceptance criteria only | Additionally checks implementations against delta spec requirements |
| `/pr-sdlc` | Asks user for Business Context/Benefits | With `--spec`: pre-fills from `proposal.md` intent and scope. Without `--spec`: no change from base behavior |
| `/commit-sdlc` | Infers scope from changed files | Uses change directory name as scope candidate |
| `/review-init-sdlc` | Proposes dimensions based on tech stack | Additionally proposes `spec-compliance-review` dimension |
| `/review-sdlc` | Reviews against installed dimensions | No change (spec awareness comes from the dimension) |
| `/version-sdlc` | No change | No change |
| `/jira-sdlc` | No change | No change |
| `/received-review-sdlc` | No change | No change |
| `/pr-customize-sdlc` | No change | No change |

---

## Alternative Execution Path: /opsx:apply vs /execute-plan-sdlc

OpenSpec provides its own execution command (`/opsx:apply`) that works through `tasks.md` checkboxes. The SDLC plugin's `/execute-plan-sdlc` is a more sophisticated alternative with:

- Wave-based parallel agent dispatch
- Per-task complexity classification and model assignment
- Automatic spec compliance review
- Error recovery with model escalation

**When to use which:**

- Use `/opsx:apply` for simple changes where the OpenSpec task checklist is sufficient.
- Use `/plan-sdlc` + `/execute-plan-sdlc` for complex changes that benefit from finer-grained task decomposition, parallel execution, and automated verification.

Both paths are valid — the choice depends on the complexity of the change.

---

## Adding a Spec-Compliance Review Dimension

When OpenSpec is detected, `/review-init-sdlc` proposes a `spec-compliance-review` dimension. To install it:

```text
/review-init-sdlc
```

Select `spec-compliance-review` from the proposed dimensions. The dimension verifies:

- Every ADDED requirement in delta specs has corresponding implementation.
- Every MODIFIED requirement's changes are reflected in code.
- No REMOVED requirements still have active code paths.

After installation, `/review-sdlc` automatically includes spec compliance in its multi-dimension review.

---

## Troubleshooting

### Multiple active OpenSpec changes

If you have multiple changes in `openspec/changes/` (excluding archive), skills try to match against your current git branch name. If no match is found:

- `plan-sdlc` asks you to select the active change.
- `pr-sdlc` and `commit-sdlc` silently skip OpenSpec enrichment (PR/commit creation should not be blocked by detection ambiguity).

**Fix:** Name your git branch to match the OpenSpec change directory (e.g., branch `add-user-notifications` for change `openspec/changes/add-user-notifications/`).

### Missing OpenSpec artifacts

If `design.md` or `tasks.md` don't exist yet in the change directory, skills skip them gracefully. Only `proposal.md` and at least one delta spec in `specs/` are needed for meaningful integration.

### OpenSpec not detected despite being installed

Check that `openspec/config.yaml` exists in your project root. If you've customized the OpenSpec directory location, the detection won't find it — it only checks the default path.

---

## Design Principles

1. **Read-only consumer** — SDLC skills never write to `openspec/`. OpenSpec owns its directory.
2. **Graceful degradation** — Every OpenSpec-aware code path has a "skip if absent" guard. No skill breaks without OpenSpec.
3. **No CLI coupling** — Skills read OpenSpec's markdown artifacts directly. They never call `openspec validate`, `openspec status`, or any OpenSpec CLI command. This prevents version coupling.
4. **No new scripts or hooks** — Detection uses inline Glob calls, not a dedicated detection script or session-start hook.
5. **Opt-in context loading** — Skills detect OpenSpec presence (one failing Glob) but do not read artifacts unless the user opts in with `--spec` or provides an explicit spec path. This prevents context bloat on unrelated tasks.
