# Plan Lightweight Skip Context (≤3 files, no orchestrator)

## plan-prepare.js Output (pre-computed)

```json
{
  "openspec": { "present": false, "activeChanges": [], "branchMatch": null },
  "fromOpenspec": null,
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

Add a `--verbose` flag to the CLI tool. Only `src/cli/index.ts` and `tests/cli.test.ts` need changes.

## Note

`explorePack.manifestPath` is null and `scopeHintCount` is 2. This is lightweight scope (≤3 files).
The orchestrator MUST NOT be dispatched. Inline exploration is used directly.
No `discovery-brief.md` is produced. No `F-DIM-N` IDs are required in tasks.

## Inline Exploration Result

- `src/cli/index.ts:12` — current args: `{ help: boolean, version: boolean }` via `minimist`
- `tests/cli.test.ts:5` — tests cover `--help` and `--version` flags
- No existing `--verbose` or logging infrastructure; new flag goes to stdout
