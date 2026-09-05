# Plan OpenSpec Inline Generation — Gate Check Option 2 (R63)

This fixture exercises the Step 0 gate-check Option 2 path: the user selects "Generate OpenSpec
artifacts as plan appendix" instead of starting the full OpenSpec CLI flow or pointing at an
existing change. `openspecInlineGenerate` is set true and `openspecContext` stays empty for the
rest of the run — OpenSpec enrichment, Gate A, and `openspec-task:` annotations must NOT activate.
Artifact authoring is deferred to Step 4.

## Step 0 gate check (AskUserQuestion, as originally presented)

> This looks like a functional change. This project uses OpenSpec for spec-driven development.
>
> Options:
> 1. **Start OpenSpec flow** — use the openspec CLI to author a change first
> 2. **Generate OpenSpec artifacts as plan appendix** — plan generates proposal, spec deltas, and
>    tasks as inline appendix content (recommended default)
> 3. **Use existing spec** — pass `--spec` if you already have an OpenSpec change for this
>
> Select (1/2/3):

**User selected: 2**

## plan-prepare.js Output (pre-computed, post gate-check)

```json
{
  "openspec": { "present": true, "activeChanges": [], "branchMatch": null },
  "fromOpenspec": null,
  "fromOpenspecDirect": false,
  "openspecContext": null,
  "openspecInlineGenerate": true,
  "intakeAuditDispatch": null,
  "guardrails": [],
  "explorePack": {
    "manifestPath": null,
    "outDir": null,
    "scopeHintCount": 2,
    "webResearchSignal": false,
    "error": null
  },
  "errors": []
}
```

## User Request

Add standard rate-limit response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset`) to every public API response. Touches `src/middleware/rate-limit.ts` and
`src/api/response.ts`.

## What must NOT happen

- No OpenSpec change directory is read (`openspecContext` stays empty/null the whole run).
- Gate A (Intake Audit) is not dispatched — `intakeAuditDispatch` is null and there is no
  `openspecContext.requirements` to audit.
- No plan task carries an `**openspec-task:**` sub-block — that annotation only appears when
  `fromOpenspecDirect` is true, which it is not here.
- Step 0 does not ask the user a second question at this gate (R22 single-touchpoint) — Option 2
  is handled silently once selected.

## What Step 4 must do (implements R63)

Because `openspecInlineGenerate` is true and `fromOpenspecDirect` is false, Step 4's three-way
OpenSpec Appendix conditional takes branch (b): populate `## OpenSpec Appendix` with an
**OpenSpec Artifacts (Draft)** label and freshly authored fragments, each wrapped in its own
`<!-- openspec-target: <path> -->` annotation:

````markdown
## OpenSpec Appendix

**OpenSpec Artifacts (Draft)**

### Proposal Summary
<!-- openspec-target: proposal.md -->
Adds standard rate-limit headers to every public API response so clients can self-throttle.

### Delta Specs
<!-- openspec-target: specs/rate-limit-headers.md -->
```markdown
## ADDED Requirements
### Requirement: Rate-limit response headers
The system SHALL include X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset on
every public API response.
```

### Tasks List
<!-- openspec-target: tasks.md -->
- [ ] Add rate-limit header computation to the response middleware
- [ ] Wire header values from the existing rate-limiter state
````

The appendix must be complete enough that `openspec create`/`openspec validate` can run directly
off it after handoff — no further interactive authoring step.
