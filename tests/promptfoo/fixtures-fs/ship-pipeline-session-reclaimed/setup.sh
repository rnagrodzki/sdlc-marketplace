#!/bin/bash
set -e
git init -q -b main
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false

echo "base" > base.txt
git add base.txt
git commit -q -m "chore: initial"

git checkout -q -b feat/ship

mkdir -p .sdlc/execution

# R73 (#505) resume path: the pipeline was CREATED by session A, so the on-disk
# `sessionId` is "sess-A". The test then calls the real claimSession("ship",
# "feat-ship") as session B before invoking the hook as session B — proving that
# a legitimately resumed run keeps its continuation nudges instead of being
# silenced forever by the (possibly long-dead) creating session's id.
cat > .sdlc/execution/ship-feat-ship-20260608T120000Z.json <<'EOF'
{
  "version": 1,
  "startedAt": "2026-06-08T12:00:00Z",
  "branch": "feat/ship",
  "sessionId": "sess-A",
  "flags": { "auto": true, "steps": ["execute", "commit", "pr"] },
  "steps": [
    { "name": "execute", "status": "in_progress" },
    { "name": "commit", "status": "pending" },
    { "name": "pr", "status": "pending" }
  ]
}
EOF
