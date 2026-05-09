# Harvest Learnings — Classifier Cases Context

The helper (`node .claude/scripts/harvest-learnings.js --output-file`) was run
and returned the following JSON (path captured from stdout, content read):

```json
{
  "logPath": "/project/.claude/learnings/log.md",
  "harvestDate": "2026-05-09",
  "totalEntries": 5,
  "dryRun": false,
  "clusters": [
    {
      "id": "aaa111000001",
      "dateISO": "2026-05-01",
      "skill": "pr-sdlc",
      "summary": "PR #42 opened for feat/add-auth — merged successfully",
      "bodyLines": "Operational release note. PR opened, review passed, merged to main.",
      "sourceStartLine": 5,
      "sourceEndLine": 7,
      "status": "operational-note",
      "dedupReason": "skill-prefix"
    },
    {
      "id": "bbb222000002",
      "dateISO": "2026-05-02",
      "skill": "version-sdlc",
      "summary": "v0.19.0 released — changelog generated",
      "bodyLines": "Version bump to 0.19.0. Changelog updated. Tag pushed.",
      "sourceStartLine": 9,
      "sourceEndLine": 11,
      "status": "operational-note",
      "dedupReason": "skill-prefix"
    },
    {
      "id": "ccc333000003",
      "dateISO": "2026-05-04",
      "skill": "setup-sdlc",
      "summary": "SSH alias resolution fails when IdentityFile absent",
      "bodyLines": "When ~/.ssh/config has a Host block without an IdentityFile line, the SSH\nalias resolver throws. Fixed by checking for undefined before reading the field.\nFixes #100",
      "sourceStartLine": 13,
      "sourceEndLine": 17,
      "status": "already-fixed",
      "dedupReason": "fix-on-main",
      "fixRef": { "type": "pr", "value": 100 }
    },
    {
      "id": "ddd444000004",
      "dateISO": "2026-05-07",
      "skill": "setup-sdlc",
      "summary": "real bug with no fix reference",
      "bodyLines": "This is a genuine bug that has not been fixed yet. No SHA or PR reference.\nIt should be classified as draft.",
      "sourceStartLine": 19,
      "sourceEndLine": 22,
      "status": "draft"
    },
    {
      "id": "eee555000005",
      "dateISO": "2026-05-08",
      "skill": "commit-sdlc",
      "summary": "commit message body truncated when diff exceeds 5000 lines",
      "bodyLines": "When the staged diff exceeds 5000 lines, the commit message body is silently truncated.\nFix: stream the diff in chunks instead of reading all at once.",
      "sourceStartLine": 24,
      "sourceEndLine": 27,
      "status": "draft"
    }
  ],
  "skippedTrivial": [],
  "gh": {}
}
```

The `--close-stale` mode returned the following JSON (separate run):

```json
{
  "harvestDate": "2026-05-09",
  "dryRun": false,
  "closures": [
    {
      "number": 211,
      "reason": "Fix merged in PR #100 — landed on main.",
      "fixRef": { "type": "pr", "value": 100 }
    }
  ],
  "skipped": [
    { "number": 999, "reason": "fix reference not verified on main" }
  ],
  "gh": {}
}
```
