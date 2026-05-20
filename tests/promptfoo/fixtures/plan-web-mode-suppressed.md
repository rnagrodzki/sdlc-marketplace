# Plan Web-Mode Suppressed Context (pure internal refactor)

## plan-prepare.js Output (pre-computed)

```json
{
  "openspec": { "present": false, "activeChanges": [], "branchMatch": null },
  "fromOpenspec": null,
  "guardrails": [],
  "explorePack": {
    "manifestPath": "/tmp/sdlc-explore-feat-rename-abc789/manifest.json",
    "outDir": "/tmp/sdlc-explore-feat-rename-abc789",
    "scopeHintCount": 5,
    "webResearchSignal": false,
    "error": null
  },
  "errors": []
}
```

## User Request

Rename the `greet` function to `hello` across the codebase. The function appears in:
- `src/utils/greet.ts`
- `src/api/welcome.ts`
- `src/cli/index.ts`
- `tests/greet.test.ts`
- `tests/api.test.ts`

## Note

Pure internal rename — no external technology, no best-practice keywords. `webResearchSignal: false`.
The orchestrator MUST NOT emit any `web` or `hybrid` dimensions for this scope.

## Orchestrator Brief (simulated return)

```
Brief file: /tmp/sdlc-explore-feat-rename-abc789/discovery-brief.md
Out dir: /tmp/sdlc-explore-feat-rename-abc789
Dimensions: 3 (3 code, 0 web, 0 hybrid)
Web findings: 0
Contradictions: 0
Zero-finding dimensions: none
```

### Discovery Brief Contents

```markdown
# Discovery Brief

Generated: 2026-05-20T06:10:00Z
Dimensions: 3 (3 code, 0 web, 0 hybrid)

## Dimensions

| Dimension | Mode | Model | Findings | Status |
|---|---|---|---|---|
| greet-usage-sites | code | haiku | 3 | ACTIVE |
| greet-export-contract | code | haiku | 2 | ACTIVE |
| test-coverage-greet | code | haiku | 1 | ACTIVE |

## Findings

### F-greet-usage-sites-* (code)
F-greet-usage-sites-1: src/utils/greet.ts:5 — `export function greet(name: string)`
F-greet-usage-sites-2: src/api/welcome.ts:12 — `import { greet } from '../utils/greet'`
F-greet-usage-sites-3: src/cli/index.ts:8 — `greet(argv.name)`

### F-greet-export-contract-* (code)
F-greet-export-contract-1: src/utils/greet.ts:5 — Public export; rename breaks API contract if re-exported
F-greet-export-contract-2: src/api/welcome.ts:30 — Re-exports `greet` via `module.exports`; downstream impact

### F-test-coverage-greet-* (code)
F-test-coverage-greet-1: tests/greet.test.ts:10 — Test imports and calls `greet` directly; must update

## Contradictions
None detected.

## Zero-Finding Dimensions
None.
```
