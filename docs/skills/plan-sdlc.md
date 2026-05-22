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
| `--from-openspec <change-name>` | Direct bridge from OpenSpec to planning. Validates the named change, loads all artifacts, and uses `tasks.md` as the primary decomposition skeleton. Bypasses the gate check entirely. | Off |

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

## Dynamic-Dimension Discovery (R24–R28)

For 4+ file scopes, plan-sdlc dispatches a parallel dynamic-dimension orchestrator before decomposing tasks. The orchestrator produces a `discovery-brief.md` with stable `F-<DIM>-<n>` finding IDs that every Standard/Complex task must cite.

**Step 0 — Prepare.** `plan.js` runs as today, but now also spawns `plan-explore.js`. That script walks git changes, parses backtick paths from any active OpenSpec proposal, tokenizes the user prompt, and `git grep`s for top non-stopword tokens to build a scope-hint file set (capped 30 files). It computes `webResearchSignal` from a regex over best-practice phrases plus a fixed external-tech vocab (oauth, jwt, kafka, redis, kubernetes, terraform, react, vue, angular, postgres, mongodb, graphql, grpc, websocket, oauth2, openid, saml). It writes everything to `manifest.json` inside `os.tmpdir()/sdlc-explore-<branchSlug>-XXXX/`. Output back to plan.js: `explorePack = { manifestPath, outDir, scopeHintCount, webResearchSignal, error }`.

**Step 1 — Routing.** Three branches:
- **≤3 files (lightweight):** orchestrator skipped. Inline exploration as today. No brief.
- **4+ files AND `explorePack.manifestPath != null`:** install EXIT/INT/TERM trap to wipe the tempdir, then dispatch `sdlc:plan-explore-orchestrator` exactly once with `MANIFEST_FILE`, `PROJECT_ROOT`, `USER_PROMPT`, `OPENSPEC_CONTEXT`.
- **`explorePack.error` non-null:** append a one-line note to `.sdlc/learnings/log.md`, fall back to inline exploration. Plan still produced.

**Orchestrator (the new agent).** Four steps, mirroring review-orchestrator but with a load-bearing inversion:
1. **SCOPE.** LLM-derives 3–7 kebab-case task-specific dimensions as JSON `{ name, description, files[], mode, model }`. Names are task-shaped (`auth-middleware-integration`), not generic axes. Must include ≥1 `web`/`hybrid` dimension when `webResearchSignal: true`; must include zero web/hybrid when the prompt is a pure rename/move/dead-code refactor.
2. **FAN-OUT.** All dimensions dispatched in a **single message** as parallel `general-purpose` Agent calls. Per-mode tool restriction + budget:
   - `code` → `Read, Glob, Grep`
   - `web` → `WebSearch, WebFetch`, ≤5 searches + ≤8 fetches, source-quality steer (OWASP/RFC/MDN/vendor)
   - `hybrid` → both, ≤3 + ≤5, findings tagged `[web-only | verified-in-codebase | conflicts-with-codebase]`
3. **CRITIQUE.** Dedupe by file:line / url, keep highest severity, flag contradictions, flag zero-finding dimensions, flag web-vs-codebase conflicts.
4. **CONSOLIDATE.** Write `discovery-brief.md` to `manifest.outDir` with stable IDs: `F-<DIM>-<n>: file:line — observation` (code) or `F-<DIM>-<n>: <url> — observation (recency, source-type)` (web). When web/hybrid ran, append a `## Best-Practice Synthesis` section.

**Step 2 — Decompose.** Same as today, but each Standard/Complex task must cite ≥1 `F-<DIM>-<n>` ID or be marked "out-of-scope addition" with rationale. Trivial tasks exempt. When web/hybrid ran, Key Decisions explicitly **ADOPTS**, **REJECTS-with-rationale**, or marks **NOT-APPLICABLE** each web finding by ID.

**Step 3 — Critique.** One new gate row (G15): brief-citation coverage. Error severity when brief was produced; not-applicable when fallback ran.

**Step 5 — Reviewer.** plan-reviewer-prompt gains a `{BRIEF_FILE}` input plus two gate rows: *exploration provenance* (uncited Standard/Complex tasks blocking) and *best-practice traceability* (silent omission of a web finding blocking).

**Cleanup.** Tempdir wiped by the EXIT/INT/TERM trap installed in Step 1. Orphans from crashed runs swept by `ship-sdlc --gc`, which now globs `sdlc-explore-*` alongside the existing four state-file buckets and removes by mtime + branch-liveness.

