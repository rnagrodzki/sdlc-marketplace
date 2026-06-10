## Code Review — 8 dimension(s), 6 finding(s)

> Automated review by `review-sdlc` v0.20.36 · 2026-06-10

### Summary

| Dimension | Findings | Critical | High | Medium | Low | Info |
|-----------|----------|----------|------|--------|-----|------|
| code-quality | 0 | 0 | 0 | 0 | 0 | 0 |
| docs-skill-sync | 1 | 0 | 1 | 0 | 0 | 0 |
| hook-readiness | 0 | 0 | 0 | 0 | 0 | 0 |
| runtime-contract | 1 | 0 | 0 | 1 | 0 | 0 |
| script-resolution | 0 | 0 | 0 | 0 | 0 | 0 |
| security-review | 2 | 0 | 1 | 1 | 0 | 0 |
| skill-architecture | 1 | 0 | 0 | 1 | 0 | 0 |
| spec-compliance | 1 | 0 | 1 | 0 | 0 | 0 |
| **Total** | **6** | **0** | **3** | **2** | **0** | **0** |

### Verdict: APPROVED WITH NOTES

The workspace auto-detection refactor is well-executed: the spec, SKILL.md, docs, hooks, and test drivers are all updated consistently. Three findings require attention before merge — one stale prose contradiction between the SKILL.md and the new design (spec-compliance), one removed deterministic security enforcement layer (security-review), and one missing post-failure monitoring hook (security-review). No critical issues.

---

### docs-skill-sync — 1 finding(s)

<details>
<summary>0 critical · 1 high · 0 medium · 0 low · 0 info</summary>

#### [HIGH] Stale prose in execute-plan-sdlc doc: --branch described as always set by ship-sdlc

**File:** `docs/skills/execute-plan-sdlc.md:16`
The documentation still states "When ship-sdlc invokes execute-plan-sdlc inside the ship pipeline, `--branch` is always set unless the user selected 'Continue on current branch'". Under the new auto-detection model, ship-sdlc never passes `--branch` — it runs `git checkout -b` before dispatch instead, and execute-plan-sdlc's own derive yields `continue` (run in place). This description misleads readers about the actual pipeline contract.
**Suggestion:** Update this line to reflect that ship-sdlc no longer passes `--branch` — instead, ship establishes the feature branch via `git checkout -b` before dispatching execute, so execute's own `deriveWorkspace` yields `continue`. Remove or rewrite the "unless the user selected 'Continue on current branch'" reference (that interactive path no longer exists).

</details>

---

### hook-readiness — 0 finding(s)

<details>
<summary>0 critical · 0 high · 0 medium · 0 low · 0 info</summary>

No findings for this dimension.

</details>

---

### runtime-contract — 1 finding(s)

<details>
<summary>0 critical · 0 high · 1 medium · 0 low · 0 info</summary>

#### [MEDIUM] `$SCRIPT` variable used for state migration without visible resolution in diff

**File:** `plugins/sdlc-utilities/skills/ship-sdlc/SKILL.md:482`
The ship-sdlc workspace auto-detection block references `node "$SCRIPT" read` and `node "$SCRIPT" migrate` to perform state migration, but the `$SCRIPT` variable (pointing to `state/ship.js`) is not resolved within the visible new workspace block — it must be resolved elsewhere in the skill, earlier in the flow. If this resolution is missing or fails silently, the migration call is skipped without error, potentially leaving stale state files with the old branch slug. The `2>/dev/null` suppression on the read means any failure is completely silent.
**Suggestion:** Verify that `$SCRIPT` is explicitly resolved (via the standard `find ~/.claude/plugins` pattern with a failure guard) before the workspace block runs, and that this resolution is documented or co-located with the migration logic. If it relies on a prior resolution elsewhere in the skill, add an inline comment referencing where it comes from.

</details>

---

### script-resolution — 0 finding(s)

<details>
<summary>0 critical · 0 high · 0 medium · 0 low · 0 info</summary>

No findings for this dimension.

</details>

---

### security-review — 2 finding(s)

<details>
<summary>0 critical · 1 high · 1 medium · 0 low · 0 info</summary>

#### [HIGH] Deterministic jira-write enforcement layer removed — LLM-prose-only now sole gate · OWASP A04

