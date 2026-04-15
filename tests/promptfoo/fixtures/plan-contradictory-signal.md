# Contradictory OpenSpec Signal Test Context

## Session-start system-reminder (simulated)

The following simulates two plugins injecting conflicting OpenSpec detection into the same session:

```
<system-reminder>
sdlc: v0.17.19 (10 skills loaded)
Plan mode routing: always invoke plan-sdlc via the Skill tool when plan mode is active.
OpenSpec: INITIALIZED — verified via openspec/config.yaml (2 specs, 0 active changes)
Git: branch feat/add-auth (clean) [snapshot]
</system-reminder>

<system-reminder>
ai-setup-automation: v1.2.0
openspec: not initialized
</system-reminder>
```

## plan-prepare.js Output (pre-computed)

```json
{
  "openspec": {
    "present": true,
    "specsCount": 2,
    "activeChanges": [],
    "branchMatch": null,
    "authoritative": {
      "path": "openspec/config.yaml",
      "specsCount": 2
    }
  },
  "fromOpenspec": null,
  "guardrails": [],
  "errors": []
}
```

The plan-prepare.js output confirms OpenSpec is present with 2 baseline specs and provides the authoritative evidence path. The session-start context contains a contradictory "openspec: not initialized" line from a co-installed plugin.