**Three modes for dimensions:**
| Mode | Tools | Budget | Output tag |
|---|---|---|---|
| `code` | Read, Glob, Grep | unlimited | `F-<DIM>-<n>: file:line — observation` |
| `web` | WebSearch, WebFetch | ≤5 searches + ≤8 fetches | `F-<DIM>-<n>: <url> — observation (recency, source-type)` |
| `hybrid` | Read, Glob, Grep, WebSearch, WebFetch | ≤3 searches + ≤5 fetches | tagged `[web-only \| verified-in-codebase \| conflicts-with-codebase]` |

**`webResearchSignal` triggers** — set to `true` when the user prompt matches any of:
- Regex (case-insensitive): `best practice`, `recommended`, `industry standard`, `state of the art`, `compare alternatives`, `alternatives to`
- External-tech vocab token (any occurrence): `oauth`, `jwt`, `kafka`, `redis`, `kubernetes`, `terraform`, `react`, `vue`, `angular`, `postgres`, `mongodb`, `graphql`, `grpc`, `websocket`, `oauth2`, `openid`, `saml`

**Lightweight-skip rule.** When complexity routing lands at ≤3 files, the orchestrator is skipped entirely. No brief, no tempdir, `explorePack.manifestPath = null`. Inline exploration is used as today.

**Fallback path.** When `plan-explore.js` fails or `sdlc:plan-explore-orchestrator` exits non-zero, plan-sdlc appends a one-line note to `.sdlc/learnings/log.md` and falls back to inline exploration. The plan is still produced — brief absence is not a plan failure.

**Brief example** (3 dimensions, one web, one hybrid):
```
## F-auth-middleware-integration
F-auth-middleware-integration-1: src/middleware/auth.ts:42 — JWT validation only checks expiry, not issuer
F-auth-middleware-integration-2: src/routes/user.ts:88 — route applies auth middleware but missing RBAC check

## F-oauth2-best-practices
F-oauth2-best-practices-1: https://www.rfc-editor.org/rfc/rfc6749 — authorization code flow requires PKCE for SPAs (2023-06, RFC)
F-oauth2-best-practices-2: https://owasp.org/www-project-top-ten/... — token storage in memory preferred over localStorage (2023-01, OWASP) [web-only]

## Best-Practice Synthesis
- ADOPT F-oauth2-best-practices-1 — PKCE is the current standard and applies to the planned OAuth2 flow
- REJECT F-oauth2-best-practices-2 — app is server-rendered; localStorage concern does not apply
```

**Contrast with review-sdlc.** review-sdlc reads a STATIC dimension registry (`lib/dimensions.js`) — same axes every run (security, performance, docs, …). plan-sdlc DERIVES dimensions per task in the orchestrator's SCOPE step. The prepare script supplies raw materials + `webResearchSignal`; the dimension JSON itself is LLM-produced because planning dimensions are unknowable at script-write time (`auth-middleware-integration` ≠ `cli-flag-parser-refactor`).

---

## Plan Mode

When Claude Code's [plan mode](https://docs.anthropic.com/en/docs/claude-code/plan-mode) is active, the skill adapts automatically:

