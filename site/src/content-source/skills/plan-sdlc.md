# `/plan-sdlc` — Implementation Plan Writer

## Overview

Writes an implementation plan from requirements, a spec, or a user description. Operates primarily in Plan Mode — the plan file is the single source of truth, built incrementally: a skeleton header is written at the start, then filled with requirements, tasks, and critique fixes as the pipeline progresses. Produces plans in the format consumed by `execute-plan-sdlc` — with per-task complexity, risk, and dependency metadata embedded. Follows a PCIDCI pipeline: analyzes requirements and codebase, decomposes into classified tasks, self-critiques, presents for user approval, and runs a cross-model plan review loop.

---

## Usage

```text
/plan-sdlc
```

Provide requirements in one of three ways:
- Describe what you want to implement in the conversation (free form, bullet points, or detailed spec)
- Provide a path to a requirements or spec file
- Invoke with nothing — the skill will ask for requirements

### Auto-resolution in plan mode

When Claude Code's plan mode is active, this skill activates automatically — no explicit `/plan-sdlc` invocation needed. Describe what you want to implement and the skill loads itself.

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--spec` | Include OpenSpec artifacts (proposal, delta specs, design, tasks) in planning context. Without this flag, OpenSpec presence is detected but artifacts are not read. | Off |

Providing an explicit `openspec/changes/<name>/` path as the spec-file-path argument implicitly enables spec context loading — `--spec` is not needed in that case.

---

## Complexity Routing

Not every request needs a full planning pipeline:

| Scope Signal | Normal Mode | Plan Mode |
|---|---|---|
| 1 file, clear change | Stop — just do the work | Lightweight plan (user explicitly chose to plan) |
| 2–3 files, clear scope | Lightweight: skip exploration and review loop | Lightweight |
| 4+ files or unclear scope | Full pipeline (Steps 1–7) | Full pipeline |
| Multiple independent subsystems | Flags the split, suggests one plan per subsystem | Same |

For plans with 5+ tasks, the skill also writes a `## Key Decisions` section — placed between the plan header and the first task — capturing architecture choices with rationale so executing agents understand *why* an approach was chosen, not just what to do.

---

## Plan Mode

When Claude Code's [plan mode](https://docs.anthropic.com/en/docs/claude-code/plan-mode) is active, the skill adapts automatically:

- **Incremental plan file building:** The plan evolves in the designated file across the pipeline. Step 0 writes a skeleton header immediately. Step 1 fills in the header fields and appends a Requirements section. Step 2 appends tasks. Steps 4 and 6 rewrite the file with critique fixes applied.
- **Session recovery:** If the plan file already has content when the skill starts, it uses `AskUserQuestion` to ask whether to resume from critique or restart — no scratchpad needed, the plan file itself is the checkpoint.
- **All interaction via AskUserQuestion:** Requirements gathering, scope clarification, and approval prompts all go through `AskUserQuestion`, which is compatible with plan mode constraints.
- **TodoWrite for progress tracking:** In full-pipeline runs, `TodoWrite` items are created for Steps 1–7 so you can see planning progress.
- **Handoff:** The skill calls `ExitPlanMode` at the end — Claude Code presents the plan for your review. No manual exit needed.
- **After approval:** Once you approve the plan in Claude Code's review UI, invoke `/execute-plan-sdlc` to start execution.

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

### Plan with OpenSpec context

```text
/plan-sdlc --spec
```

Reads OpenSpec artifacts from the active change and uses them as authoritative requirements for the plan.

### OpenSpec flow proposal for functional changes

When OpenSpec is detected and you describe a functional change without `--spec`:

```text
/plan-sdlc

Add a webhook notification system for order events
```

Response:

```
This looks like a functional change. This project uses OpenSpec for spec-driven development.

Options:
  1. Start OpenSpec flow — run /opsx:propose to spec this out first
  2. Continue planning directly — skip spec workflow
  3. Use existing spec — if you already have an OpenSpec change for this
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

### Using plan-sdlc inside plan mode

Invoke `/plan-sdlc` while Claude Code plan mode is active:

1. The skill detects plan mode and writes a skeleton header to the designated plan file immediately — the file is initialized before any exploration begins
2. After requirements discovery and codebase exploration, the plan file is updated: header fields (Goal, Architecture, Verification) are filled in and a Requirements section is appended
3. After task decomposition, task blocks (and a Key Decisions section, if applicable) are appended to the plan file
4. After self-critique (Step 3) and user approval (Step 4), the plan file is rewritten with all fixes applied
5. The skill calls `ExitPlanMode` — Claude Code presents the finalized plan for your review
6. After you approve, execution begins automatically — `/execute-plan-sdlc` is auto-invoked with the plan already in context

The plan format is identical regardless of mode, so `/execute-plan-sdlc` loads it without any adjustments.

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| `<plansDirectory>/YYYY-MM-DD-<feature-name>.md` | The written plan document (normal mode). Starts as a skeleton header at Step 0 and grows incrementally: header fields and Requirements section added at Step 1, task blocks at Step 2, critique fixes applied at Steps 4 and 6. Path resolved from: user-specified → project `.claude/settings.json` `plansDirectory` → global `~/.claude/settings.json` `plansDirectory` → `~/.claude/plans/` fallback. |
| Plan mode designated file | When Claude Code plan mode is active, the plan is written to the system-designated file path instead of the above. Same incremental build process applies. The path appears in the plan mode system banner. |
| `.claude/learnings/log.md` | Planning learnings appended after writing: scope decisions, clarification patterns, decomposition issues. |

---

## Prerequisites

- **A git repository** — codebase exploration reads the project tree to map affected files and detect patterns
- **Requirements or a description** — at minimum a sentence describing what to build; a spec file is accepted but not required

No external tools, credentials, or config files are needed.

### Harness Configuration

| Field | Value |
|---|---|
| Plan mode | Native support (writes to plan file, calls `ExitPlanMode`) |

## OpenSpec Integration

When the project uses [OpenSpec](https://github.com/Fission-AI/OpenSpec/), this skill reads the active change's artifacts as requirements input.

- **Reads:** `proposal.md` (goal/scope), `specs/*.md` (delta specs as requirements), `design.md` (architecture), `tasks.md` (coarse decomposition reference)
- **Behavior change:** Skips structured discovery questions when OpenSpec artifacts provide sufficient scope. Maps every ADDED/MODIFIED delta spec requirement to at least one task.
- **Plan header:** Sets `**Source:**` to `openspec/changes/<name>/` instead of "conversation context"
- **Functional change routing:** When OpenSpec is detected but `--spec` is not passed, the skill classifies the user's request. For functional changes (new features, behavior modifications, API changes), it checks for a matching active OpenSpec change — if found, it auto-loads the spec context. If no match exists, it proposes three options: start the OpenSpec flow with `/opsx:propose`, continue planning directly without specs, or load an existing spec. Non-functional changes (refactoring, config, docs) receive a passive hint only.

See [OpenSpec Integration Guide](../openspec-integration.md) for the full workflow.

---

## Related Skills

- [`/execute-plan-sdlc`](execute-plan-sdlc.md) — executes the plans this skill produces
- [`/review-sdlc`](review-sdlc.md) — review changes after plan execution
