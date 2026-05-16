# Execute — `expectedFiles` HARD FAILURE (Fixes #392 / R34)

## Wave manifest

```json
{
  "waveNumber": 2,
  "totalWaves": 3,
  "expectedFiles": ["src/auth/token.ts", "src/auth/token.test.ts"],
  "tasks": [
    { "id": "T3", "name": "Add token rotation", "complexity": "Standard", "risk": "Medium", "files": { "modify": ["src/auth/token.ts"], "test": ["src/auth/token.test.ts"] } }
  ],
  "guardrails": []
}
```

## WAVE_SUMMARY returned by the wave-runner Agent

```
WAVE_SUMMARY: {"wave":2,"status":"completed","tasks":[{"id":"T3","name":"Add token rotation","complexity":"Standard","risk":"Medium","status":"DONE","filesChanged":["docs/notes.md"],"verifyToken":"rotateToken in docs/notes.md","attempts":[{"model":"sonnet","status":"DONE"}],"finalModel":"sonnet"}],"verification":{"ran":false},"escalationsUsed":0}
```

## git diff --stat output for this wave

```
 docs/notes.md | 12 ++++++++++++
 1 file changed, 12 insertions(+)
```

The agent reported DONE but touched zero files in `expectedFiles`. Walk through Step 5c sub-step 1a
(`expectedFiles` cross-check) and explain the verdict.