- **Incremental plan file building:** The plan evolves in the designated file across the pipeline. Step 0 writes a skeleton header immediately and loads plan guardrails from project config. Step 1 fills in the header fields and appends a Requirements section. Step 2 appends tasks. Steps 4 and 6 rewrite the file with critique fixes applied.
- **Session recovery (autonomous default):** If a draft plan file already exists when the skill starts, it is overwritten — pre-existing drafts are discarded. Save a copy before invoking if you want to preserve it. (Fixes #388 — Step 0 is autonomous; the single user touchpoint for the finalized plan is Step 7 Handoff.)
- **User interactions (genuine decision gates only):** `AskUserQuestion` is used for requirements gathering when the spec is missing/ambiguous, scope-split prompts, OpenSpec routing, the Step 6 reviewer-loop max-iterations escalation, the Step 4 error-severity guardrail-block harden offer, and the Step 7 handoff menu. The Step 0 session-recovery prompt and Step 4 plan-approval prompt have been removed — those steps now run autonomously.
- **TodoWrite for progress tracking:** In full-pipeline runs, `TodoWrite` items are created for Steps 1–7 so you can see planning progress.
- **Handoff:** The skill calls `ExitPlanMode` at the end — Claude Code presents the plan for your review. No manual exit needed.
- **After approval:** Once you approve the plan in Claude Code's review UI, invoke `/ship-sdlc` for the full pipeline (execute, commit, review, version, PR), or `/execute-plan-sdlc` for execution only.

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

The skill explores the codebase and presents a requirements checklist with task mappings, followed by the full plan for approval:

```
Requirements:
  - [ ] JWT login endpoint (email + password) → Task 1, Task 2
  - [ ] Token validation middleware             → Task 3
  - [ ] Attach decoded user to req.user         → Task 3
  - [ ] Reject invalid/expired tokens with 401  → Task 3, Task 4

Approve this plan, or describe changes?
```

### Plan with OpenSpec context

```text
/plan-sdlc --spec
```

Reads OpenSpec artifacts from the active change and uses them as authoritative requirements for the plan.

### Direct bridge from OpenSpec change

```text
/plan-sdlc --from-openspec add-resource-indicators
```

Validates the named change (`openspec/changes/add-resource-indicators/`), loads all artifacts (proposal, design, delta specs, tasks), and uses `tasks.md` as the primary decomposition skeleton. Skips the gate check and structured discovery — the OpenSpec artifacts provide scope, integration, and success criteria directly. This is the recommended path when session-start reports a change at stage `ready-for-plan`.

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
4. After self-critique (Step 3) — which includes a guardrail compliance gate checking every task against the loaded guardrails — the plan file is rewritten with all fixes applied autonomously in Step 4; a `## Guardrail Compliance` section is appended listing each guardrail and its pass/fail status. Step 4 does NOT prompt for plan approval (Fixes #388); the user sees the plan only at the Step 7 handoff. The Step 4 error-severity guardrail-block harden offer remains the only user touchpoint at this stage
5. The skill calls `ExitPlanMode` — Claude Code presents the finalized plan for your review; the cross-model reviewer also receives the guardrails as a `{GUARDRAILS}` template variable so the second model can verify compliance independently
6. After you approve, execution begins automatically — `/execute-plan-sdlc` is auto-invoked with the plan already in context

The plan format is identical regardless of mode, so `/execute-plan-sdlc` loads it without any adjustments.

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| `<plansDirectory>/YYYY-MM-DD-<feature-name>.md` | The written plan document (normal mode). Starts as a skeleton header at Step 0 and grows incrementally: header fields and Requirements section added at Step 1, task blocks at Step 2, critique fixes applied at Steps 4 and 6. Path resolved from: user-specified → project `.claude/settings.json` `plansDirectory` → global `~/.claude/settings.json` `plansDirectory` → `~/.claude/plans/` fallback. |
| Plan mode designated file | When Claude Code plan mode is active, the plan is written to the system-designated file path instead of the above. Same incremental build process applies. The path appears in the plan mode system banner. |
| `.sdlc/learnings/log.md` | Planning learnings appended after writing: scope decisions, clarification patterns, decomposition issues. |
| `os.tmpdir()/sdlc-explore-<branchSlug>-XXXX/discovery-brief.md` | Dynamic-dimension discovery brief produced by `plan-explore-orchestrator` for 4+ file scopes. Contains per-dimension findings with stable `F-<DIM>-<n>` IDs, a contradictions section, and (when web/hybrid dimensions ran) a `## Best-Practice Synthesis` section. Wiped by EXIT/INT/TERM trap after Step 1 completes. Orphans swept by `ship-sdlc --gc`. |
| Step 7 context-heaviness advisory | When the latest transcript stats sidecar at `$TMPDIR/sdlc-context-stats.json` indicates `heavy: true` (transcript ≥60% of model budget), Step 7 prepends a `/compact` advisory above the handoff menu. Sidecar is written by the `UserPromptSubmit` hook `hooks/context-stats.js`. Implementation: [`scripts/lib/context-advisory.js`](../../plugins/sdlc-utilities/scripts/lib/context-advisory.js) consumed via the wrapper [`scripts/skill/plan-handoff-advisory.js`](../../plugins/sdlc-utilities/scripts/skill/plan-handoff-advisory.js). Pipeline state survives `/compact` (PreCompact + SessionStart hooks). |

### Suggested Review Dimensions advisory (G17)

When G17 finds coverage gaps in the dimension catalog or Copilot mirror, Step 4 splices a `## Suggested Review Dimensions` advisory block into the plan file. This section is **non-blocking** — absent proposals do not prevent plan finalization.

**CREATE proposals** (new dimension needed): fired when plan files land in uncovered territory.

| Criterion | Condition | Default severity |
|-----------|-----------|-----------------|
| C1 | New top-level technology directory (e.g., `terraform/`, `k8s/`, `mobile/`) | medium |
| C2 | 3+ new files share a common path prefix not covered by any dimension | medium |
| C3 | Security-sensitive path pattern (`**/auth/**`, `**/secret*`, `**/cred*`, `**/iam/**`, `**/crypto/**`, `**/pii/**`) | high |
| C4 | Infrastructure/deployment pattern (`**/infra/**`, `**/*.tf`, `**/k8s/**`, `**/helm/**`, `**/docker*`, `**/Dockerfile*`) | critical |
| C5 | 5+ files across multiple uncovered directories | medium |
| C6 | Single file, not matching C3/C4 (suppressed for single-file diffs) | low |

**UPDATE-path proposals** (existing dimension trigger globs may be stale):

| Criterion | Condition | Default severity |
|-----------|-----------|-----------------|
| U1 | Plan files use a different extension than the dimension's trigger globs | medium |
| U2 | Plan files land in a subdirectory not matched by existing trigger globs | medium |
| U3 | Plan renames/moves a directory explicitly named in a dimension trigger | high |
| U4 | Plan adds a new file extension to a path family the dimension covers | low |
| U5 | Trigger glob uses `**` but new files fall outside its wildcard scope | medium |
| U6 | 3+ files added to a path family where the trigger is a specific filename, not a glob | medium |

**UPDATE-behavior proposals** (dimension checklist may miss new concerns):

| Criterion | Condition | Default severity |
|-----------|-----------|-----------------|
| B1 | Plan describes a public API, CLI flag, env var, webhook, hook, or frontmatter contract change | high |
| B2 | Plan references auth, cryptography, PII, IAM, secrets, or session management and a `security`-type dimension exists | high |
| B3 | Plan describes an invariant flip (sync↔async, idempotent↔non-idempotent, atomic↔multi-step) | critical |
| B4 | Plan adds/removes a runtime dependency that changes the module surface | medium |

**Suppression rules:**
- C6 is never fired for single-file diffs.
- UPDATE proposals are suppressed for doc-only diffs (all paths match `docs/**`, `README*`, or `*.md` outside skills).
- B-criteria are suppressed when the description indicates rename-only, formatting, type-narrowing, or dead-code removal.
- Surviving proposals are ranked by `severity_rank DESC, criteria_count DESC, dimension_name ASC` and capped at 3. Additional candidates appear as `_N additional candidates suppressed_`.
- Within an active PR window, any dimension already recorded by a recent `harden-sdlc` run (via the `Dimensions:` line in `.sdlc/learnings/log.md`) is deferred — prevents duplicate proposals.

**X1 Copilot-mirror clause:** When the repo is hosted on GitHub (detected via `P14 githubHosting`), CREATE proposals always include an action to generate a new `.github/instructions/<name>.instructions.md` mirror. UPDATE proposals include this action only when the dimension already has a mirror. On non-GitHub remotes, X1 is omitted entirely.

**Worked example** (plan adds `packages/auth-service/**/*.ts` where no dimension covers `auth-service`):

```
## Suggested Review Dimensions

### CREATE: auth-service-security
**Why:** Plan adds 4 files under `packages/auth-service/` — no dimension covers this path. C3 fired (matches `**/auth/**`).
**Severity hint:** high
**Triggers:** `packages/auth-service/**`
**Action (dimension):** `/harden-sdlc --surface review-dimensions --dimension auth-service-security`
**Action (Copilot mirror, X1):** regenerate `.github/instructions/auth-service-security.instructions.md` per `setup-sdlc/setup-dimensions.md` Step 8 transform
```

For spec definitions: [docs/specs/plan-sdlc.md](../specs/plan-sdlc.md) — R31–R34, G17.

## Plan Integrity

When `plan-sdlc` runs, it writes a per-branch plan integrity state file at `.sdlc/execution/plan-<branchSlug>-<ts>.json`. The state file records four checkpoint markers as ISO timestamps:

| Marker | Written when |
|---|---|
| `skillInvoked` | Step 0 prepare — plan-sdlc was invoked |
| `planFile` | After Step 0 path resolution — plan file path resolved and recorded |
| `guardrailsEvaluated` | End of Step 3 — guardrail-compliance gate completed |
| `critiqueRan` | Final action of Step 3 — all critique checks completed |

A sibling field `planFilePath` stores the absolute path to the plan file so the hook can stat it for non-empty content.

The `stop-plan-integrity.js` Stop hook reads this state file at session end and warns when any checkpoint is missing or when the recorded plan file is absent or empty. If no state file exists but the transcript shows plan mode was active, the hook warns that `plan-sdlc` was not invoked. The hook is advisory-only and always exits 0. See [`hooks/stop-plan-integrity.js`](../../plugins/sdlc-utilities/hooks/stop-plan-integrity.js) and [issue #285](https://github.com/rnagrodzki/sdlc-marketplace/issues/285).

## State Format

For the full state file schema — field definitions, lifecycle rules (prune-on-write, consume-then-delete, GC sweep), and worked examples — see [`plugins/sdlc-utilities/skills/plan-sdlc/state-format.md`](../../plugins/sdlc-utilities/skills/plan-sdlc/state-format.md).

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
- **Direct bridge (`--from-openspec <name>`):** Validates the named change, loads all artifacts, and uses `tasks.md` as the primary decomposition skeleton. Bypasses the gate check entirely. This is the recommended path when `session-start.js` reports a change at stage `ready-for-plan`.
- **Functional change routing:** When OpenSpec is detected but neither `--spec` nor `--from-openspec` is passed, the skill classifies the user's request. For functional changes (new features, behavior modifications, API changes), it checks for a matching active OpenSpec change — if found, it auto-loads the spec context. If no match exists, it proposes three options: start the OpenSpec flow with `/opsx:propose`, continue planning directly without specs, or re-invoke with `/plan-sdlc --from-openspec <name>`. Non-functional changes (refactoring, config, docs) receive a passive hint only.

### OpenSpec task annotation and checkbox tracking

When `--from-openspec <name>` is active and `tasks.md` is present, `plan-sdlc` enriches the plan with per-task back-pointers:

- **`openspec-task` block** — each plan task derived from an OpenSpec task carries an `openspec-task: { change, ref, line, title }` block beneath its acceptance criteria. `ref` is a stable identifier: kebab-slug of the title plus a 6-char sha256 suffix. N:1 mapping is allowed (multiple plan tasks → same OpenSpec task).
- **HTML-comment ref injection** — `plan-sdlc` writes `<!-- ref:<ref> -->` to source `tasks.md` lines (write-once, additive). The annotation is rendered-invisible in Markdown. A second invocation on the same file is a no-op.
- **`## Out-of-scope OpenSpec tasks`** — when a plan task has no OpenSpec source, the uncovered OpenSpec task title must appear in this optional section with a one-line rationale. Satisfies the G16 coverage gate.
- **G16 coverage gate** — Step 3 critique blocks plan approval when any `tasks.md` entry is neither covered by a plan task's `openspec-task.ref` nor documented as out-of-scope.

At execute time, `execute-plan-sdlc` reads the `openspec-task` blocks and flips the corresponding `tasks.md` checkboxes from `- [ ]` to `- [x]` as each wave completes. See [`/execute-plan-sdlc` docs](execute-plan-sdlc.md) for details.

For spec definitions: [docs/specs/plan-sdlc.md](../specs/plan-sdlc.md) — R29, R30, G16.

See [OpenSpec Integration Guide](../openspec-integration.md) for the full workflow.

---

## Link Verification (issue #198)

Before declaring the plan ready (Step 7 handoff), the skill pipes the finalized plan file through `scripts/lib/links.js` as a hard gate. The validator auto-derives `expectedRepo` from `git remote origin` and `jiraSite` from `~/.sdlc-cache/jira/` — the skill never constructs the validator context. URL classes checked: GitHub issues/PRs (owner/repo identity + existence), Atlassian `*.atlassian.net/browse/<KEY>` (host match), and any other `http(s)://` URL (HEAD reachability, 5s timeout). Hosts in the built-in skip list (`linkedin.com`, `x.com`, `twitter.com`, `medium.com`) are reported as `skipped`, not violations. Set `SDLC_LINKS_OFFLINE=1` to skip generic reachability while keeping context-aware checks. On non-zero exit, Step 7 is **not** entered and the violation list is surfaced verbatim. No flag toggles this gate — it is hard.

---

## Related Skills

- [`/execute-plan-sdlc`](execute-plan-sdlc.md) — executes the plans this skill produces
- [`/review-sdlc`](review-sdlc.md) — review changes after plan execution
- [Guardrails authoring best practices](plan-guardrails-best-practices.md) — how to write evaluable plan guardrails
