#!/bin/bash
set -e
git init -q -b main
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false

echo "base" > base.txt
git add base.txt
git commit -q -m "chore: initial"

git checkout -q -b feat/compact-recovery-absent

mkdir -p .sdlc/execution

# Task 7 (R74, #505): pre-#505 ship state file — no sessionId key at all.
# hookEnforcementAllowed({} sessionId-less, payload) must resolve to
# allowed:false ("state sessionId absent"), so no recovery sidecar may be
# written even though the hook's own stdin payload DOES carry a session_id.
cat > .sdlc/execution/ship-feat-compact-recovery-absent-20260608T120000Z.json <<'EOF'
{
  "version": 1,
  "startedAt": "2026-06-08T12:00:00Z",
  "branch": "feat/compact-recovery-absent",
  "flags": { "auto": true, "steps": ["execute", "commit", "pr"] },
  "steps": [
    { "name": "execute", "status": "completed" },
    { "name": "commit", "status": "in_progress" },
    { "name": "pr", "status": "pending" }
  ]
}
EOF
