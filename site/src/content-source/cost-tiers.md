# Cost Tiers — Skill and Agent Model Assignments

Single source of truth for the model that runs each skill and orchestrator agent in the SDLC plugin.

## 1. Overview

Per-skill and per-agent `model:` frontmatter lets the plugin trade cost against quality on a surface-by-surface basis. Mechanical, deterministic work runs on the cheap tier; reasoning-heavy work runs on stronger models. Without explicit pinning every dispatch inherits the caller's model — typically Opus — which is unnecessarily expensive for surfaces whose output is template-driven.

This document is the canonical record. The `validate-cost-tiers.js` CI script diffs this table against actual frontmatter on every change and fails when they disagree.

## 2. Resolution Precedence

When the runtime needs to decide which model to run a surface on, it evaluates these in order (most → least specific):

1. **Per-call `model:` parameter** on `Agent` / `Skill` / `SendMessage` dispatch sites. Examples: `ship.js` per-step, `execute.js` per-task, `review.js` per-dimension. These are computed at dispatch time and override everything below.
2. **Frontmatter `model:`** on the skill or agent definition file (the tables in §3 and §4).
3. **Caller's inherited model** — only when neither of the above is set. Avoid relying on inheritance; pin explicitly.

## 3. Skill Table

One row per skill in `plugins/sdlc-utilities/skills/`.

| Skill | Model | Rationale |
|---|---|---|
| commit-sdlc | haiku | Mechanical message drafting from prepare-script JSON; orchestrator agent also haiku |
| error-report-sdlc | sonnet | Template-driven; orchestrator runs haiku |
| execute-plan-sdlc | sonnet | Per-task dispatch decides per-tier (haiku/sonnet/opus) |
| harden-sdlc | sonnet | Existing — unchanged |
| jira-sdlc | sonnet | Read/write Jira; light reasoning |
| plan-sdlc | opus | Plan decomposition needs stronger reasoning; user-directed |
| pr-sdlc | sonnet | PR body assembly |
| received-review-sdlc | opus | Review-comment triage benefits from stronger reasoning |
| review-sdlc | sonnet | Existing — unchanged; orchestrator runs opus |
| setup-sdlc | sonnet | Wizard / config writes |
| ship-sdlc | sonnet | Pipeline coordinator; per-step model overrides win |
| version-sdlc | haiku | Version bump + changelog from prepare-script JSON; deterministic |

## 4. Agent Table

One row per agent in `plugins/sdlc-utilities/agents/`.

| Agent | Model | Rationale |
|---|---|---|
| commit-orchestrator | haiku | Manifest → message; deterministic shape |
| error-report-orchestrator | haiku | Template → JSON |
| harden-orchestrator | haiku | Manifest → JSON |
| review-orchestrator | opus | Cross-dimension critique + dedup reasoning |

## 5. Dispatch-Site Overrides

Files where per-call `model:` is computed at runtime and **wins over frontmatter**:

- `plugins/sdlc-utilities/scripts/skill/ship.js` — passes per-step `model:` for each pipeline phase.
- `plugins/sdlc-utilities/scripts/skill/execute.js` — passes per-task `model:` based on task complexity (Trivial → haiku, Standard → sonnet, Complex → opus).
- `plugins/sdlc-utilities/scripts/skill/review.js` — passes per-dimension `model:` resolved from each dimension file's own frontmatter.
- `plugins/sdlc-utilities/skills/plan-sdlc/SKILL.md` — cross-model plan-reviewer rule (sonnet reviews opus-authored plans, and vice versa) at 5+ tasks.

When ship-sdlc invokes a sub-skill, the sub-skill's frontmatter `model:` is shadowed by the per-step value computed in `ship.js`. Consumers should not assume frontmatter applies inside a pipeline.

## 6. Why Frontmatter Changes Do Not Require Spec Updates

The `spec-first` planning guardrail requires an accepted spec at `docs/specs/<skill>.md` before changes that modify a skill's behavioral contract. Adding or changing `model:` is **not** a behavioral change — it tunes the cost/quality tradeoff for the same contract. The skill's inputs, outputs, side effects, and user-visible behavior are unchanged.

If a `model:` change later proves to degrade output quality below the contract's bar (e.g., commit messages stop matching project style), that is a behavioral regression and triggers a normal spec-driven update of the skill. The fix in that case is either to revert the tier or to update the spec to acknowledge the new quality envelope.
