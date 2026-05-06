# Harvest Learnings — Three Draft Clusters

## Project state
- Repo: rnagrodzki/sdlc-marketplace
- `.claude/learnings/log.md` contains three harvestable entries above the trailer:
  - `## 2026-05-01 — skill-alpha: first lesson about alpha behavior`
  - `## 2026-05-02 — skill-beta: second lesson about beta behavior`
  - `## 2026-04-15 — skill-gamma: older lesson about gamma behavior`

## Helper invocation simulation
The user runs `/harvest-learnings`. The helper at
`.claude/scripts/harvest-learnings.js` is invoked with `--output-file`.

Drafts JSON contents (simulated):
```json
{
  "logPath": "<repo>/.claude/learnings/log.md",
  "harvestDate": "2026-05-06",
  "totalEntries": 3,
  "dryRun": false,
  "clusters": [
    { "id": "abc123", "dateISO": "2026-05-01", "skill": "skill-alpha",
      "summary": "first lesson about alpha behavior",
      "bodyLines": "First-entry body line one.\nFirst-entry body line two.",
      "sourceStartLine": 5, "sourceEndLine": 7, "status": "draft" },
    { "id": "def456", "dateISO": "2026-05-02", "skill": "skill-beta",
      "summary": "second lesson about beta behavior",
      "bodyLines": "Second-entry body content.",
      "sourceStartLine": 9, "sourceEndLine": 10, "status": "draft" },
    { "id": "ghi789", "dateISO": "2026-04-15", "skill": "skill-gamma",
      "summary": "older lesson about gamma behavior",
      "bodyLines": "Third-entry body content covers an older event.",
      "sourceStartLine": 12, "sourceEndLine": 13, "status": "draft" }
  ],
  "skippedTrivial": [],
  "gh": {}
}
```

## Tooling availability
`gh` CLI is authenticated. `gh issue list` returned no overlapping issues.
The user is expected to approve drafts interactively before any
`gh issue create` runs.
