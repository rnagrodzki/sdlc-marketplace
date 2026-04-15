# Project Context: OpenSpec Config Present (Enriched at v1)

## Project State
- Branch: feat/add-auth
- Working directory: /tmp/test-project
- openspec/config.yaml exists with managed block at current version (v1)

## Prepare Script Output (setup.js)
```json
{
  "projectConfig": { "exists": true, "sections": ["version", "review", "commit", "pr"], "misplaced": [], "path": ".claude/sdlc.json" },
  "localConfig": { "exists": true, "path": ".sdlc/local.json" },
  "legacy": {
    "version": { "exists": false, "path": ".claude/version.json" },
    "ship": { "exists": false, "path": ".sdlc/ship-config.json" },
    "review": { "exists": false, "path": ".sdlc/review.json" },
    "reviewLegacy": { "exists": false, "path": ".claude/review.json" },
    "jira": { "exists": false, "path": ".sdlc/jira-config.json" }
  },
  "content": {
    "reviewDimensions": { "count": 3, "path": ".claude/review-dimensions/" },
    "prTemplate": { "exists": true, "path": ".claude/pr-template.md" },
    "jiraTemplates": { "count": 0, "path": ".claude/jira-templates/" },
    "planGuardrails": { "count": 2 }
  },
  "detected": { "versionFile": "package.json", "fileType": "package.json", "tagPrefix": "v", "defaultBranch": "main" },
  "openspecConfig": { "exists": true, "path": "openspec/config.yaml", "managedBlockVersion": 1 },
  "shipFields": [],
  "needsMigration": false
}
```