**File:** `plugins/sdlc-utilities/hooks/hooks.json:51`
The `pre-tool-jira-write-guard.js` PreToolUse hook has been deleted, removing the deterministic enforcement layer that blocked Jira write MCP calls without a valid approval token and critique artifact. The spec explicitly acknowledges this (R21 updated to LLM-prose-only). However, the security posture is weakened: an LLM that hallucinates or skips the approval step will no longer be caught by a harness-level deterministic gate. The trust boundary between user approval → LLM action is now enforced solely by the LLM's own compliance with skill instructions.
**Suggestion:** This is a deliberate design decision documented in the spec. Accept it with the understanding that the LLM critique and `AskUserQuestion` flow remains the sole guard. Consider adding a note in the skill's DO NOT section explicitly forbidding dispatch without the `AskUserQuestion` gate to reinforce the constraint.

#### [MEDIUM] Post-failure error report hook removed — Bash crash monitoring gap · OWASP A09

**File:** `plugins/sdlc-utilities/hooks/hooks.json:26`
The `post-failure-error-report.js` `PostToolUseFailure` hook has been removed along with the other PreToolUse guards. This hook surfaced a reminder to invoke `error-report-sdlc` when prepare scripts crashed (exit code 2). Without it, Bash tool failures from skill scripts will no longer trigger the error reporting prompt, reducing observability of script crashes during pipeline execution.
**Suggestion:** If the error-report-sdlc skill is still active, consider whether the PostToolUseFailure hook for Bash failures should be retained independently from the other removed hooks, since it addresses a different concern (observability/diagnostics) rather than access control. If removing it is intentional, document the rationale in the PR.

</details>

---

### skill-architecture — 1 finding(s)

<details>
<summary>0 critical · 0 high · 1 medium · 0 low · 0 info</summary>

#### [MEDIUM] Stale cross-reference: execute-plan-sdlc SKILL.md says --branch is always passed by ship in pipeline mode

**File:** `plugins/sdlc-utilities/skills/execute-plan-sdlc/SKILL.md:143`
The SKILL.md still contains the sentence "When ship-sdlc invokes execute-plan-sdlc inside the ship pipeline, `--branch` is always set unless the user selected 'Continue on current branch' — Step 1's isolation logic does not fire in that case." Under the new design, ship-sdlc does NOT pass `--branch` — it runs `git checkout -b` before dispatch. The `--branch` short-circuit in Step 1 is still valid for the internal use case, but the prose describing when it is triggered is now wrong, creating a contradictory description of the contract.
**Suggestion:** Update this paragraph to reflect the actual call contract: ship-sdlc establishes the feature branch before dispatch (so execute's derive yields `continue` on its own) and does not pass `--branch`. The `--branch` flag remains available for any future caller that wants to use the short-circuit explicitly, but ship-sdlc no longer relies on it. Also flagged by: docs-skill-sync.

</details>

---

### spec-compliance — 1 finding(s)

<details>
<summary>0 critical · 1 high · 0 medium · 0 low · 0 info</summary>

#### [HIGH] execute-plan-sdlc SKILL.md contradicts spec R30: stale --branch-always-set pipeline prose

**File:** `plugins/sdlc-utilities/skills/execute-plan-sdlc/SKILL.md:143`
The spec R30 (updated) states: "In practice ship-sdlc establishes the feature branch before dispatching execute, so the standalone derive would yield `continue` anyway — `--branch` makes the short-circuit explicit." However, the SKILL.md prose in Step 1 still reads "When ship-sdlc invokes execute-plan-sdlc inside the ship pipeline, `--branch` is always set unless the user selected 'Continue on current branch'". The updated ship-sdlc SKILL.md confirms ship no longer passes `--branch` at all. This creates a contradiction between the spec's updated R30 description, the ship-sdlc implementation, and the execute-plan-sdlc SKILL.md Step 1 prose.
**Suggestion:** Update the Step 1 paragraph in execute-plan-sdlc SKILL.md to match both the spec and the ship-sdlc implementation: ship-sdlc does not pass `--branch`; the `--branch` short-circuit path exists for internal use but is not currently exercised by ship. The paragraph currently describes the OLD model (ship passes `--branch`) which was superseded by the new auto-detection design. Also flagged by: skill-architecture.

</details>

---

### code-quality — 0 finding(s)

<details>
<summary>0 critical · 0 high · 0 medium · 0 low · 0 info</summary>

No findings for this dimension.

</details>

---
