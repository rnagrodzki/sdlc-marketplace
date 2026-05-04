# Project Context: Fully-Configured Project

## Project State
- Branch: feat/something
- Working directory: /tmp/test-project
- All sections in `.claude/sdlc.json` and `.sdlc/local.json` already configured

## Prepare Script Output (setup.js)

```json
{
  "projectConfig": { "exists": true, "sections": ["version","jira","commit","pr","plan","execute"], "misplaced": [], "path": ".claude/sdlc.json" },
  "localConfig": { "exists": true, "path": ".sdlc/local.json" },
  "legacy": {
    "version": { "exists": false, "path": ".claude/version.json" },
    "ship": { "exists": false, "path": ".sdlc/ship-config.json" },
    "review": { "exists": false, "path": ".sdlc/review.json" },
    "reviewLegacy": { "exists": false, "path": ".claude/review.json" },
    "jira": { "exists": false, "path": ".sdlc/jira-config.json" }
  },
  "content": {
    "reviewDimensions": { "count": 4, "path": ".claude/review-dimensions/" },
    "prTemplate": { "exists": true, "path": ".claude/pr-template.md" },
    "jiraTemplates": { "count": 0, "path": ".claude/jira-templates/" },
    "planGuardrails": { "count": 2 }
  },
  "detected": { "versionFile": "package.json", "fileType": "package.json", "tagPrefix": "v", "defaultBranch": "main" },
  "openspecConfig": { "exists": false, "path": "openspec/config.yaml", "managedBlockVersion": null },
  "shipFields": [],
  "needsMigration": false,
  "localIsV1": false,
  "sections": [
    {"id":"version","label":"version","state":"set","summary":"file: package.json, tag: v","locked":false,"purpose":"Tells /version-sdlc and /ship-sdlc where the canonical version string lives (a file, or only git tags) and how releases are tagged.","configFile":".claude/sdlc.json","configPath":"version","consumedBy":["version-sdlc","ship-sdlc"],"filesModified":[".claude/sdlc.json"],"optional":false,"delegatedTo":null,"confirmDetected":true,"fields":[]},
    {"id":"ship","label":"ship","state":"set","summary":"steps: execute,commit,review,pr  bump: patch","locked":false,"purpose":"Developer-local pipeline preferences for /ship-sdlc","configFile":".sdlc/local.json","configPath":"ship","consumedBy":["ship-sdlc"],"filesModified":[".sdlc/local.json"],"optional":false,"delegatedTo":null,"confirmDetected":false,"fields":[]},
    {"id":"jira","label":"jira","state":"set","summary":"project: PROJ","locked":false,"purpose":"Default Jira project key.","configFile":".claude/sdlc.json","configPath":"jira","consumedBy":["jira-sdlc","commit-sdlc","pr-sdlc"],"filesModified":[".claude/sdlc.json"],"optional":true,"delegatedTo":null,"confirmDetected":false,"fields":[]},
    {"id":"review","label":"review","state":"set","summary":"scope: committed","locked":false,"purpose":"Default scope for /review-sdlc.","configFile":".sdlc/local.json","configPath":"review","consumedBy":["review-sdlc"],"filesModified":[".sdlc/local.json"],"optional":true,"delegatedTo":null,"confirmDetected":false,"fields":[]},
    {"id":"commit","label":"commit","state":"set","summary":"pattern: ^(feat|fix): .+$","locked":false,"purpose":"Commit message validation rules.","configFile":".claude/sdlc.json","configPath":"commit","consumedBy":["commit-sdlc"],"filesModified":[".claude/sdlc.json"],"optional":true,"delegatedTo":"inline-commit-builder","confirmDetected":false,"fields":[]},
    {"id":"pr","label":"pr","state":"set","summary":"pattern: ^(feat|fix): .+$","locked":false,"purpose":"PR title validation rules.","configFile":".claude/sdlc.json","configPath":"pr","consumedBy":["pr-sdlc"],"filesModified":[".claude/sdlc.json"],"optional":true,"delegatedTo":"inline-pr-builder","confirmDetected":false,"fields":[]},
    {"id":"review-dimensions","label":"review-dimensions","state":"set","summary":"4 installed","locked":false,"purpose":"Review dimensions installed under .claude/review-dimensions.","configFile":"<delegated>","configPath":null,"consumedBy":["review-sdlc"],"filesModified":[".claude/review-dimensions/*.yaml"],"optional":true,"delegatedTo":"setup-dimensions","confirmDetected":false,"fields":[]},
    {"id":"pr-template","label":"pr-template","state":"set","summary":"installed","locked":false,"purpose":"PR description template.","configFile":"<delegated>","configPath":null,"consumedBy":["pr-sdlc"],"filesModified":[".claude/pr-template.md"],"optional":true,"delegatedTo":"setup-pr-template","confirmDetected":false,"fields":[]},
    {"id":"plan-guardrails","label":"plan-guardrails","state":"set","summary":"2 configured","locked":false,"purpose":"Custom rules at .claude/sdlc.json#plan.guardrails.","configFile":".claude/sdlc.json","configPath":"plan.guardrails","consumedBy":["plan-sdlc"],"filesModified":[".claude/sdlc.json"],"optional":true,"delegatedTo":"setup-guardrails","confirmDetected":false,"fields":[]},
    {"id":"execution-guardrails","label":"execution-guardrails","state":"set","summary":"1 configured","locked":false,"purpose":"Runtime guardrails at .claude/sdlc.json#execute.guardrails.","configFile":".claude/sdlc.json","configPath":"execute.guardrails","consumedBy":["execute-plan-sdlc","ship-sdlc"],"filesModified":[".claude/sdlc.json"],"optional":true,"delegatedTo":"setup-execution-guardrails","confirmDetected":false,"fields":[]},
    {"id":"openspec-block","label":"openspec-block","state":"not-set","summary":"","locked":false,"purpose":"Managed block in openspec/config.yaml.","configFile":"openspec/config.yaml","configPath":"<managed-block>","consumedBy":["plan-sdlc","execute-plan-sdlc","ship-sdlc"],"filesModified":["openspec/config.yaml"],"optional":true,"delegatedTo":"setup-openspec","confirmDetected":false,"fields":[]}
  ]
}
```
