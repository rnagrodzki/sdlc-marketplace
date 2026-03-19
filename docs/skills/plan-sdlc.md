# `/plan-sdlc` — Implementation Plan Writer

## Overview

Writes an implementation plan from requirements, a spec, or a user description. Produces plans in the format consumed by `execute-plan-sdlc` — with per-task complexity, risk, and dependency metadata embedded. Follows a PCIDCI pipeline: analyzes requirements and codebase, decomposes into classified tasks, self-critiques, presents for user approval, saves to a temp file, and runs a cross-model plan review loop.

---

## Usage

```text
/plan-sdlc
```

Provide requirements in one of three ways:
- Describe what you want to implement in the conversation (free form, bullet points, or detailed spec)
- Provide a path to a requirements or spec file
- Invoke with nothing — the skill will ask for requirements

---

## Flags

No flags. The skill adapts behavior based on requirement scope.

---

## Complexity Routing

Not every request needs a full planning pipeline:

| Scope Signal | Behavior |
|---|---|
| 1 file, clear change | Stop — just do the work. Tells you: "This is a single-file change — no plan needed." |
| 2–3 files, clear scope | Lightweight: skip codebase exploration and plan review loop; write plan directly and present for approval |
| 4+ files or unclear scope | Full pipeline (Steps 1–7) |
| Multiple independent subsystems | Flags the split, suggests one plan per subsystem, and waits for your decision |

For plans with 5+ tasks, the skill also writes a `## Key Decisions` section — placed between the plan header and the first task — capturing architecture choices with rationale so executing agents understand *why* an approach was chosen, not just what to do.

---

## Examples

### From conversation context

Describe what you want in the conversation, then invoke:

```text
/plan-sdlc

I want to add a JWT authentication layer. Users should be able to log in with email/password,
receive a token, and include that token in subsequent API requests. The middleware should
attach the decoded user to req.user and reject invalid or expired tokens with 401.
```

The skill explores the codebase and presents a requirements checklist with task mappings, followed by the full plan and an estimated wave preview:

```
Requirements:
  - [ ] JWT login endpoint (email + password) → Task 1, Task 2
  - [ ] Token validation middleware             → Task 3
  - [ ] Attach decoded user to req.user         → Task 3
  - [ ] Reject invalid/expired tokens with 401  → Task 3, Task 4

Wave preview:
  Pre-wave: Task 1 [Trivial]
  Wave 1:   Task 2 [Standard], Task 3 [Standard]
  Wave 2:   Task 4 [Complex]

Approve this plan, or describe changes?
```

### From a requirements file

```text
/plan-sdlc

docs/specs/auth-redesign.md
```

The skill reads the file, parses requirements into a numbered checklist, explores relevant code, and proceeds through the full pipeline.

### Vague requirements — structured discovery

When requirements are under-specified, the skill asks 2–3 targeted questions before proceeding:

```text
/plan-sdlc

Add search to the app
```

Response:

```
Before I decompose this, I need to clarify three things:

1. Scope — what entities are searchable (users, products, posts)? Full-text or filtered?
2. Integration — is there an existing search index, or does this need a new one?
3. Success — what does a passing test look like?
```

### Completing the wave preview after approval

After you approve the plan, the skill saves it and hands off:

```
Plan written to ~/.claude/plans/2026-03-19-auth-layer.md

To execute: /execute-plan-sdlc
```

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| `<plansDirectory>/YYYY-MM-DD-<feature-name>.md` | The written plan document. Path resolved from: user-specified → project `.claude/settings.json` `plansDirectory` → global `~/.claude/settings.json` `plansDirectory` → `~/.claude/plans/` fallback. |
| `$TMPDIR/claude-plans/<feature-name>-exploration.md` | Temporary exploration scratchpad written during Step 1 (full pipeline only). Updated after every 2 exploration actions and re-read before Step 2 begins. Contains a checkpoint block for session recovery. |
| `.claude/learnings/log.md` | Planning learnings appended after writing: scope decisions, clarification patterns, decomposition issues. |

---

## Prerequisites

- **A git repository** — codebase exploration reads the project tree to map affected files and detect patterns
- **Requirements or a description** — at minimum a sentence describing what to build; a spec file is accepted but not required

No external tools, credentials, or config files are needed.

---

## Related Skills

- [`/execute-plan-sdlc`](execute-plan-sdlc.md) — executes the plans this skill produces; consumes the Complexity, Risk, Depends on, and Verify fields per task
- [`/review-sdlc`](review-sdlc.md) — review the resulting implementation after execution
- [`/pr-sdlc`](pr-sdlc.md) — open a PR after execution completes
