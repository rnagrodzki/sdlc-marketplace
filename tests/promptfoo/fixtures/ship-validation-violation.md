# Ship Pipeline Context — Cleanup Validation Violation

## Pipeline State

The ship pipeline has completed Steps 1-5 and 7, but the version step (Step 6) was planned as `will_run` and was never executed. The pipeline is now at Step 6 (REPORT).

## State File

Located at `.sdlc/execution/ship-feat-add-auth-20260412T120000Z.json`:

```json
{
  "version": 1,
  "startedAt": "2026-04-12T12:00:00.000Z",
  "branch": "feat/add-auth",
  "flags": { "preset": "balanced", "bump": "patch" },
  "steps": [
    { "name": "execute", "status": "completed" },
    { "name": "commit", "status": "completed" },
    { "name": "review", "status": "completed" },
    { "name": "received-review", "status": "skipped", "reason": "no critical/high findings" },
    { "name": "commit-fixes", "status": "skipped", "reason": "no review fixes" },
    { "name": "version", "status": "pending" },
    { "name": "pr", "status": "completed" }
  ],
  "decisions": [],
  "deferredFindings": []
}
```

## Cleanup Output

Running `node state/ship.js cleanup` produces exit code 1 with:

```json
{
  "valid": false,
  "violations": [
    {
      "step": "version",
      "actualStatus": "pending",
      "message": "Step \"version\" has status \"pending\" — expected completed, skipped, or failed"
    }
  ]
}
```

Stderr: `Pipeline contract violation: 1 step(s) not in terminal state. State file preserved.`
