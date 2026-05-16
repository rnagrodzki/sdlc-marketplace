# Execute — `expectedFiles` SOFT WARNING (Fixes #392 / R34)

## Wave manifest

```json
{
  "waveNumber": 1,
  "totalWaves": 2,
  "expectedFiles": ["src/auth/token.ts"],
  "tasks": [
    { "id": "T1", "name": "Refactor token module", "complexity": "Standard", "risk": "Low", "files": { "modify": ["src/auth/token.ts"] } }
  ],
  "guardrails": []
}
```

## WAVE_SUMMARY returned by the wave-runner Agent

```
WAVE_SUMMARY: {"wave":1,"status":"completed","tasks":[{"id":"T1","name":"Refactor token module","complexity":"Standard","risk":"Low","status":"DONE","filesChanged":["src/auth/token.ts","src/auth/index.ts"],"verifyToken":"parseToken in src/auth/token.ts","attempts":[{"model":"sonnet","status":"DONE"}],"finalModel":"sonnet"}],"verification":{"ran":false},"escalationsUsed":0}
```

## git diff --stat output for this wave

```
 src/auth/token.ts | 28 ++++++++++++++++++++--------
 src/auth/index.ts |  2 ++
 2 files changed, 22 insertions(+), 8 deletions(-)
```

The agent touched both `src/auth/token.ts` (expected) and `src/auth/index.ts` (NOT in expectedFiles).
Walk through Step 5c sub-step 1a and explain the verdict and what is surfaced to the user.
