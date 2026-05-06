# Harvest Learnings — Already-Tracked Cluster

## Project state
- Repo: rnagrodzki/sdlc-marketplace
- `.claude/learnings/log.md` contains two harvestable entries:
  - `## 2026-05-01 — skill-alpha: tracked lesson about alpha behavior` (lines 5–7)
  - `## 2026-05-02 — skill-beta: untracked lesson about beta behavior` (lines 9–10)

## Helper invocation simulation
The helper invoked `gh issue list --state all --limit 200 --search "Source: learnings/log.md" --json number,title,body,state,closedAt`. One open issue was returned whose body contains `Source: learnings/log.md (lines 5–7, harvested 2026-05-01)`.

Drafts JSON (simulated):
```json
{
  "totalEntries": 2,
  "dryRun": false,
  "clusters": [
    { "id": "abc123", "dateISO": "2026-05-01", "skill": "skill-alpha",
      "summary": "tracked lesson about alpha behavior",
      "sourceStartLine": 5, "sourceEndLine": 7,
      "status": "tracked",
      "dedupReason": "source-range-overlap",
      "existingIssue": { "number": 999, "title": "skill-alpha: tracked lesson about alpha behavior", "state": "OPEN" } },
    { "id": "def456", "dateISO": "2026-05-02", "skill": "skill-beta",
      "summary": "untracked lesson about beta behavior",
      "sourceStartLine": 9, "sourceEndLine": 10, "status": "draft" }
  ],
  "skippedTrivial": [],
  "gh": {}
}
```

## Tooling availability
`gh` CLI authenticated. The tracked cluster must be silently skipped (counted
in the final summary). Only the draft cluster should be presented to the user
for approval.
