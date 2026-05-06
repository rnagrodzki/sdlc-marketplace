# Harvest Learnings — Dry Run

## Project state
- Repo: rnagrodzki/sdlc-marketplace
- `.claude/learnings/log.md` contains three harvestable draft entries (same shape
  as `harvest-learnings-three-drafts.md`).

## Helper invocation simulation
The user invoked `/harvest-learnings --dry-run`. The helper was called with
`--output-file --dry-run`.

Drafts JSON (simulated):
```json
{
  "totalEntries": 3,
  "dryRun": true,
  "clusters": [
    { "id": "abc123", "dateISO": "2026-05-01", "skill": "skill-alpha",
      "summary": "first lesson",
      "bodyLines": "Body content for alpha.",
      "sourceStartLine": 5, "sourceEndLine": 6, "status": "draft" },
    { "id": "def456", "dateISO": "2026-05-02", "skill": "skill-beta",
      "summary": "second lesson",
      "bodyLines": "Body content for beta.",
      "sourceStartLine": 8, "sourceEndLine": 9, "status": "draft" },
    { "id": "ghi789", "dateISO": "2026-04-15", "skill": "skill-gamma",
      "summary": "older lesson",
      "bodyLines": "Body content for gamma.",
      "sourceStartLine": 11, "sourceEndLine": 12, "status": "draft" }
  ],
  "skippedTrivial": [],
  "gh": {}
}
```

## Expected behavior
Per the workflow, `--dry-run` short-circuits before issue creation. No
`gh issue create` calls. No `--commit` invocation. Drafts are printed for
the user to inspect.
