#!/bin/bash
set -e
git init -q -b main
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false

echo "base" > base.txt
git add base.txt
git commit -q -m "chore: initial"

git checkout -q -b feat/compact-recovery-ancient

mkdir -p .sdlc/execution

# Task 7 (R74, #505): same shape as compact-recovery-ship-match, but the state
# file's mtime is backdated to 2024 (mirrors ship-pipeline-session-ancient).
# This makes "savedAt sourced from mtime" and "savedAt sourced from
# Date.now()" produce unambiguously different results, and also proves
# session-start.js's COMPACT_RECOVERY_TTL_MS (1h) gate now actually expires
# once the write itself stops refreshing savedAt on every Stop.
cat > .sdlc/execution/ship-feat-compact-recovery-ancient-20260608T120000Z.json <<'EOF'
{
  "version": 1,
  "startedAt": "2026-06-08T12:00:00Z",
  "branch": "feat/compact-recovery-ancient",
  "sessionId": "sess-fixture",
  "flags": { "auto": true, "steps": ["execute", "commit", "pr"] },
  "steps": [
    { "name": "execute", "status": "completed" },
    { "name": "commit", "status": "in_progress" },
    { "name": "pr", "status": "pending" }
  ]
}
EOF

# Backdate the state file's mtime (mirrors ship-pipeline-session-ancient/setup.sh).
touch -t 202401010000 .sdlc/execution/ship-feat-compact-recovery-ancient-20260608T120000Z.json
